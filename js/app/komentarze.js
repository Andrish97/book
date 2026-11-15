// Komentarze na stronach (#131D) – panel, pinezki na płótnie i w podglądzie, dodawanie, wątki, wzmianki.
//
// Gdzie (#140, #142): narzędzie „Komentarz” na pasku narzędzi (kliknij miejsce na stronie albo zaznacz element),
// panel „Komentarze” – przycisk z licznikiem na górnym pasku edytora i w podglądzie (na telefonie w menu ⋯),
// pinezki z numerami na stronie. Osoby „może oglądać” komentują w podglądzie.
// Dane: js/komentarze-chmura.js (osobna tabela – komentarze nie zmieniają projektu ani jego wersji).

import { $, $$, powiadom, potwierdz, kiedy } from '../ui.js';
import * as km from '../komentarze-chmura.js';
import { osobyProjektu } from '../wspolpraca-chmura.js';
import { edytor, stan } from './kontekst.js';
import { naPlotnie } from './zapis.js';
import { przejdzDoStrony } from './lista-stron.js';

const dlg = $('#dlg-komentarze');
const lista = $('#lista-komentarzy');
const pusto = $('#komentarze-pusto');
const forma = $('#nowy-komentarz');
const poleNowego = $('#nowy-komentarz-tresc');

let projektId = null;
let komentarze = [];
let filtr = 'otwarte';
let otwartyWatek = null;
let szkic = null; // { strona, element, x, y, opis }
let tryb = false; // narzędzie „Komentarz”: następne kliknięcie na stronie dodaje komentarz
let osoby = []; // nazwy osób projektu (do wzmianek)
let wczytywanie = null;

const naKomputerze = () => window.matchMedia('(pointer: fine)').matches && window.innerWidth > 860;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
const watki = () => komentarze.filter((k) => !k.watek);
const odpowiedzi = (id) => komentarze.filter((k) => k.watek === id);
const numery = () => new Map(watki().map((k, i) => [k.id, i + 1]));
const wPodgladzie = () => document.body.dataset.ekran === 'podglad';

function strona(id) { return stan.projekt?.strony.find((s) => s.id === id) || null; }
function wymiaryStrony(id) {
  const s = strona(id);
  const w = stan.projekt?.sekcje.find((x) => x.id === s?.sekcja)?.wydruk;
  return { w: w?.szerokosc_mm || 148, h: w?.wysokosc_mm || 210 };
}
function nazwaStrony(id) {
  const p = stan.projekt;
  const i = p ? p.strony.findIndex((s) => s.id === id) : -1;
  return i < 0 ? 'strona usunięta' : `Strona ${i + 1}${p.strony[i].nazwa ? ` „${p.strony[i].nazwa}”` : ''}`;
}
function opisElementu(st, id) {
  const o = st?.obiekty?.find((x) => x.id === id);
  if (!o) return 'element';
  if (/text/i.test(o.type)) return `tekst „${String(o.text || '').replace(/\s+/g, ' ').slice(0, 30)}${String(o.text || '').length > 30 ? '…' : ''}”`;
  return ({ rect: 'prostokąt', ellipse: 'elipsa', image: 'obraz', group: 'grupa', line: 'linia', path: 'kształt', polygon: 'wielokąt' })[String(o.type).toLowerCase()] || 'element';
}

