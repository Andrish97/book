// Przegląd wyglądu: zrzuty wszystkich ekranów, stanów i okien na wielu urządzeniach, w obu motywach,
// z audytem układu przy każdym zrzucie (wzorem silnika zrzutów Familiady, scripts/screens).
//
// Użycie:
//   python3 -m http.server 8792          # w katalogu repozytorium
//   node scripts/zrzuty-przeglad.cjs [--adres=http://localhost:8792/] [--katalog=zrzuty-robocze/przeglad]
//        [--urzadzenia=tel-360,ipad] [--motywy=jasny,ciemny] [--widoki=wyrażenie] [--rownolegle=2] [--bez-arkuszy]
//
// Zrzuty trafiają do <katalog>/<urządzenie>/<motyw>/<widok>.png (domyślnie zrzuty-robocze/, w .gitignore),
// audyt – do <katalog>/<urządzenie>/<motyw>/audyt.json i zbiorczo do <katalog>/audyt.json, arkusze – do
// <katalog>/arkusze/. Baza to atrapa z testów (tests/pomoc.cjs), dane – przykładowe projekty z instrukcji
// (scripts/zrzuty-instrukcji.cjs) uzupełnione o tabelę danych, serię, obrazy i tabelę na stronie.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium, devices } = require('playwright');
const { podlaczAtrape, zaloguj } = require('../tests/pomoc.cjs');
const { przykladoweProjekty } = require('./zrzuty-instrukcji.cjs');

const ARG = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : '1'];
}));
const ADRES = ARG.adres || 'http://localhost:8792/';
const KATALOG = path.resolve(ARG.katalog || path.join(__dirname, '..', 'zrzuty-robocze', 'przeglad'));
const TYLKO = ARG.urzadzenia ? ARG.urzadzenia.split(',') : null;
const MOTYWY = (ARG.motywy || 'jasny,ciemny').split(',');
const WZOR_WIDOKOW = ARG.widoki ? new RegExp(ARG.widoki) : null;
const ROWNOLEGLE = Math.max(1, Number(ARG.rownolegle) || 2);

const UA_TEL = devices['Pixel 7'].userAgent;
const UA_TAB = devices['iPad Mini'].userAgent;
const tel = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: UA_TEL });
const tab = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: UA_TAB });
// poziomTel: telefon trzymany poziomo – edytor pokazuje planszę „Za mało miejsca na wysokość” (decyzja #59),
// więc z widoków edytora robimy tylko jeden (plansza); reszta ekranów działa w obu ułożeniach.
const URZADZENIA = [
  { nazwa: 'tel-320', opcje: tel(320, 568) },
  { nazwa: 'tel-360', opcje: tel(360, 640) },
  { nazwa: 'tel-375', opcje: tel(375, 667) },
  { nazwa: 'tel-390', opcje: tel(390, 844) },
  { nazwa: 'tel-412', opcje: tel(412, 915) },
  { nazwa: 'tel-poziom-844', opcje: tel(844, 390), poziomTel: true },
  { nazwa: 'tel-poziom-915', opcje: tel(915, 412), poziomTel: true },
  { nazwa: 'ipad-mini', opcje: tab(768, 1024) },
  { nazwa: 'ipad', opcje: tab(820, 1180) },
  { nazwa: 'tablet-poziom-1180', opcje: tab(1180, 820) },
  { nazwa: 'tablet-poziom-1024', opcje: tab(1024, 768) },
  { nazwa: 'laptop-1366', opcje: { viewport: { width: 1366, height: 768 } } },
  { nazwa: 'pc-1440', opcje: { viewport: { width: 1440, height: 900 } } },
  { nazwa: 'pc-1920', opcje: { viewport: { width: 1920, height: 1080 } } },
  { nazwa: 'pc-niski', opcje: { viewport: { width: 1400, height: 550 } } },
].filter((u) => !TYLKO || TYLKO.includes(u.nazwa));

const czekaj = (s, ms) => s.waitForTimeout(ms);

// Pytanie o cały projekt („Projekt zmieniono na innym urządzeniu”) potrafi wyskoczyć po przygotowaniu danych
// (projekt zapisany lokalnie, zanim konto znało jego wersję). Zrzut robimy raz (to też widok do oceny),
// potem zostaje wersja z tego urządzenia.
async function niespodzianki(s) {
  const pytanie = s.locator('#dlg-potwierdz[open]:has-text("na innym urządzeniu")');
  if (!await pytanie.count()) return;
  if (s.zrzutPytania) { const z = s.zrzutPytania; s.zrzutPytania = null; await z(); }
  await s.locator('#dlg-potwierdz[open] button.glowny').click();
  await s.waitForSelector('#dlg-potwierdz[open]', { state: 'detached', timeout: 5000 }).catch(() => {});
  await czekaj(s, 600);
}

