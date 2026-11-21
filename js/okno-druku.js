// Okno „Drukuj w domu” (decyzja #145): wydruk na zwykłej drukarce – strona na kartce, broszura do złożenia,
// 2 albo 4 strony na kartce; papier A4/A3/Letter; bez spadu. „Drukuj” składa gotowy, ułożony PDF i otwiera
// systemowe okno drukowania (ukryta ramka z plikiem); na telefonie, gdzie to nie działa, plik otwiera się
// w nowej karcie (Udostępnij → Drukuj). Pomoc krok po kroku: druk dwustronny, test na jednej kartce, 100%.
// Ustawienia zapamiętuje się dla projektu (localStorage).

import { $, pobierz, powiadom, bezpiecznaNazwa } from './ui.js';
import { rozwin } from './serie.js';
import { zlozPdf, wybierzEgzemplarze, ustawPreferencjeDruku, PDFLIB_URL } from './eksport.js';
import { opisPlanu, planImpozycji, wymiaryArkusza, ARKUSZE } from './impozycja.js';
import { biblioteka } from './biblioteki.js';
import { pokazPlanArkuszy } from './okno-pdf.js';
import { postep } from './postep.js';
import { wypelnijSekcje, wybraneSekcje, uwagaZakresu } from './zakres-eksportu.js';
import { t as tt } from './jezyk.js';

const KLUCZ = (id) => `makietka:druk:${id}`;
const POLA = ['uklad', 'papier', 'dopasowanie', 'zakres', 'szarosc', 'znaki'];

// Opcje okna → opcje składania PDF (zlozPdf).
export function opcjeDruku(o) {
  const broszura = o.uklad === 'broszura';
  return {
    tryb: 'wektor', spad: false, nawigacja: false, uszlachetnienia: 'pomin',
    uklad: o.uklad || 'jedna', formatArkusza: o.papier || 'A4', powieksz: o.dopasowanie === 'dopasuj',
    znaki: broszura && o.znaki ? 'sekcje' : false,
    ustawieniaDruku: { dwustronnie: 'auto' }, // skala 100% i dupleks zapisane w pliku (#187)
  };
}

// Telefon i tablet: drukowanie z ukrytej ramki zwykle nie działa – plik otwiera się w nowej karcie.
const ramkaNieDziala = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || document.documentElement.dataset.urzadzenie === 'telefon';

// Drukowanie gotowego pliku: ukryta ramka i systemowe okno drukowania przeglądarki.
export function drukujPlik(url) {
  if (window.seriodruk?.drukujTestowo) return window.seriodruk.drukujTestowo(url); // testy: bez okna drukarki
  if (ramkaNieDziala()) {
    window.open(url, '_blank');
    powiadom(tt('oknoDruku.plikOtworzylSieW2'));
    return;
  }
  document.querySelector('#ramka-druku')?.remove();
  const ramka = Object.assign(document.createElement('iframe'), { id: 'ramka-druku', src: url, title: tt('oknoDruku.wydruk') });
  ramka.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  ramka.addEventListener('load', () => {
    try { ramka.contentWindow.focus(); ramka.contentWindow.print(); } catch {
      window.open(url, '_blank');
      powiadom(tt('oknoDruku.plikOtworzylSieW'));
    }
  }, { once: true });
  document.body.append(ramka);
}