// Treść z wyróżnionymi wzmiankami.
function trescHtml(t) {
  return esc(t).replace(/(^|\s)@([A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{2,40})/g, '$1<span class="wzmianka">@$2</span>').replace(/\n/g, '<br>');
}

// ---------- Dane ----------

async function wczytaj() {
  if (!projektId || !stan.uzytkownik) return;
  const id = projektId;
  wczytywanie = km.komentarzeProjektu(id).then((w) => {
    if (id !== projektId) return;
    komentarze = w;
    odswiez();
  }).catch(() => { /* projekt jeszcze nie na koncie albo brak sieci – spróbujemy przy następnej okazji */ });
  return wczytywanie;
}

function odswiez() {
  const ile = watki().filter((k) => !k.rozwiazany).length;
  for (const l of $$('.licznik-komentarzy')) { l.textContent = String(ile); l.hidden = !ile; }
  if (dlg.open) pokazListe();
  rysujPinezki();
  pinezkiPodgladu();
}

export function wlaczKomentarze(projekt) {
  if (projekt?.id === projektId) return;
  projektId = projekt?.id || null;
  komentarze = [];
  osoby = [];
  otwartyWatek = null;
  szkic = null;
  ustawTryb(false);
  odswiez();
  if (!projektId || !stan.uzytkownik) { km.przestanSluchacKomentarzy(); if (dlg.open) dlg.close(); return; }
  wczytaj();
  km.sluchajKomentarzy(projektId, () => wczytaj()).catch(() => {});
  odswiezOsoby();
}

// Osoby projektu do podpowiedzi @wzmianek – przy każdym otwarciu panelu i nowym komentarzu (dochodzą nowe osoby).
function odswiezOsoby() {
  const id = projektId;
  if (!id) return;
  osobyProjektu(id).then((l) => { if (id === projektId) osoby = l.filter((o) => o.nazwa && o.typ !== 'zaproszenie' && !o.ja).map((o) => o.nazwa); }).catch(() => {});
}

document.addEventListener('seriodruk:projekt', (e) => wlaczKomentarze(e.detail));
// Nowy projekt trafia na konto dopiero po pierwszym zapisie – wtedy komentarze zaczynają działać.
document.addEventListener('seriodruk:zapisano-na-koncie', () => { if (projektId && !komentarze.length) wczytaj(); });

// ---------- Panel ----------

export async function otworzKomentarze({ watek = null } = {}) {
  if (!stan.projekt) return;
  if (!stan.uzytkownik) { powiadom('Komentarze są dostępne po zalogowaniu.', true); return; }
  if (!dlg.open) {
    dlg.classList.toggle('obok-strony', naKomputerze());
    if (naKomputerze()) dlg.show(); else dlg.showModal();
  }
  if (watek) { otwartyWatek = watek; filtr = 'wszystkie'; }
  odswiezOsoby();
  await (wczytywanie || wczytaj());
  pokazListe();
  if (watek) idzDo(watek);
}

function pokazListe() {
  for (const b of $$('.filtry-komentarzy [data-filtr]', dlg)) b.setAttribute('aria-pressed', String(b.dataset.filtr === filtr));
  const nr = numery();
  const ja = stan.uzytkownik?.id;
  const wlasciciel = !stan.projekt?.wspolpraca_chmury;
  const widoczne = watki().filter((k) => (filtr === 'wszystkie' ? true
    : filtr === 'moje' ? (k.autor === ja && k.zrodlo === 'konto') || odpowiedzi(k.id).some((o) => o.autor === ja) || (k.wzmianki || []).includes(ja)
      : !k.rozwiazany));
  pusto.hidden = widoczne.length > 0;
  pusto.textContent = komentarze.length
    ? 'Brak komentarzy w tym widoku.'
    : 'Nie ma jeszcze komentarzy. Wybierz „Nowy komentarz” albo narzędzie „Komentarz” i kliknij miejsce na stronie.';
  lista.replaceChildren(...widoczne.map((k) => {
    const li = document.createElement('li');
    li.className = `watek-komentarza${k.rozwiazany ? ' rozwiazany' : ''}${otwartyWatek === k.id ? ' otwarty' : ''}`;
    li.dataset.id = k.id;
    const st = strona(k.strona_id);
    const gdzie = `${nazwaStrony(k.strona_id)}${k.element_id ? ` · ${opisElementu(st, k.element_id)}` : ''}`;
    const odp = odpowiedzi(k.id);
    const mozeUsunac = (k.moj || wlasciciel);
    li.innerHTML = `<button type="button" class="naglowek-watku" data-op="otworz">
        <span class="numer-pinezki">${nr.get(k.id)}</span>
        <span class="opis-watku"><strong>${esc(k.autor_nazwa)}${k.zrodlo === 'ai' ? ' <small class="plakietka-ai">AI</small>' : ''}</strong><small>${esc(gdzie)} · ${esc(kiedy(k.utworzono))}</small></span>
        ${k.rozwiazany ? '<span class="stan-watku">rozwiązany</span>' : ''}${odp.length ? `<span class="licznik">${odp.length}</span>` : ''}
      </button>
      <p class="tresc-komentarza">${trescHtml(k.tresc)}</p>
      <div class="szczegoly-watku">
        <ol class="odpowiedzi">${odp.map((o) => `<li data-id="${o.id}"><strong>${esc(o.autor_nazwa)}${o.zrodlo === 'ai' ? ' <small class="plakietka-ai">AI</small>' : ''}</strong> <small>${esc(kiedy(o.utworzono))}</small>${o.moj || wlasciciel ? '<button type="button" class="przycisk-ikona maly" data-op="usun-odp" data-ikona="kosz" data-rozmiar="14" aria-label="Usuń odpowiedź" title="Usuń odpowiedź"></button>' : ''}<p>${trescHtml(o.tresc)}</p></li>`).join('')}</ol>
        <div class="odpowiedz-komentarz">
          <textarea rows="2" maxlength="4000" placeholder="Odpowiedz… (@nazwa wspomina osobę)" aria-label="Odpowiedź"></textarea>
          <div class="podpowiedzi-wzmianek" hidden></div>
        </div>
        <div class="akcje-watku">
          <button type="button" class="przycisk maly" data-op="pokaz" data-ikona="oko">Pokaż na stronie</button>
          <button type="button" class="przycisk maly" data-op="rozwiaz" data-ikona="${k.rozwiazany ? 'cofnij' : 'ok'}">${k.rozwiazany ? 'Otwórz ponownie' : 'Rozwiąż'}</button>
          ${mozeUsunac ? '<button type="button" class="przycisk-ikona maly niebezpieczny-ikona" data-op="usun" data-ikona="kosz" aria-label="Usuń wątek" title="Usuń wątek"></button>' : ''}
          <span class="odstep"></span>
          <button type="button" class="przycisk maly glowny" data-op="odpowiedz">Odpowiedz</button>
        </div>
      </div>`;
    return li;
  }));
  import('../ikony.js').then((m) => m.wstawIkony(lista)).catch(() => {});
}

async function idzDo(id) {
  const k = komentarze.find((x) => x.id === id);
  if (!k) return;
  otwartyWatek = id;
  for (const li of $$('.watek-komentarza', lista)) li.classList.toggle('otwarty', li.dataset.id === id);
  if (wPodgladzie()) {
    document.querySelector(`#podglad-tresc .podglad-strona[data-strona="${CSS.escape(k.strona_id || '')}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    pinezkiPodgladu();
  } else if (document.body.dataset.ekran === 'edytor') {
    const i = stan.projekt.strony.findIndex((s) => s.id === k.strona_id);
    if (i >= 0 && (stan.tryb !== 'strona' || !(naPlotnie?.strony || []).includes(k.strona_id))) await przejdzDoStrony(i);
    if (k.element_id && edytor.canvas.getObjects().some((o) => o.id === k.element_id)) edytor.zaznacz(k.element_id);
    rysujPinezki();
  }
  if (!naKomputerze() && dlg.open && !wPodgladzie()) { /* na telefonie zasłonka zostaje – strona widoczna nad nią */ }
  lista.querySelector(`.watek-komentarza[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}

lista.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-op]');
  const li = e.target.closest('.watek-komentarza');
  if (!b || !li) return;
  const id = li.dataset.id;
  const op = b.dataset.op;
  try {
    if (op === 'otworz') {
      if (otwartyWatek === id) { otwartyWatek = null; li.classList.remove('otwarty'); rysujPinezki(); return; }
      await idzDo(id);
    } else if (op === 'pokaz') {
      await idzDo(id);
      if (!naKomputerze()) dlg.close();
    } else if (op === 'rozwiaz') {
      const k = komentarze.find((x) => x.id === id);
      await km.rozwiazKomentarz(id, !k?.rozwiazany);
      await wczytaj();
    } else if (op === 'usun') {
      if (!await potwierdz('Usunąć wątek?', 'Komentarz i wszystkie odpowiedzi znikną dla wszystkich osób w projekcie.', 'Usuń', true)) return;
      await km.usunKomentarz(id);
      await wczytaj();
    } else if (op === 'usun-odp') {
      await km.usunKomentarz(b.closest('li[data-id]').dataset.id);
      await wczytaj();
    } else if (op === 'odpowiedz') {
      const pole = li.querySelector('.odpowiedz-komentarz textarea');
      const tresc = pole.value.trim();
      if (!tresc) { pole.focus(); return; }
      b.disabled = true;
      await km.dodajKomentarz({ projekt: projektId, tresc, watek: id });
      pole.value = '';
      otwartyWatek = id;
      await wczytaj();
    }
  } catch (err) {
    powiadom(`Nie udało się: ${err.message || err}`, true);
  } finally {
    b.disabled = false;
  }
});

for (const b of $$('.filtry-komentarzy [data-filtr]', dlg)) {
  b.addEventListener('click', () => { filtr = b.dataset.filtr; pokazListe(); });
}
$('#komentarze-zamknij').addEventListener('click', () => dlg.close());
dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.matches(':modal')) { e.preventDefault(); dlg.close(); } });
dlg.addEventListener('close', () => { if (!tryb) szkic = null; forma.hidden = true; rysujPinezki(); });
$('#komentarze-nowy').addEventListener('click', () => {
  ustawTryb(true);
  if (!naKomputerze()) dlg.close();
});