// ---------- Audyt układu (wykonywany w stronie przy każdym zrzucie) ----------
// Sprawdza otwarte okno albo menu, a bez nich – stronę:
//  poziome-przewijanie   dokument przewija się w poziomie (zakazane wszędzie)
//  poza-ekranem/oknem    przycisk albo pole wystaje poza ekran albo poza swoje okno
//  obciety               przycisk albo pole ucięte przez przodka bez przewijania
//  ukryta-tresc          przodek z overflow hidden/clip chowa tekst albo sterowanie (bez wielokropka)
//  uciety-tekst          tekst w jednej linii szerszy niż swoje pole, bez wielokropka
//  nachodzi              dwa przyciski, pola albo teksty nachodzą na siebie
//  krzywy-rzad           przyciski i pola w jednym rzędzie mają różną wysokość albo nie są wyrównane
//  etykieta-szersza      podpis pola wystaje poza swoje pole w rzędzie pól
//  maly-cel-dotyku       (dotyk) cel mniejszy niż 40 px – liczba i przykłady
//  maly-tekst            (telefon) tekst mniejszy niż 12 px – liczba i przykłady
function audytUkladu({ dotyk: naDotyku, telefon: naTelefonie }) {
  const wynik = [];
  const W = innerWidth;
  const H = innerHeight;
  const opis = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const k = [...el.classList].slice(0, 2);
    if (k.length) s += `.${k.join('.')}`;
    const t = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return t ? `${s} „${t}”` : s;
  };
  const widoczny = (el) => {
    if (!el.isConnected) return false;
    // Zamknięte <details>, content-visibility i podobne – przeglądarka wie najlepiej.
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
      if (e.hidden || e.inert) return false;
    }
    return true;
  };
  const przewijany = (e) => {
    const st = getComputedStyle(e);
    return (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 1) || (/(auto|scroll)/.test(st.overflowX) && e.scrollWidth > e.clientWidth + 1);
  };
  // Czy człowiek widzi element: w środku jego prostokąta (przyciętego do ekranu) na wierzchu jest on sam.
  // Element przykryty panelem, oknem albo przewinięty poza swój obszar – nie.
  const naWierzchu = (el, r) => {
    const x = Math.min(Math.max((Math.max(r.left, 0) + Math.min(r.right, W)) / 2, 1), W - 1);
    const y = Math.min(Math.max((Math.max(r.top, 0) + Math.min(r.bottom, H)) / 2, 1), H - 1);
    const t = document.elementFromPoint(x, y);
    return Boolean(t && (t === el || el.contains(t) || (t.contains(el) && t.matches('label, button, .wybor-przycisk'))));
  };
  const doc = document.scrollingElement;
  if (doc.scrollWidth > W + 1) wynik.push({ rodzaj: 'poziome-przewijanie', el: 'dokument', szczegol: `${doc.scrollWidth} > ${W}` });
  // Treść ucięta od góry: przewijany obszar wyśrodkowany (justify-content: center) z treścią wyższą niż on –
  // góra treści wystaje ponad obszar i nie da się do niej przewinąć (np. logowanie w niskim oknie).
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, canvas')) continue;
    const st = getComputedStyle(el);
    if (!/(auto|scroll|hidden)/.test(st.overflowY) || el.scrollHeight <= el.clientHeight + 1 || el.scrollTop > 0) continue;
    if (!widoczny(el)) continue;
    const gora = el.getBoundingClientRect().top + parseFloat(st.borderTopWidth || 0);
    const pierwszy = [...el.children].find((c) => widoczny(c) && getComputedStyle(c).position !== 'absolute' && getComputedStyle(c).position !== 'fixed');
    if (pierwszy && pierwszy.getBoundingClientRect().top < gora - 2) wynik.push({ rodzaj: 'ucieta-gora', el: opis(el), szczegol: `${Math.round(gora - pierwszy.getBoundingClientRect().top)} px nad obszarem` });
  }
  const okno = [...document.querySelectorAll('dialog[open]')].pop() || document.querySelector('.prezentacja');
  const korzen = okno || document.body;
  const ro = okno ? okno.getBoundingClientRect() : null;
  // Warstwa elementu: okno, otwarte menu albo okienko (lista, kolor, kalendarz, dymek) – porównujemy tylko w jednej warstwie.
  const WARSTWY = '.postepy, dialog[open], .menu:not([hidden]), .wybor-lista, .kolor-okienko, .kalendarz-okienko, .dymek, .powiadomienie, .prezentacja, .blokada-ekranu';
  const warstwa = (el) => el.closest(WARSTWY) || document.body;
  const sterowanie = [...korzen.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href], [role=button], label.przelacznik, .wybor-przycisk')]
    .filter((el) => !el.closest('.wybor-natywny, .kolor-natywny, canvas, [data-audyt-pomin]') && widoczny(el));
  const male = [];
  const wPrzewijanym = (el) => {
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) if (przewijany(e)) return true;
    return false;
  };
  // Świadome wyjątki (decyzja #73): uchwyty zasłonek i paneli – 30 px wysokości, ale na całą szerokość;
  // przycisk ⋯ na miniaturze strony – 36 px, bo leży na samej miniaturze.
  const malyCel = (el, r) => naDotyku && (r.height < 39.5 || r.width < 32) && !el.matches('input[type=checkbox], input[type=radio], a, .link-w-tekscie, .menu-miniatury')
    && !(el.matches('.uchwyt-zaslonki, .uchwyt-arkusza') && r.width >= 200);
  for (const el of sterowanie) {
    const r = el.getBoundingClientRect();
    if (malyCel(el, r)) male.push(`${opis(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (wPrzewijanym(el)) continue;
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) wynik.push({ rodzaj: 'poza-ekranem', el: opis(el), szczegol: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}` });
    else if (ro && warstwa(el) === okno && (r.right > ro.right + 1 || r.left < ro.left - 1 || r.bottom > ro.bottom + 1 || r.top < ro.top - 1)) wynik.push({ rodzaj: 'poza-oknem', el: opis(el), szczegol: '' });
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (!/(hidden|clip)/.test(st.overflowX + st.overflowY) || /(auto|scroll)/.test(st.overflowX + st.overflowY)) continue;
      const rp = e.getBoundingClientRect();
      if (r.right > rp.right + 2 || r.left < rp.left - 2 || r.bottom > rp.bottom + 2 || r.top < rp.top - 2) wynik.push({ rodzaj: 'obciety', el: opis(el), szczegol: `przez ${opis(e).split(' ')[0]}` });
      break;
    }
  }
  if (male.length) wynik.push({ rodzaj: 'maly-cel-dotyku', el: `${male.length} elementów`, szczegol: male.slice(0, 12).join('; ') });

  // Obcięta treść: przodek z overflow hidden/clip, który chowa tekst albo sterowanie (wielokropek jest w porządku).
  const wszystkie = [...korzen.querySelectorAll('*')].filter((el) => !el.closest('svg, canvas, video, iframe, [data-audyt-pomin], .siatka-obrazow img'));
  for (const el of wszystkie) {
    if (/^(INPUT|TEXTAREA|SELECT|IMG|OPTION|SCRIPT|STYLE|TEMPLATE|CANVAS)$/.test(el.tagName)) continue;
    const st = getComputedStyle(el);
    const clipX = /hidden|clip/.test(st.overflowX);
    const clipY = /hidden|clip/.test(st.overflowY);
    if (!clipX && !clipY) continue;
    const overX = clipX && el.scrollWidth > el.clientWidth + 1;
    const overY = clipY && el.scrollHeight > el.clientHeight + 1;
    if (!overX && !overY) continue;
    if (!widoczny(el) || el.clientWidth <= 2 || el.clientHeight <= 2 || st.clipPath !== 'none') continue;
    if (st.textOverflow === 'ellipsis' || Number(st.webkitLineClamp) > 0) continue;
    const er = el.getBoundingClientRect();
    const ukryte = [...el.querySelectorAll('*')].filter((c) => {
      if (!widoczny(c)) return false;
      const cs = getComputedStyle(c);
      if (cs.pointerEvents === 'none' && !c.textContent.trim()) return false;
      if (cs.position === 'absolute' && !c.textContent.trim() && !c.matches('button,input,select,textarea')) return false;
      const r = c.getBoundingClientRect();
      return (overX && (r.right > er.right + 2 || r.left < er.left - 2)) || (overY && (r.bottom > er.bottom + 2 || r.top < er.top - 2));
    });
    // Element w przewijanym obszarze wewnątrz obcinającego przodka da się przewinąć do widoku.
    const ukryteNaprawde = ukryte.filter((c) => { for (let x = c.parentElement; x && x !== el; x = x.parentElement) if (przewijany(x)) return false; return true; });
    ukryte.length = 0; ukryte.push(...ukryteNaprawde);
    const liscie = ukryte.filter((c) => !ukryte.some((d) => d !== c && c.contains(d)));
    const wazne = liscie.filter((c) => c.textContent.trim() || c.matches('button,a,input,select,textarea,[role=button]'));
    if (wazne.length) wynik.push({ rodzaj: 'ukryta-tresc', el: opis(el), szczegol: `${overX ? 'w poziomie ' : ''}${overY ? 'w pionie ' : ''}${wazne.length} el. (${opis(wazne[0])})` });
    else if (!liscie.length && el.children.length === 0 && el.textContent.trim() && overX) wynik.push({ rodzaj: 'uciety-tekst', el: opis(el), szczegol: '' });
  }

  // Nachodzące na siebie elementy w tej samej warstwie: sterowanie i teksty (liście z tekstem).
  const teksty = [...korzen.querySelectorAll('h1, h2, h3, h4, p, label > span, .etyk, strong, small, .ciche, .podpowiedz')]
    .filter((el) => !el.matches('.wybor, .ukryte, .z-przyciskiem, .z-jednostka') && !el.closest('button, svg, canvas, [data-audyt-pomin], .menu[hidden]') && el.textContent.trim() && widoczny(el));
  // Celowe nakładanie: pole z przyciskiem w środku (hasło, kopiuj) i element położony nad innym
  // (position absolute/fixed/sticky między nim a wspólnym przodkiem: przycisk menu na karcie, przyklejony pasek).
  const nadInnym = (el, wspolny) => {
    for (let e = el; e && e !== wspolny; e = e.parentElement) if (/absolute|fixed|sticky/.test(getComputedStyle(e).position)) return true;
    return false;
  };
  const celowe = (a, b) => {
    if (a.closest('.z-przyciskiem, .z-jednostka') && a.closest('.z-przyciskiem, .z-jednostka') === b.closest('.z-przyciskiem, .z-jednostka')) return true;
    let wspolny = a.parentElement;
    while (wspolny && !wspolny.contains(b)) wspolny = wspolny.parentElement;
    return nadInnym(a, wspolny) || nadInnym(b, wspolny);
  };
  const elementy = [...sterowanie.filter((el) => !el.matches('label.przelacznik')), ...teksty];
  // Widoczna część prostokąta: przycięta do przodków, które obcinają albo przewijają treść
  // (karta przewinięta pod pasek nie „nachodzi” na pasek – jej widoczna część kończy się pod nim).
  const przytnij = (el, r) => {
    let { left, top, right, bottom } = r;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
      const p = e.getBoundingClientRect();
      left = Math.max(left, p.left); top = Math.max(top, p.top); right = Math.min(right, p.right); bottom = Math.min(bottom, p.bottom);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const prostokaty = elementy.map((el) => {
    let r = el.getBoundingClientRect();
    // Tekst: prostokąt samych liter (Range), nie całego bloku – ale nie szerszy niż element (wielokropek).
    if (!el.matches('button, input, select, textarea, a, [role=button], .wybor-przycisk')) {
      const rng = document.createRange(); rng.selectNodeContents(el);
      const t = rng.getBoundingClientRect();
      r = { left: Math.max(t.left, r.left), top: Math.max(t.top, r.top), right: Math.min(t.right, r.right), bottom: Math.min(t.bottom, r.bottom) };
    }
    return { el, r: przytnij(el, r), w: warstwa(el) };
  }).filter((x) => x.r.width > 1 && x.r.height > 1 && naWierzchu(x.el, x.r));
  const nachodzi = [];
  for (let i = 0; i < prostokaty.length; i += 1) {
    const a = prostokaty[i];
    for (let j = i + 1; j < prostokaty.length; j += 1) {
      const b = prostokaty[j];
      if (a.w !== b.w || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 3 && y > 3 && !celowe(a.el, b.el)) nachodzi.push(`${opis(a.el)} × ${opis(b.el)}`);
    }
  }
  for (const n of nachodzi.slice(0, 8)) wynik.push({ rodzaj: 'nachodzi', el: n, szczegol: '' });

  // Krzywe rzędy: w kontenerze flex w poziomie przyciski i pola w jednej linii mają różną wysokość.
  const kontenery = new Set(sterowanie.map((el) => el.parentElement).filter(Boolean));
  for (const k of kontenery) {
    const st = getComputedStyle(k);
    if (!/flex|grid/.test(st.display) || (st.display.includes('flex') && st.flexDirection.startsWith('column'))) continue;
    const dzieci = [...k.children].filter((c) => widoczny(c) && c.matches('button, input:not([type=checkbox]):not([type=radio]), .wybor-przycisk, .przycisk') && !/absolute|fixed/.test(getComputedStyle(c).position));
    if (dzieci.length < 2) continue;
    const linie = new Map();
    for (const c of dzieci) {
      const r = c.getBoundingClientRect();
      const klucz = [...linie.keys()].find((t) => Math.abs(t - (r.top + r.height / 2)) < r.height / 2) ?? (r.top + r.height / 2);
      linie.set(klucz, [...(linie.get(klucz) || []), { c, r }]);
    }
    for (const rzad of linie.values()) {
      if (rzad.length < 2) continue;
      const wys = rzad.map((x) => x.r.height);
      const gory = rzad.map((x) => x.r.top);
      if (Math.max(...wys) - Math.min(...wys) > 4 || Math.max(...gory) - Math.min(...gory) > 4) {
        wynik.push({ rodzaj: 'krzywy-rzad', el: opis(k), szczegol: rzad.map((x) => `${opis(x.c).split(' ')[0]} ${Math.round(x.r.height)}px@${Math.round(x.r.top)}`).join(', ') });
      }
    }
  }

  // Podpis pola szerszy niż pole w rzędzie pól (podpisy nachodzą na sąsiednie pole albo wystają).
  for (const pole of korzen.querySelectorAll('.rzad > label.pole, .rzad > .pole')) {
    if (!widoczny(pole)) continue;
    const podpis = pole.querySelector(':scope > span');
    const wejscie = pole.querySelector('input:not([type=radio]):not([type=checkbox]):not([type=hidden]), .wybor-przycisk, .z-jednostka');
    if (!podpis || !wejscie) continue;
    const rng = document.createRange(); rng.selectNodeContents(podpis);
    const rp = rng.getBoundingClientRect();
    const rw = wejscie.getBoundingClientRect();
    if (rp.right > rw.right + 2) wynik.push({ rodzaj: 'etykieta-szersza', el: opis(podpis), szczegol: `${Math.round(rp.width)} > ${Math.round(rw.width)}` });
  }

  // Za mały tekst na telefonie.
  if (naTelefonie) {
    const male2 = [];
    const walker = document.createTreeWalker(korzen, NodeFilter.SHOW_TEXT);
    const widziane = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || widziane.has(el) || !/\p{L}{2}/u.test(n.textContent) || el.closest('svg, canvas, kbd, [data-audyt-pomin], .kartka, .podglad-stron, .miniatura, .licznik, .kropka')) continue;
      widziane.add(el);
      if (!widoczny(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11.5) male2.push(`${opis(el)} ${fs}px`);
    }
    if (male2.length) wynik.push({ rodzaj: 'maly-tekst', el: `${male2.length} elementów`, szczegol: male2.slice(0, 10).join('; ') });
  }
  return wynik;
}