// Strona próbna (#187): linijki 100 mm w poziomie i w pionie, kwadrat 50 mm i ramki 3, 5 i 10 mm od brzegu.
// Po wydruku linijka przyłożona do linijki pokazuje, czy drukarka nie zmienia skali, a ramki – ile
// przy brzegu kartki drukarka zostawia niezadrukowane. Same liczby (czcionka wbudowana PDF nie ma polskich liter).
export async function stronaProbnaPdf(papier = 'A4') {
  const PDFLib = await biblioteka(PDFLIB_URL, 'PDFLib', 'modułu PDF');
  const PT = 72 / 25.4;
  const [W, H] = ARKUSZE[papier] || ARKUSZE.A4;
  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle('Makietka - strona probna');
  pdf.setCreator('Makietka');
  const s = pdf.addPage([W * PT, H * PT]);
  const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const czarny = PDFLib.rgb(0, 0, 0); const szary = PDFLib.rgb(0.45, 0.45, 0.45);
  // Współrzędne w mm od lewego górnego rogu.
  const linia = (x1, y1, x2, y2, grubosc = 0.25, kolor = czarny) => s.drawLine({ start: { x: x1 * PT, y: (H - y1) * PT }, end: { x: x2 * PT, y: (H - y2) * PT }, thickness: grubosc, color: kolor });
  const tekst = (t, x, y, rozmiar = 7, kolor = czarny) => s.drawText(t, { x: x * PT, y: (H - y) * PT, size: rozmiar, font, color: kolor });
  for (const m of [3, 5, 10]) {
    s.drawRectangle({ x: m * PT, y: m * PT, width: (W - 2 * m) * PT, height: (H - 2 * m) * PT, borderColor: m === 5 ? czarny : szary, borderWidth: 0.4, borderDashArray: m === 3 ? [2, 2] : undefined });
    tekst(`${m} mm`, W / 2 - 4 + (m - 5) * 6, m + 3.2, 6, m === 5 ? czarny : szary);
  }
  const x0 = (W - 100) / 2; const y0 = H / 2 - 40;
  for (let i = 0; i <= 100; i += 1) {
    const d = i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5;
    linia(x0 + i, y0, x0 + i, y0 + d);
    linia(x0, y0 + 20 + i, x0 + d, y0 + 20 + i);
    if (i % 10 === 0) {
      tekst(String(i / 10), x0 + i - 1, y0 + 9.5, 7);
      if (i) tekst(String(i / 10), x0 + 8, y0 + 21.2 + i, 7);
    }
  }
  linia(x0, y0, x0 + 100, y0, 0.4); linia(x0, y0 + 20, x0, y0 + 120, 0.4);
  tekst('100 mm', x0 + 42, y0 + 15, 9);
  s.drawRectangle({ x: (x0 + 40) * PT, y: (H - (y0 + 90)) * PT, width: 50 * PT, height: 50 * PT, borderColor: czarny, borderWidth: 0.5 });
  tekst('50 x 50 mm', x0 + 51, y0 + 66, 9);
  tekst('Makietka', x0, y0 + 132, 8, szary);
  ustawPreferencjeDruku(PDFLib, pdf);
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

// Krótka pomoc z rysunkami: dwustronnie (krótsza krawędź), bez dupleksu, test na jednej kartce, 100%, składanie.
function pomoc(uklad) {
  const broszura = uklad === 'broszura';
  const kartka = (x, txt) => `<g transform="translate(${x} 6)"><rect width="46" height="32" rx="2" class="kartka"/><text x="23" y="21" text-anchor="middle">${txt}</text></g>`;
  const krok = (svg, tekst) => `<li>${svg ? `<svg viewBox="0 0 110 44" aria-hidden="true">${svg}</svg>` : ''}<span>${tekst}</span></li>`;
  return `<ol class="druk-kroki">${[
    krok('', 'Najpierw wydrukuj <b>jedną kartkę na próbę</b> (w oknie drukarki: strony 1–2) i sprawdź, czy strony stoją dobrze.'),
    broszura
      ? krok(`${kartka(4, '8 | 1')}<path d="M52 22h7m-3-3 3 3-3 3" class="strzalka"/>${kartka(62, '2 | 7')}`, 'Broszura: drukuj <b>dwustronnie, obracanie po krótszej krawędzi</b> (kartka leży poziomo). Na odwrocie kartki 1 są strony 2 i 7.')
      : krok('', uklad === 'jedna' ? 'Dwustronnie: obracanie po <b>dłuższej</b> krawędzi (kartka pionowo).' : 'Dwustronnie: kartka z kilkoma stronami leży poziomo – obracanie po <b>krótszej</b> krawędzi.'),
    krok(`${kartka(4, '1 3 5')}<path d="M52 22h7m-3-3 3 3-3 3" class="strzalka"/><g transform="translate(62 6)"><rect width="46" height="32" rx="2" class="kartka"/><path d="M8 26c6-14 24-14 30 0" class="strzalka"/><text x="23" y="14" text-anchor="middle">2 4 6</text></g>`,
      'Drukarka bez druku dwustronnego: wydrukuj najpierw <b>tylko strony nieparzyste</b>, włóż stos z powrotem (zadrukowaną stroną zgodnie z instrukcją drukarki), potem <b>parzyste</b>.'),
    broszura ? krok('<path d="M8 8h40v28H8zM28 8v28" class="kartka"/><path d="M62 22h40M82 10v24" class="strzalka"/>', 'Złóż kartki razem na pół (pierwsza kartka na wierzchu), wyrównaj i <b>zszyj w zgięciu</b> (2 zszywki). Grubą broszurę podziel na składki po kilka kartek.') : '',
    broszura ? krok('', 'Jeśli wybrałeś znaki cięcia, po zszyciu przytnij brzegi wzdłuż znaków (nożykiem przy linijce albo w punkcie ksero).') : '',
  ].join('')}</ol>`;
}

// Ile strona zmieni się na kartce: drukarka nie zadrukuje kilku mm przy brzegu, więc strona o rozmiarze
// kartki jest lekko zmniejszona (5 mm marginesu) – lepiej to powiedzieć wprost niż dać się zaskoczyć (#187).
function opisSkali(egz, plan, o) {
  const w = egz[0]?.sekcja?.wydruk;
  if (!w) return '';
  const p = planImpozycji(egz.length, plan).strony[0];
  const a = wymiaryArkusza(w.szerokosc_mm, w.wysokosc_mm, p.kolumny, p.wiersze, { format: o.papier, znaki: false, powieksz: o.dopasowanie === 'dopasuj' });
  const proc = Math.round(a.skala * 100);
  if (proc === 100) return '';
  return proc < 100
    ? tt('oknoDruku.stronyBedaZmniejszoneDo', { proc })
    : tt('oknoDruku.stronyBedaPowiekszoneDo', { proc });
}

export class OknoDruku {
  constructor({ projekt, biezacaStrona, przedDrukiem }) {
    this.zrodlo = { projekt, biezacaStrona, przedDrukiem };
    this.okno = $('#dlg-druk');
    this.f = $('#form-druk');
    this.f.addEventListener('change', () => { this.zapamietaj(); this.odswiez(); });
    this.f.addEventListener('input', (e) => { if (e.target.type === 'number' || e.target.name === 'strony') this.odswiez(); });
    this.f.addEventListener('submit', (e) => { e.preventDefault(); this.wykonaj(true); });
    $('#druk-pobierz').addEventListener('click', () => this.wykonaj(false));
    $('#druk-probna').addEventListener('click', async () => {
      try { drukujPlik(URL.createObjectURL(await stronaProbnaPdf(this.opcje().papier))); } catch (e) { $('#druk-komunikat').textContent = e.message; }
    });
    for (const b of this.okno.querySelectorAll('[data-akcja="druk-zamknij"]')) b.addEventListener('click', () => this.okno.close());
  }

  otworz() {
    this.zrodlo.przedDrukiem?.();
    const p = this.zrodlo.projekt();
    this.ciag = rozwin(p);
    const ile = this.ciag.egzemplarze.length;
    // Zakres (#312): wybrane sekcje (na start – sekcja bieżącej strony) i strony jak w Wordzie.
    const biezaca = p.strony.find((x) => x.id === this.zrodlo.biezacaStrona?.());
    wypelnijSekcje($('#druk-lista-sekcji'), p, this.ciag, [biezaca?.sekcja || p.sekcje[0]?.id].filter(Boolean));
    if (!this.f.elements.strony.value.trim()) this.f.elements.strony.value = ile > 1 ? `1-${ile}` : '1';
    let zapisane = {};
    try { zapisane = JSON.parse(localStorage.getItem(KLUCZ(p.id)) || '{}'); } catch { /* bez zapamiętanych ustawień */ }
    for (const k of POLA) {
      const el = this.f.elements[k];
      if (!el || zapisane[k] === undefined) continue;
      if (el.type === 'checkbox') el.checked = Boolean(zapisane[k]); else el.value = zapisane[k];
    }
    $('#druk-komunikat').textContent = '';
    this.odswiez();
    if (!this.okno.open) this.okno.showModal();
  }

  opcje() {
    const e = this.f.elements;
    return { uklad: e.uklad.value, papier: e.papier.value, dopasowanie: e.dopasowanie.value, zakres: e.zakres.value, szarosc: e.szarosc.checked, znaki: e.znaki.checked, strony: e.strony.value, sekcje: wybraneSekcje($('#druk-lista-sekcji')) };
  }

  zapamietaj() {
    const o = this.opcje();
    try { localStorage.setItem(KLUCZ(this.zrodlo.projekt().id), JSON.stringify(Object.fromEntries(POLA.map((k) => [k, o[k]])))); } catch { /* bez pamięci */ }
  }

  egzemplarze(o = this.opcje()) {
    if (o.zakres === 'biezaca') {
      const id = this.zrodlo.biezacaStrona?.();
      const i = this.ciag.egzemplarze.findIndex((x) => x.strona.id === id);
      return i >= 0 ? [this.ciag.egzemplarze[i]] : this.ciag.egzemplarze.slice(0, 1);
    }
    return wybierzEgzemplarze(this.ciag, o);
  }

  odswiez() {
    const o = this.opcje();
    $('#druk-pole-strony').hidden = o.zakres !== 'strony';
    $('#druk-pole-sekcje').hidden = o.zakres !== 'sekcje';
    $('#druk-pole-znaki').hidden = o.uklad !== 'broszura';
    const egz = this.egzemplarze(o);
    const plan = { uklad: o.uklad, skladka: 16 };
    const kartek = o.uklad === 'broszura' ? planImpozycji(egz.length, plan).strony.length / 2 : planImpozycji(egz.length, plan).strony.length;
    this.kartek = kartek;
    $('#druk-opis').textContent = o.uklad === 'jedna'
      ? `${egz.length} ${egz.length === 1 ? 'strona' : 'stron'} na ${o.papier}, ${o.dopasowanie === 'dopasuj' ? 'dopasowane do kartki' : 'w rzeczywistym rozmiarze (zmniejszone tylko, gdy się nie mieszczą)'}.`
      : tt('oknoDruku.papier', { opisPlanu: opisPlanu(egz.length, plan), papier: o.papier });
    $('#druk-skala').textContent = opisSkali(egz, plan, o);
    const uwagaStron = o.zakres === 'strony' ? uwagaZakresu(o.strony, this.ciag.egzemplarze.length) : null;
    if (uwagaStron) $('#druk-opis').textContent = `${uwagaStron} ${$('#druk-opis').textContent}`;
    pokazPlanArkuszy($('#druk-plan'), egz, plan);
    $('#druk-pomoc-tresc').innerHTML = pomoc(o.uklad);
  }

  async wykonaj(drukuj) {
    if (this.trwa) return;
    const o = this.opcje();
    const egz = this.egzemplarze(o);
    if (!egz.length) { $('#druk-komunikat').textContent = tt('oknoDruku.wWybranymZakresieNie'); return; }
    this.trwa = true;
    const przyciski = this.okno.querySelectorAll('.przyciski-dialogu button');
    przyciski.forEach((b) => { b.disabled = true; });
    const pasek = postep(tt('oknoDruku.skladaniePlikuDoDruku'), { razem: egz.length });
    try {
      this.zrodlo.przedDrukiem?.();
      const p = this.zrodlo.projekt();
      const projekt = o.szarosc ? { ...p, tryb_kolorow: 'szarosc', tryb_wymuszony: 'szarosc' } : p; // także sekcje z własnym trybem (#167)
      const blob = await zlozPdf(projekt, egz, { ...opcjeDruku(o), ciag: this.ciag, postep: (n) => pasek.krok(n, egz.length) });
      const url = URL.createObjectURL(blob);
      if (drukuj) {
        this.okno.close();
        drukujPlik(url);
      } else {
        pobierz(`${bezpiecznaNazwa(p.nazwa)} - do druku.pdf`, url);
      }
      this.ostatni = { blob, url };
    } catch (e) {
      $('#druk-komunikat').textContent = tt('oknoDruku.nieUdaloSiePrzygotowac', { message: e.message });
    } finally {
      pasek.koniec();
      przyciski.forEach((b) => { b.disabled = false; });
      this.trwa = false;
    }
  }
}