// ---------- Wzmianki (@nazwa) ----------

function podpowiedziWzmianek(pole) {
  const box = pole.parentElement.querySelector('.podpowiedzi-wzmianek') || pole.closest('form, .odpowiedz-komentarz')?.querySelector('.podpowiedzi-wzmianek');
  if (!box) return;
  const przed = pole.value.slice(0, pole.selectionStart);
  const m = /(^|\s)@([^\s@]*)$/.exec(przed);
  const pasujace = m ? osoby.filter((n) => n.toLowerCase().startsWith(m[2].toLowerCase())).slice(0, 6) : [];
  box.hidden = !pasujace.length;
  box.replaceChildren(...pasujace.map((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-biblioteki';
    b.textContent = `@${n}`;
    b.addEventListener('mousedown', (ev) => ev.preventDefault());
    b.addEventListener('click', () => {
      const poczatek = przed.length - m[2].length - 1;
      pole.value = `${pole.value.slice(0, poczatek)}@${n} ${pole.value.slice(pole.selectionStart)}`;
      const kursor = poczatek + n.length + 2;
      pole.setSelectionRange(kursor, kursor);
      box.hidden = true;
      pole.focus();
    });
    return b;
  }));
}
dlg.addEventListener('input', (e) => { if (e.target.matches('textarea')) podpowiedziWzmianek(e.target); });