// ---------- Pomocnicze kroki ----------

// Przycisk akcji: widoczny na pasku albo – na wąskim ekranie – w menu ⋯.
async function akcja(s, nazwa) {
  const widoczny = s.locator(`[data-akcja="${nazwa}"]:visible`).first();
  if (await widoczny.count()) { await widoczny.click(); return; }
  await s.click('#przycisk-wiecej');
  await s.locator(`#menu-wiecej [data-akcja="${nazwa}"]`).click();
}

// Panele edytora na telefonie i tablecie w pionie: zakładki na dole otwierają panel od dołu.
const panelowy = (s) => s.evaluate(() => getComputedStyle(document.querySelector('.zakladki-mobilne')).display !== 'none');
async function panel(s, ktory) {
  if (!await panelowy(s)) return;
  const jest = await s.evaluate(() => document.body.dataset.panel);
  if (jest !== ktory) await s.locator(`.zakladki-mobilne [data-panel="${ktory}"]`).click();
  await czekaj(s, 350);
}

// Stan wyjściowy przed każdym widokiem edytora: projekt „Kalendarz 2027”, bez okien, menu i paneli.
async function doEdytora(s, nazwaStrony = 'Styczeń') {
  await niespodzianki(s);
  await s.keyboard.press('Escape').catch(() => {});
  await s.evaluate(async (nazwa) => {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    document.querySelectorAll('.prezentacja').forEach((p) => p.remove());
    const { stan } = window.seriodruk;
    document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('.wybor-lista, .kolor-okienko, .kalendarz-okienko').forEach((m) => m.remove());
    if (document.body.dataset.ekran !== 'edytor' || stan.projekt?.id !== window.idKalendarza) {
      location.hash = `#/p/${window.idKalendarza}`;
      for (let n = 0; n < 60 && !(stan.projekt?.id === window.idKalendarza && document.body.dataset.ekran === 'edytor'); n += 1) await new Promise((ok) => { setTimeout(ok, 100); });
    }
    if (stan.tryb === 'wzorzec') document.querySelector('[data-akcja="wroc-do-stron"]')?.click();
    for (let n = 0; n < 20 && stan.tryb === 'wzorzec'; n += 1) await new Promise((ok) => { setTimeout(ok, 100); });
    const i = stan.projekt.strony.findIndex((x) => x.nazwa === nazwa);
    if (i >= 0 && i !== stan.indeks) await window.seriodruk.przejdzDoStrony(i);
    window.seriodruk.edytor.odznacz?.();
    document.body.dataset.panel = '';
  }, nazwaStrony);
  await s.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await czekaj(s, 300);
}

const zaznacz = (s, warunek) => s.evaluate((w) => {
  const e = window.seriodruk.edytor;
  const o = e.canvas.getObjects().find(new Function('o', `return ${w}`));
  if (o) e.zaznacz(o.id);
  return Boolean(o);
}, warunek);

const doPodgladu = async (s) => {
  await niespodzianki(s);
  await s.keyboard.press('Escape').catch(() => {});
  await s.evaluate(() => {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    document.querySelectorAll('.prezentacja').forEach((p) => p.remove());
    document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('.wybor-lista, .kolor-okienko, .kalendarz-okienko').forEach((m) => m.remove());
    location.hash = `#/p/${window.idKalendarza}/podglad`;
  });
  await s.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await czekaj(s, 1000);
};

// Uzupełnienie przykładowego kalendarza: tabela danych, seria na stronie „Luty”, obrazy i tabela na stronie.
async function uzupelnij(s) {
  await s.evaluate(async () => {
    const { stan, edytor: e } = window.seriodruk;
    const p = stan.projekt;
    p.tabele.push({ id: 't_dni', nazwa: 'Dni lutego', kolumny: ['dzien', 'dzien_tygodnia', 'imieniny', 'zdjecie'], wiersze: [
      ['1', 'poniedziałek', 'Brygidy, Ignacego', 'gory-zima.jpg'], ['2', 'wtorek', 'Marii, Mirosława', 'laka-wiosna.jpg'],
      ['3', 'środa', 'Błażeja, Oskara', 'morze.jpg'], ['4', 'czwartek', 'Andrzeja, Weroniki', 'gory-zima.jpg'],
    ] });
    p.serie.push({ id: 'se_dni', nazwa: 'Dni', tabela: 't_dni', tryb: 'tabela', uklad: 'szeroki', ile: 12, dodatkowe: [], dopelnij: false, pilnuj_stron: true });
    const obraz = (nazwa, a, b) => new Promise((ok) => {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 800;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1200, 800);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 800);
      c.toBlob((blob) => ok(new File([blob], nazwa, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
    });
    const { wgrajObrazy } = await import('./js/app/obrazy-okno.js');
    await wgrajObrazy([await obraz('gory-zima.jpg', '#1e3a8a', '#93c5fd'), await obraz('laka-wiosna.jpg', '#166534', '#fde68a'), await obraz('morze.jpg', '#0e7490', '#f0abfc')]);
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    const i = p.strony.findIndex((x) => x.nazwa === 'Luty');
    p.strony[i].seria = 'se_dni';
    await window.seriodruk.przejdzDoStrony(i);
    const id = Object.keys(p.zasoby).find((k) => p.zasoby[k].nazwa === 'gory-zima.jpg');
    const img = await e.dodajObraz(null, 'gory-zima.jpg', p.zasoby, { id });
    img.set({ left: 16, top: 16, scaleX: 0.1, scaleY: 0.1 }); img.setCoords();
    const t = e.dodajTekst('{dzien} {dzien_tygodnia}'); t.set({ left: 16, top: 104, width: 120 });
    const tab = e.dodajTabele({ wiersze: 4, kolumny: 3 });
    tab.set({ top: 130 }); tab.setCoords();
    e.canvas.discardActiveObject();
    e.zatwierdz();
    await window.seriodruk.zapiszTeraz();
  });
}

// Projekt innej osoby (Oli) z zaproszeniem dla zalogowanego konta – w atrapie bazy, jak po zaproszeniu.
function zaproszenieOdOli(baza, kod) {
  const ola = { id: '44444444-4444-4444-8444-444444444444', email: 'ola.nowak@przyklad.pl', haslo: 'Dobre#Haslo9', potwierdzone: true, nazwa: 'Ola Nowak' };
  if (!baza.konta.some((k) => k.id === ola.id)) baza.konta.push(ola);
  const id = '55555555-5555-4555-8555-555555555555';
  if (!baza.projekty.some((p) => p.id === id)) {
    baza.projekty.push({ id, owner_id: ola.id, nazwa: 'Kalendarz szkolny 2027', wersja: 1, zmieniono: new Date().toISOString(), dane: { strony: [], strony_osobno: true, miniatura: null } });
  }
  if (baza.zaproszenia.some((z) => z.kod === kod)) return;
  baza.zaproszenia.push({
    id: `z-${kod}`, projekt_id: id, email: baza.konta[0].email.toLowerCase(), rola: 'edycja', kod, zaprosil: ola.id,
    utworzono: new Date().toISOString(), wazne_do: new Date(Date.now() + 14 * 86400000).toISOString(), stan: 'czeka', przyjal: null,
  });
}

// ---------- Widoki ----------
// [nazwa, przygotowanie, { edytor: true }] – edytor: widok wymaga edytora (na telefonie poziomo pomijany).
const E = { edytor: true };
const WIDOKI = [
  ['03-edytor', async (s) => { await doEdytora(s); }, { edytor: true, teżPoziomo: true }],
  ['03b-edytor-rozkladowka', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => {
      const p = window.seriodruk.stan.projekt;
      const i = p.strony.findIndex((x) => p.sekcje.find((k) => k.id === x.sekcja)?.uklad === 'rozkladowki' && x !== p.strony[0]);
      if (i >= 0) await window.seriodruk.przejdzDoStrony(i);
    });
  }, E],
  ['03c-wzorzec', async (s) => { await doEdytora(s); await s.evaluate(async () => { const w = window.seriodruk.stan.projekt.wzorce[0]; if (w) await window.seriodruk.edytujWzorzec(w.id); }); await czekaj(s, 400); }, E],
  ['03d-linijki-siatka', async (s) => {
    await doEdytora(s);
    await s.click('#przycisk-widok'); await czekaj(s, 200);
    await s.evaluate(() => { for (const id of ['widok-linijki', 'widok-siatka']) { const c = document.getElementById(id); if (!c.checked) c.click(); } });
    await czekaj(s, 200);
  }, E],
  ['03e-menu-widoku', async (s) => { await doEdytora(s); await s.click('#przycisk-widok'); }, E],
  ['03f-pasek-narzedzi-rysuj', async (s) => { await doEdytora(s); await s.locator('[data-akcja="rysuj"]:visible').first().click(); await czekaj(s, 200); }, E],
  ['04-edytor-tekst', async (s) => { await doEdytora(s); await zaznacz(s, "o.text === 'Styczeń'"); await panel(s, 'inspektor'); }, E],
  ['04b-pisanie', async (s) => {
    await doEdytora(s);
    await s.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.text === 'Styczeń'); if (o) { e.zaznacz(o.id); o.enterEditing(); o.selectAll(); e.canvas.requestRenderAll(); } });
    await panel(s, 'inspektor');
  }, E],
  ['05-lista-rozwijana', async (s) => {
    await doEdytora(s); await zaznacz(s, "o.text === 'Styczeń'"); await panel(s, 'inspektor');
    const b = s.locator('#wlasciwosci .wybor-przycisk:visible').first();
    await b.scrollIntoViewIfNeeded(); await b.click();
  }, E],
  ['05b-kolor', async (s) => {
    await doEdytora(s); await zaznacz(s, "o.text === 'Styczeń'"); await panel(s, 'inspektor');
    const b = s.locator('#wlasciwosci .kolor-przycisk:visible').first();
    await b.scrollIntoViewIfNeeded(); await b.click(); await s.waitForSelector('.kolor-okienko', { timeout: 3000 });
  }, E],
  ['06-edytor-obraz', async (s) => { await doEdytora(s, 'Luty'); await zaznacz(s, "o.type === 'image'"); await panel(s, 'inspektor'); }, E],
  ['06b-edytor-ksztalt', async (s) => { await doEdytora(s); await zaznacz(s, "o.type === 'rect' || o.type === 'ellipse'"); await panel(s, 'inspektor'); }, E],
  ['07-edytor-tabela', async (s) => { await doEdytora(s, 'Luty'); await zaznacz(s, 'o.tabela'); await panel(s, 'inspektor'); }, E],
  ['07b-strona-wlasciwosci', async (s) => { await doEdytora(s); await panel(s, 'inspektor'); }, E],
  ['08-panel-strony', async (s) => { await doEdytora(s); await panel(s, 'strony'); }, E],
  ['08b-menu-strony', async (s) => {
    await doEdytora(s); await panel(s, 'strony');
    const m = s.locator('#lista-stron .menu-miniatury:visible').first();
    await m.scrollIntoViewIfNeeded(); await m.click(); await czekaj(s, 200);
  }, E],
  ['09-warstwy', async (s) => { await doEdytora(s); await panel(s, 'inspektor'); await s.click('#zakladki-panelu label:has-text("Warstwy")'); }, E],
  ['09b-ostrzezenia', async (s) => { await doEdytora(s); await panel(s, 'ostrzezenia'); }, E],
  ['10-menu-wiecej', async (s) => { await doEdytora(s); await s.click('#przycisk-wiecej'); }, E],
  ['11-wzorce', async (s) => { await doEdytora(s); await akcja(s, 'wzorce'); await s.waitForSelector('#dlg-wzorce[open]'); }, E],
  ['12-dane', async (s) => { await doEdytora(s); await akcja(s, 'dane'); await s.waitForSelector('#dlg-dane[open]'); }, E],
  ['12b-dane-tabela', async (s) => {
    await doEdytora(s); await akcja(s, 'dane'); await s.waitForSelector('#dlg-dane[open]');
    await s.locator('#dlg-dane :text("Dni lutego")').first().click().catch(() => {});
    await czekaj(s, 300);
  }, E],
  ['13-seria', async (s) => { await doEdytora(s); await s.evaluate(() => window.seriodruk.dane?.otworzSerie?.('se_dni')); await s.waitForSelector('#dlg-seria[open]', { timeout: 3000 }); }, E],
  ['14-sekcja', async (s) => { await doEdytora(s); await s.evaluate(() => window.seriodruk.otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[1].id)); await s.waitForSelector('#dlg-sekcja[open]'); }, E],
  ['15-pdf', async (s) => { await doEdytora(s); await akcja(s, 'pdf'); await s.waitForSelector('#dlg-pdf[open]'); }, E],
  ['16-kontrola', async (s) => { await doEdytora(s); await akcja(s, 'kontrola'); await s.waitForSelector('#dlg-kontrola[open]'); await czekaj(s, 1500); }, E],
  ['17-dostep-ai', async (s) => { await doEdytora(s); await akcja(s, 'dostep-ai'); await s.waitForSelector('#dlg-dostep-ai[open]'); }, E],
  ['17b-dostep-ai-klucz', async (s) => {
    await doEdytora(s); await akcja(s, 'dostep-ai'); await s.waitForSelector('#dlg-dostep-ai[open]');
    await s.locator('#dlg-dostep-ai input[type=text], #dlg-dostep-ai input:not([type])').first().fill('Claude – kalendarz').catch(() => {});
    await s.click('[data-akcja="dostep-ai-utworz"]'); await czekaj(s, 1200);
  }, E],
  ['18-czcionki', async (s) => { await doEdytora(s); await akcja(s, 'czcionki'); await s.waitForSelector('#dlg-czcionki[open]'); }, E],
  ['19-obrazy', async (s) => { await doEdytora(s); await akcja(s, 'obrazy'); await s.waitForSelector('#dlg-obrazy[open]'); await czekaj(s, 600); }, E],
  ['19b-obrazy-zaznaczone', async (s) => {
    await doEdytora(s); await akcja(s, 'obrazy'); await s.waitForSelector('#dlg-obrazy[open]'); await czekaj(s, 400);
    await s.evaluate(() => { const b = document.querySelector('#obrazy-tryb-zaznaczania, [data-akcja="obrazy-zaznacz"]'); b?.click(); document.querySelectorAll('#obrazy-lista li .obraz-zaznacz input').forEach((c, i) => { if (i < 2) c.click(); }); });
    await czekaj(s, 300);
  }, E],
  ['19c-obrazy-wybor', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => { (await import('./js/app/obrazy-okno.js')).otworzObrazy({ wybierz: { etykieta: 'Wstaw' } }); });
    await s.waitForSelector('#dlg-obrazy[open]'); await czekaj(s, 600);
  }, E],
  ['20-zrodlo-obrazu', async (s) => { await doEdytora(s); await akcja(s, 'dodaj-obraz'); await s.waitForSelector('#dlg-zrodlo-obrazu[open]'); }, E],
  ['21-tabela-nowa', async (s) => { await doEdytora(s); await akcja(s, 'dodaj-tabele'); await s.waitForSelector('#dlg-tabela[open]'); }, E],
  ['22-potwierdz', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => { (await import('./js/ui.js')).potwierdz('Usunąć stronę „Styczeń”?', 'Strona zniknie z projektu razem z elementami. Można to cofnąć (Ctrl+Z).', 'Usuń', true); });
    await s.waitForSelector('#dlg-potwierdz[open]');
  }, E],
  ['23-nazwa', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => { (await import('./js/ui.js')).zapytajONazwe('Zmień nazwę strony', 'Nazwa strony', 'Styczeń'); });
    await s.waitForSelector('#dlg-nazwa[open]');
  }, E],
  ['24-duplikat', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 600; c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = '#b91c1c'; x.fillRect(0, 0, 600, 400);
      const plik = await new Promise((ok) => c.toBlob((b) => ok(new File([b], 'morze.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.8));
      (await import('./js/app/obrazy-okno.js')).wgrajObrazy([plik]);
    });
    await s.waitForSelector('#dlg-obraz-duplikat[open]');
    await czekaj(s, 300);
  }, E],
  ['25-konflikt', async (s) => {
    await doEdytora(s);
    await s.evaluate(() => {
      const d = document.querySelector('#dlg-konflikt');
      document.querySelector('#konflikt-opis').textContent = 'Te części projektu zmieniono tu i na innym urządzeniu. Wybierz, która wersja zostaje.';
      const l = document.querySelector('#konflikt-lista');
      l.innerHTML = '<li><strong>Strona „Styczeń”</strong><label><input type="radio" name="k0" value="moje" checked><span>Z tego urządzenia (dziś 10:12)</span></label><label><input type="radio" name="k0" value="konto"><span>Z konta (dziś 10:14)</span></label></li>';
      d.showModal();
    });
  }, E],
  ['25b-powiadomienie', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => { (await import('./js/ui.js')).powiadom('Połączono zmiany z innego urządzenia (z konta: 2 części projektu). Twoje zmiany zostały.'); });
    await czekaj(s, 200);
  }, E],
  ['25d-postep', async (s) => {
    await doEdytora(s);
    await s.evaluate(async () => {
      const { postep } = await import('./js/postep.js');
      window.__postepy = [postep('Wgrywanie obrazów z bardzo długą nazwą archiwum „zdjęcia z wakacji 2026.zip”', { razem: 48, anuluj: () => {}, opoznienie: 0 }), postep('Otwieranie projektu…', { opoznienie: 0 })];
      window.__postepy[0].krok(12);
    });
    await czekaj(s, 300);
  }, { edytor: true, poZrzucie: async (s) => { await s.evaluate(() => { for (const p of window.__postepy || []) p.koniec(); }); } }],
  ['25e-postep-w-oknie', async (s) => {
    await doEdytora(s); await akcja(s, 'obrazy'); await s.waitForSelector('#dlg-obrazy[open]');
    await s.evaluate(async () => {
      const { postep } = await import('./js/postep.js');
      window.__postepy = [postep('Wgrywanie obrazów', { razem: 27, anuluj: () => {}, opoznienie: 0 })];
      window.__postepy[0].krok(5);
    });
    await czekaj(s, 300);
  }, { edytor: true, poZrzucie: async (s) => { await s.evaluate(() => { for (const p of window.__postepy || []) p.koniec(); }); } }],
  ['25c-offline', async (s) => {
    await doEdytora(s);
    await s.context().setOffline(true);
    await s.evaluate(() => { window.dispatchEvent(new Event('offline')); const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.text === 'Styczeń'); if (o) { o.set({ left: o.left + 0.5 }); e.canvas.fire('object:modified', { target: o }); } });
    await czekaj(s, 1500);
  }, { edytor: true, poZrzucie: async (s) => { await s.context().setOffline(false); await s.evaluate(() => window.dispatchEvent(new Event('online'))); } }],
  ['26-podglad', async (s) => { await doPodgladu(s); await czekaj(s, 400); }, {}],
  ['27-udostepnij', async (s) => {
    await doPodgladu(s);
    await akcja(s, 'udostepnij'); await s.waitForSelector('#dlg-udostepnij[open]');
  }, {}],
  ['27b-udostepnij-haslo', async (s) => {
    await doPodgladu(s);
    await akcja(s, 'udostepnij'); await s.waitForSelector('#dlg-udostepnij[open]');
    if (!await s.locator('#udostepnij-haslo-wl').isChecked()) await s.check('#udostepnij-haslo-wl');
    await s.click('#udostepnij-termin-pole .wybor-przycisk').catch(() => {});
    await czekaj(s, 300);
  }, {}],
  ['28-prezentacja', async (s) => {
    await doPodgladu(s);
    await akcja(s, 'podglad-prezentacja'); await s.waitForSelector('.prezentacja'); await czekaj(s, 1200);
  }, {}],
  ['29-instrukcja', async (s) => { await doEdytora(s); await akcja(s, 'instrukcja'); await s.waitForSelector('#dlg-instrukcja[open]'); await czekaj(s, 600); }, E],
  ['30-nowy-projekt', async (s) => {
    await s.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); document.querySelectorAll('.prezentacja').forEach((p) => p.remove()); location.hash = '#/projekty'; });
    await s.waitForSelector('.karta-projektu:not(.szkielet)');
    await s.click('[data-akcja="nowy-projekt"]:visible'); await s.waitForSelector('#dlg-nowy[open]');
  }, {}],
  // Współpraca między kontami (decyzja #86): okno „Współpraca”, skrzynka zaproszeń, zaproszenie z linku,
  // lista z projektem udostępnionym.
  ['36-wspolpraca', async (s) => {
    await doEdytora(s); await akcja(s, 'wspolpraca'); await s.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
    await s.fill('#wspolpraca-email', 'ola.nowak@przyklad.pl'); await s.click('#wspolpraca-zapros');
    await s.waitForSelector('#wspolpraca-gotowe:not([hidden])'); await czekaj(s, 800);
  }, E],
  ['37-zaproszenia', async (s, baza) => {
    await doEdytora(s);
    zaproszenieOdOli(baza, 'kod-skrzynka');
    await s.click('[data-akcja="do-projektow"]:visible'); await s.waitForSelector('#przycisk-zaproszenia:not([hidden])');
    await s.click('#przycisk-zaproszenia'); await s.waitForSelector('#dlg-zaproszenia[open] #zaproszenia-lista li');
  }, E],
  ['38-zaproszenie-z-linku', async (s, baza) => {
    await doEdytora(s);
    zaproszenieOdOli(baza, 'kod-link');
    await s.evaluate(() => { location.hash = '#/zaproszenie/kod-link'; });
    await s.waitForSelector('#dlg-zaproszenie[open]');
  }, E],
  ['39-projekty-udostepnione', async (s, baza) => {
    await doEdytora(s);
    zaproszenieOdOli(baza, 'kod-lista');
    baza.wspolpraca('przyjmij_zaproszenie', { p_kod: 'kod-lista' }, baza.konta[0]);
    await s.click('[data-akcja="do-projektow"]:visible');
    await s.waitForSelector('.karta-projektu.wspoldzielony'); await czekaj(s, 400);
  }, E],
  ['31-konto', async (s) => {
    await s.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); document.querySelectorAll('.prezentacja').forEach((p) => p.remove()); location.hash = '#/konto'; });
    await s.waitForFunction(() => document.body.dataset.ekran === 'konto'); await czekaj(s, 400);
  }, {}],
  ['31b-konto-wyglad', async (s) => {
    await s.evaluate(() => { location.hash = '#/konto'; });
    await s.waitForFunction(() => document.body.dataset.ekran === 'konto');
    await s.locator('[data-do="ust-wyglad"]:visible').first().click().catch(() => {});
    await czekaj(s, 500);
  }, {}],
  ['31d-konto-miejsce', async (s) => {
    await s.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); location.hash = '#/konto'; });
    await s.waitForFunction(() => document.body.dataset.ekran === 'konto');
    await s.locator('[data-do="ust-miejsce"]:visible').first().click();
    await czekaj(s, 1200);
  }, {}],
  ['31c-konto-dol', async (s) => {
    await s.evaluate(() => { location.hash = '#/konto'; });
    await s.waitForFunction(() => document.body.dataset.ekran === 'konto');
    await s.evaluate(() => { const t = document.querySelector('.konto-tresc'); (t && t.scrollHeight > t.clientHeight ? t : document.scrollingElement).scrollTo(0, 1e6); });
    await czekaj(s, 300);
  }, {}],
];