// ---------- Nowy komentarz ----------

function pokazSzkic() {
  if (!szkic) return;
  if (!dlg.open) {
    dlg.classList.toggle('obok-strony', naKomputerze());
    if (naKomputerze()) dlg.show(); else dlg.showModal();
  }
  odswiezOsoby();
  pokazListe();
  forma.hidden = false;
  $('#nowy-komentarz-gdzie').textContent = `Nowy komentarz: ${szkic.opis}`;
  poleNowego.value = '';
  poleNowego.focus();
  rysujPinezki();
  pinezkiPodgladu();
}

forma.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tresc = poleNowego.value.trim();
  if (!tresc || !szkic) { poleNowego.focus(); return; }
  const przycisk = $('#nowy-komentarz-dodaj');
  przycisk.disabled = true;
  try {
    const k = await km.dodajKomentarz({ projekt: projektId, strona: szkic.strona, element: szkic.element, x: szkic.x, y: szkic.y, tresc });
    szkic = null;
    forma.hidden = true;
    otwartyWatek = k?.id || null;
    if (filtr === 'moje' || filtr === 'otwarte') { /* nowy wątek jest otwarty i mój – widać go w obu */ }
    await wczytaj();
  } catch (err) {
    powiadom(`Nie udało się dodać komentarza: ${err.message || err}`, true);
  } finally {
    przycisk.disabled = false;
  }
});
$('#nowy-komentarz-anuluj').addEventListener('click', () => { szkic = null; forma.hidden = true; rysujPinezki(); pinezkiPodgladu(); });
poleNowego.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) forma.requestSubmit(); });

function szkicZPunktu(stronaId, x, y, elementId = null) {
  const st = strona(stronaId);
  szkic = {
    strona: stronaId, element: elementId, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
    opis: `${nazwaStrony(stronaId)}${elementId ? ` · ${opisElementu(st, elementId)}` : ''}`,
  };
  ustawTryb(false);
  pokazSzkic();
}

// Narzędzie „Komentarz”: zaznaczony element – komentarz od razu przy nim; inaczej czeka na kliknięcie strony.
export function narzedzieKomentarz() {
  if (!stan.projekt) return;
  if (!stan.uzytkownik) { powiadom('Komentarze są dostępne po zalogowaniu.', true); return; }
  if (tryb) { ustawTryb(false); return; }
  if (!wPodgladzie()) {
    if (stan.tryb !== 'strona') { powiadom('Komentarze dodaje się na stronach – wróć ze wzorca do stron.', true); return; }
    const akt = edytor.aktywny;
    if (akt && !akt.zWzorca && akt.type !== 'activeSelection' && akt.id) {
      const c = akt.getCenterPoint();
      const i = edytor.stronaW(c.x);
      const id = naPlotnie?.strony?.[i];
      if (id) { szkicZPunktu(id, c.x - edytor.strony[i].x, c.y, akt.id); return; }
    }
  }
  ustawTryb(true);
}

function ustawTryb(wl) {
  tryb = Boolean(wl);
  for (const b of $$('[data-akcja="komentarz"]')) b.setAttribute('aria-pressed', String(tryb));
  document.body.classList.toggle('tryb-komentarza', tryb);
  if (tryb) powiadom(wPodgladzie() ? 'Kliknij miejsce na stronie, którego dotyczy komentarz (Esc – anuluj).' : 'Kliknij miejsce albo element na stronie, którego dotyczy komentarz (Esc – anuluj).');
}

document.addEventListener('keydown', (e) => { if (tryb && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); ustawTryb(false); } }, true);

// Kliknięcie na płótnie w trybie komentarza.
function podlaczPlotno() {
  const c = edytor.canvas;
  if (!c || c._komentarze) return;
  c._komentarze = true;
  c.on('mouse:down', (opt) => {
    if (!tryb || wPodgladzie()) return;
    const p = opt.scenePoint || c.getScenePoint?.(opt.e) || c.getPointer(opt.e);
    const i = edytor.stronaW(p.x);
    const id = naPlotnie?.strony?.[i];
    if (!id) return;
    const cel = opt.target && !opt.target.zWzorca && opt.target.id ? opt.target : null;
    setTimeout(() => c.discardActiveObject().requestRenderAll(), 0);
    szkicZPunktu(id, p.x - edytor.strony[i].x, p.y, cel?.id || null);
  });
  let ramka = 0;
  c.on('after:render', () => { if (!ramka) ramka = requestAnimationFrame(() => { ramka = 0; rysujPinezki(); }); });
}

// ---------- Pinezki na płótnie ----------

function warstwaPlotna() {
  const arkusz = $('#kontener-plotna .arkusz');
  if (!arkusz) return null;
  let w = arkusz.querySelector('.pinezki-komentarzy');
  if (!w) {
    w = document.createElement('div');
    w.className = 'pinezki-komentarzy';
    w.addEventListener('click', (e) => {
      const p = e.target.closest('[data-watek]');
      if (p) otworzKomentarze({ watek: p.dataset.watek });
    });
    arkusz.append(w);
  }
  return w;
}