// Widoki przed zalogowaniem (wszystkie stany logowania).
async function widokiLogowania(s, zrzut) {
  await s.goto(ADRES);
  await s.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await zrzut('01-logowanie');
  await s.fill('#form-logowania input[name=email]', 'ktos@example.com');
  await s.fill('#form-logowania input[name=haslo]', 'zle-haslo');
  await s.click('#przycisk-logowania');
  await s.waitForFunction(() => document.querySelector('#komunikat-logowania').textContent.trim(), null, { timeout: 8000 }).catch(() => {});
  await zrzut('01b-logowanie-blad');
  await s.click('#tryb-logowania label:has(input[value=rejestracja])');
  await s.fill('#form-logowania input[name=haslo]', 'abc');
  await czekaj(s, 200);
  await zrzut('01c-rejestracja');
  await s.click('#tryb-logowania label:has(input[value=logowanie])');
  await s.click('#link-reset');
  await czekaj(s, 200);
  await zrzut('01d-reset');
  await s.fill('#form-logowania input[name=email]', 'ktos@example.com');
  await s.click('#przycisk-logowania');
  await s.waitForSelector('#widok-wyslano:not([hidden])', { timeout: 8000 }).catch(() => {});
  await zrzut('01e-wyslano');
  await s.goto(ADRES);
  await s.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
}