function rysujPinezki() {
  if (edytor?.canvas) podlaczPlotno();
  const w = warstwaPlotna();
  if (!w) return;
  const na = stan.tryb === 'strona' ? (naPlotnie?.strony || []) : [];
  if (!projektId || !edytor?.canvas || !na.length || document.body.dataset.ekran !== 'edytor') { w.replaceChildren(); return; }
  const c = edytor.canvas;
  const v = c.viewportTransform;
  const plotno = c.upperCanvasEl.getBoundingClientRect();
  const baza = w.parentElement.getBoundingClientRect();
  const dx = plotno.left - baza.left;
  const dy = plotno.top - baza.top;
  const nr = numery();
  const punkty = [];
  for (const k of watki()) {
    if (k.rozwiazany && otwartyWatek !== k.id) continue;
    const i = na.indexOf(k.strona_id);
    if (i < 0) continue;
    let sx = edytor.strony[i].x + (k.x ?? 10);
    let sy = k.y ?? 10;
    const o = k.element_id && c.getObjects().find((x) => x.id === k.element_id);
    if (o) { const r = o.getBoundingRect(); sx = r.left + r.width; sy = r.top; } // współrzędne sceny (mm)
    punkty.push({ k, x: dx + sx * v[0] + v[4], y: dy + sy * v[3] + v[5] });
  }
  if (szkic && na.includes(szkic.strona)) {
    const i = na.indexOf(szkic.strona);
    punkty.push({ szkic: true, x: dx + (edytor.strony[i].x + szkic.x) * v[0] + v[4], y: dy + szkic.y * v[3] + v[5] });
  }
  w.replaceChildren(...punkty.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pinezka-komentarza${p.szkic ? ' szkic' : ''}${p.k?.rozwiazany ? ' rozwiazany' : ''}${p.k && otwartyWatek === p.k.id ? ' wybrana' : ''}`;
    b.style.left = `${Math.round(p.x)}px`;
    b.style.top = `${Math.round(p.y)}px`;
    if (p.k) {
      b.dataset.watek = p.k.id;
      b.textContent = String(nr.get(p.k.id));
      b.title = `${p.k.autor_nazwa}: ${p.k.tresc.slice(0, 80)}`;
      b.setAttribute('aria-label', `Komentarz ${nr.get(p.k.id)}: ${p.k.tresc.slice(0, 80)}`);
    } else {
      b.textContent = '+';
      b.setAttribute('aria-label', 'Nowy komentarz');
    }
    return b;
  }));
}

// ---------- Pinezki w podglądzie ----------

export function pinezkiPodgladu() {
  const korzen = $('#podglad-tresc');
  if (!korzen) return;
  for (const p of $$('.pinezka-komentarza', korzen)) p.remove();
  if (!projektId || !wPodgladzie() || document.body.classList.contains('podglad-publiczny')) return;
  const nr = numery();
  const juz = new Set();
  const punkty = watki().filter((k) => !k.rozwiazany || otwartyWatek === k.id).map((k) => ({ k }));
  if (szkic) punkty.push({ szkic });
  for (const p of punkty) {
    const s = p.k || p.szkic;
    const fig = korzen.querySelector(`.podglad-strona[data-strona="${CSS.escape(s.strona_id || s.strona || '')}"] .podglad-kartka`);
    if (!fig) continue;
    const { w, h } = wymiaryStrony(s.strona_id || s.strona);
    let x = s.x ?? 10;
    let y = s.y ?? 10;
    if (p.k?.element_id) {
      const o = strona(p.k.strona_id)?.obiekty?.find((ob) => ob.id === p.k.element_id);
      if (o) { x = (o.left || 0) + (o.width || 0) * Math.abs(o.scaleX ?? 1); y = o.top || 0; }
    }
    const b = document.createElement('span');
    b.className = `pinezka-komentarza${p.szkic ? ' szkic' : ''}${p.k?.rozwiazany ? ' rozwiazany' : ''}${p.k && otwartyWatek === p.k.id ? ' wybrana' : ''}`;
    b.style.left = `${Math.max(0, Math.min(100, (x / w) * 100))}%`;
    b.style.top = `${Math.max(0, Math.min(100, (y / h) * 100))}%`;
    if (p.k) {
      if (juz.has(p.k.id)) continue;
      juz.add(p.k.id);
      b.dataset.watek = p.k.id;
      b.textContent = String(nr.get(p.k.id));
      b.title = `${p.k.autor_nazwa}: ${p.k.tresc.slice(0, 80)}`;
      b.setAttribute('role', 'button');
    } else b.textContent = '+';
    fig.append(b);
  }
}

// Podgląd: kliknięcie pinezki otwiera wątek; w trybie komentarza – kliknięcie strony zaczyna nowy komentarz
// (przed kliknięciem „edytuj tę stronę”).
$('#podglad-tresc')?.addEventListener('click', (e) => {
  const pin = e.target.closest('.pinezka-komentarza[data-watek]');
  if (pin) { e.preventDefault(); e.stopPropagation(); otworzKomentarze({ watek: pin.dataset.watek }); return; }
  if (!tryb || !wPodgladzie()) return;
  const kartka = e.target.closest('.podglad-kartka');
  const fig = kartka?.closest('.podglad-strona[data-strona]');
  if (!fig) return;
  e.preventDefault();
  e.stopPropagation();
  const r = kartka.getBoundingClientRect();
  const { w, h } = wymiaryStrony(fig.dataset.strona);
  szkicZPunktu(fig.dataset.strona, ((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h);
}, true);

// Podgląd buduje strony od nowa (zoom, zmiana projektu) – pinezki wracają po każdym przebudowaniu.
{
  const korzen = $('#podglad-tresc');
  let ramka = 0;
  if (korzen) {
    new MutationObserver(() => {
      if (!ramka) ramka = requestAnimationFrame(() => { ramka = 0; pinezkiPodgladu(); });
    }).observe(korzen, { childList: true });
  }
}