// Udostępniony podgląd oczami gościa: link z hasłem (pole hasła), potem strony.
async function widokiGoscia(przegladarka, u, motyw, baza, link, zrzutStrony) {
  const k = await przegladarka.newContext({ ...u.opcje, deviceScaleFactor: 1, serviceWorkers: 'block', colorScheme: motyw === 'ciemny' ? 'dark' : 'light' });
  await podlaczAtrape(k).catch(() => {});
  baza.podlacz?.(k);
  await k.route('https://atrapa.supabase.co/storage/v1/object/public/**', async (r) => {
    const klucz = new URL(r.request().url()).pathname.slice('/storage/v1/object/public/'.length);
    const plik = baza.pliki.get(klucz);
    if (!plik) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc, headers: { 'access-control-allow-origin': '*' } });
  });
  const g = await k.newPage();
  await g.goto(link);
  await g.waitForSelector('#podglad-haslo input[name=haslo]', { timeout: 15000 });
  await zrzutStrony(g, '33-link-haslo');
  await g.fill('#podglad-haslo input[name=haslo]', 'tajne-haslo');
  await g.click('#podglad-haslo button');
  await g.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length > 0, null, { timeout: 20000 });
  await czekaj(g, 1500);
  await zrzutStrony(g, '34-link');
  await k.close();
}

async function zrzutyUrzadzenia(przegladarka, u, motyw) {
  const katalog = path.join(KATALOG, u.nazwa, motyw);
  fs.mkdirSync(katalog, { recursive: true });
  const kontekst = await przegladarka.newContext({ ...u.opcje, deviceScaleFactor: 1, serviceWorkers: 'block', colorScheme: motyw === 'ciemny' ? 'dark' : 'light' });
  const baza = await podlaczAtrape(kontekst);
  const s = await kontekst.newPage();
  const bledy = [];
  s.on('pageerror', (e) => bledy.push(e.message));
  const audyt = {};
  const telefon = (u.opcje.viewport?.width || 9999) <= 600 || Boolean(u.poziomTel);
  const chce = (nazwa) => !WZOR_WIDOKOW || WZOR_WIDOKOW.test(nazwa);
  const zrzutStrony = async (strona, nazwa) => {
    if (!chce(nazwa)) return;
    await czekaj(strona, 450);
    // Komunikat z przygotowania danych („Wgrano 3 obrazy”) nie należy do ocenianego widoku.
    await strona.evaluate(() => { const p = document.querySelector('#powiadomienie'); if (p && /Wgrano|Pominięto|Zapisano projekt/.test(p.textContent)) p.hidden = true; });
    // Na dotyku Playwright klika „myszą” – dymek po najechaniu, którego palec nie wywoła, nie należy do widoku.
    if (u.opcje.hasTouch) await strona.evaluate(() => document.querySelector('#dymek')?.remove());
    await strona.screenshot({ path: path.join(katalog, `${nazwa}.png`) });
    const w = await strona.evaluate(audytUkladu, { dotyk: Boolean(u.opcje.hasTouch), telefon });
    if (w.length) audyt[nazwa] = w;
  };
  const zrzut = (nazwa) => zrzutStrony(s, nazwa);
  const nieudane = [];
  try {
    await widokiLogowania(s, zrzut);
  } catch (e) { nieudane.push(`logowanie: ${e.message.split('\n')[0]}`); }
  await zaloguj(s, baza);
  await czekaj(s, 400);
  await zrzut('02a-projekty-pusto');
  await przykladoweProjekty(s);
  await uzupelnij(s);
  await s.click('[data-akcja="do-projektow"]:visible').catch(async () => { await s.evaluate(() => { location.hash = '#/projekty'; }); });
  await s.waitForSelector('.karta-projektu:not(.szkielet)');
  s.zrzutPytania = () => zrzut('02c-pytanie-o-projekt');
  await czekaj(s, 1500);
  await niespodzianki(s);
  await zrzut('02-projekty');
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .menu-karty');
  await zrzut('02b-projekty-menu');
  await s.keyboard.press('Escape');
  await niespodzianki(s);
  await s.click('.karta-projektu:has-text("Kalendarz 2027") .otworz-projekt');
  await czekaj(s, 800);
  await niespodzianki(s);
  await s.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Kalendarz 2027' && document.body.dataset.ekran === 'edytor');
  await s.evaluate(() => { window.idKalendarza = window.seriodruk.stan.projekt.id; });
  for (const [nazwa, przygotuj, opcje = {}] of WIDOKI) {
    if (!chce(nazwa)) continue;
    if (u.poziomTel && opcje.edytor && !opcje.teżPoziomo) continue;
    try {
      await niespodzianki(s);
      await przygotuj(s, baza);
      await zrzut(u.poziomTel && nazwa === '03-edytor' ? '32-za-malo-miejsca' : nazwa);
    } catch (e) {
      nieudane.push(`${nazwa}: ${e.message.split('\n')[0]}`);
    }
    if (opcje.poZrzucie) await opcje.poZrzucie(s).catch(() => {});
  }
  // Udostępniony link z hasłem – oczami gościa.
  if (chce('33-link-haslo') || chce('34-link')) {
    try {
      await doPodgladu(s);
      await akcja(s, 'udostepnij'); await s.waitForSelector('#dlg-udostepnij[open]');
      if (!await s.locator('#udostepnij-haslo-wl').isChecked()) await s.check('#udostepnij-haslo-wl');
      await s.fill('#udostepnij-haslo', 'tajne-haslo');
      await s.click('#udostepnij-utworz');
      await s.waitForFunction(() => { const k = document.querySelector('#udostepnij-komunikat'); return k.classList.contains('sukces') || k.classList.contains('blad'); }, null, { timeout: 120000 });
      const kom = await s.evaluate(() => { const k = document.querySelector('#udostepnij-komunikat'); return k.classList.contains('sukces') ? '' : k.textContent; });
      if (kom) throw new Error(`udostępnianie: ${kom}`);
      await s.waitForFunction(() => document.querySelector('#udostepnij-link').value.includes('#/u/'), null, { timeout: 120000 });
      const link = await s.inputValue('#udostepnij-link');
      await widokiGoscia(przegladarka, u, motyw, baza, link, zrzutStrony);
    } catch (e) { nieudane.push(`link: ${e.message.split("\n").slice(0, 3).join(" | ")}`); }
  }
  await kontekst.close();
  fs.writeFileSync(path.join(katalog, 'audyt.json'), JSON.stringify(audyt, null, 1));
  return { nieudane, bledy, audyt };
}

// Arkusze zbiorcze: kilka zrzutów obok siebie (pomniejszone), z podpisami – przez Pythona i Pillow.
function arkusze() {
  const wyj = path.join(KATALOG, 'arkusze');
  fs.mkdirSync(wyj, { recursive: true });
  execFileSync('python3', ['-I', path.join(__dirname, 'arkusze-zrzutow.py'), KATALOG, wyj], { stdio: 'inherit' });
}

const POWAZNE = (x) => !['maly-cel-dotyku', 'maly-tekst'].includes(x.rodzaj);

(async () => {
  const przegladarka = await chromium.launch();
  const zadania = URZADZENIA.flatMap((u) => MOTYWY.map((motyw) => ({ u, motyw })));
  const zbiorczy = {};
  const robotnik = async () => {
    for (let z = zadania.shift(); z; z = zadania.shift()) {
      const { u, motyw } = z;
      try {
        const { nieudane, bledy, audyt } = await zrzutyUrzadzenia(przegladarka, u, motyw);
        zbiorczy[`${u.nazwa}/${motyw}`] = audyt;
        const usterki = Object.values(audyt).flat().filter(POWAZNE).length;
        console.log(`✓ ${u.nazwa} / ${motyw}: usterek układu ${usterki}${nieudane.length ? ` – nie wyszło: ${nieudane.join('; ')}` : ''}${bledy.length ? ` – błędy strony: ${[...new Set(bledy)].join('; ')}` : ''}`);
      } catch (e) {
        console.log(`✗ ${u.nazwa} / ${motyw}: ${e.message.split('\n')[0]}`);
      }
    }
  };
  await Promise.all(Array.from({ length: ROWNOLEGLE }, robotnik));
  await przegladarka.close();
  fs.mkdirSync(KATALOG, { recursive: true });
  fs.writeFileSync(path.join(KATALOG, 'audyt.json'), JSON.stringify(zbiorczy, null, 1));
  const razem = Object.values(zbiorczy).flatMap((a) => Object.values(a).flat()).filter(POWAZNE).length;
  console.log(`Razem usterek układu (bez małych celów i tekstu): ${razem}`);
  if (!ARG['bez-arkuszy']) arkusze();
})();
