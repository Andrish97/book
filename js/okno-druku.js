// Okno „Drukuj w domu” (decyzja #145): wydruk na zwykłej drukarce – strona na kartce, broszura do złożenia,
// 2 albo 4 strony na kartce; papier A4/A3/Letter; bez spadu. „Drukuj” składa gotowy, ułożony PDF i otwiera
// systemowe okno drukowania (ukryta ramka z plikiem); na telefonie, gdzie to nie działa, plik otwiera się
// w nowej karcie (Udostępnij → Drukuj). Pomoc krok po kroku: druk dwustronny, test na jednej kartce, 100%.
// Ustawienia zapamiętuje się dla projektu (localStorage).

import { $, pobierz, powiadom, bezpiecznaNazwa } from './ui.js';
import { rozwin } from './serie.js';
import { zlozPdf, wybierzEgzemplarze } from './eksport.js';
import { opisPlanu, planImpozycji } from './impozycja.js';
import { pokazPlanArkuszy } from './okno-pdf.js';
import { postep } from './postep.js';

const KLUCZ = (id) => `makietka:druk:${id}`;
const POLA = ['uklad', 'papier', 'dopasowanie', 'zakres', 'szarosc', 'znaki'];

// Opcje okna → opcje składania PDF (zlozPdf).
export function opcjeDruku(o) {
  const broszura = o.uklad === 'broszura';
  return {
    tryb: 'wektor', spad: false, nawigacja: false, uszlachetnienia: 'pomin',
    uklad: o.uklad || 'jedna', formatArkusza: o.papier || 'A4', powieksz: o.dopasowanie === 'dopasuj',
    znaki: broszura && o.znaki ? 'sekcje' : false,
  };
}

// Telefon i tablet: drukowanie z ukrytej ramki zwykle nie działa – plik otwiera się w nowej karcie.
const ramkaNieDziala = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || document.documentElement.dataset.urzadzenie === 'telefon';

// Drukowanie gotowego pliku: ukryta ramka i systemowe okno drukowania przeglądarki.
export function drukujPlik(url) {
  if (window.seriodruk?.drukujTestowo) return window.seriodruk.drukujTestowo(url); // testy: bez okna drukarki
  if (ramkaNieDziala()) {
    window.open(url, '_blank');
    powiadom('Plik otworzył się w nowej karcie – wybierz tam Udostępnij → Drukuj.');
    return;
  }
  document.querySelector('#ramka-druku')?.remove();
  const ramka = Object.assign(document.createElement('iframe'), { id: 'ramka-druku', src: url, title: 'Wydruk' });
  ramka.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  ramka.addEventListener('load', () => {
    try { ramka.contentWindow.focus(); ramka.contentWindow.print(); } catch {
      window.open(url, '_blank');
      powiadom('Plik otworzył się w nowej karcie – wydrukuj go stamtąd (Ctrl+P).');
    }
  }, { once: true });
  document.body.append(ramka);
}

// Krótka pomoc z rysunkami: dwustronnie (krótsza krawędź), bez dupleksu, test na jednej kartce, 100%, składanie.
function pomoc(uklad) {
  const broszura = uklad === 'broszura';
  const kartka = (x, txt) => `<g transform="translate(${x} 6)"><rect width="46" height="32" rx="2" class="kartka"/><text x="23" y="21" text-anchor="middle">${txt}</text></g>`;
  const krok = (svg, tekst) => `<li>${svg ? `<svg viewBox="0 0 110 44" aria-hidden="true">${svg}</svg>` : ''}<span>${tekst}</span></li>`;
  return `<ol class="druk-kroki">${[
    krok('', 'Najpierw wydrukuj <b>jedną kartkę na próbę</b> (w oknie drukarki: strony 1–2) i sprawdź, czy strony stoją dobrze.'),
    krok('', 'W oknie drukarki ustaw skalę <b>Rzeczywisty rozmiar / 100%</b> (nie „Dopasuj”), żeby wymiary się zgadzały.'),
    broszura
      ? krok(`${kartka(4, '8 | 1')}<path d="M52 22h7m-3-3 3 3-3 3" class="strzalka"/>${kartka(62, '2 | 7')}`, 'Broszura: drukuj <b>dwustronnie, obracanie po krótszej krawędzi</b> (kartka leży poziomo). Na odwrocie kartki 1 są strony 2 i 7.')
      : krok('', uklad === 'jedna' ? 'Dwustronnie: obracanie po <b>dłuższej</b> krawędzi (kartka pionowo).' : 'Dwustronnie: kartka z kilkoma stronami leży poziomo – obracanie po <b>krótszej</b> krawędzi.'),
    krok(`${kartka(4, '1 3 5')}<path d="M52 22h7m-3-3 3 3-3 3" class="strzalka"/><g transform="translate(62 6)"><rect width="46" height="32" rx="2" class="kartka"/><path d="M8 26c6-14 24-14 30 0" class="strzalka"/><text x="23" y="14" text-anchor="middle">2 4 6</text></g>`,
      'Drukarka bez druku dwustronnego: wydrukuj najpierw <b>tylko strony nieparzyste</b>, włóż stos z powrotem (zadrukowaną stroną zgodnie z instrukcją drukarki), potem <b>parzyste</b>.'),
    broszura ? krok('<path d="M8 8h40v28H8zM28 8v28" class="kartka"/><path d="M62 22h40M82 10v24" class="strzalka"/>', 'Złóż kartki razem na pół (pierwsza kartka na wierzchu), wyrównaj i <b>zszyj w zgięciu</b> (2 zszywki). Grubą broszurę podziel na składki po kilka kartek.') : '',
    broszura ? krok('', 'Jeśli wybrałeś znaki cięcia, po zszyciu przytnij brzegi wzdłuż znaków (nożykiem przy linijce albo w punkcie ksero).') : '',
  ].join('')}</ol>`;
}

export class OknoDruku {
  constructor({ projekt, biezacaStrona, przedDrukiem }) {
    this.zrodlo = { projekt, biezacaStrona, przedDrukiem };
    this.okno = $('#dlg-druk');
    this.f = $('#form-druk');
    this.f.addEventListener('change', () => { this.zapamietaj(); this.odswiez(); });
    this.f.addEventListener('input', (e) => { if (e.target.type === 'number') this.odswiez(); });
    this.f.addEventListener('submit', (e) => { e.preventDefault(); this.wykonaj(true); });
    $('#druk-pobierz').addEventListener('click', () => this.wykonaj(false));
    for (const b of this.okno.querySelectorAll('[data-akcja="druk-zamknij"]')) b.addEventListener('click', () => this.okno.close());
  }

  otworz() {
    this.zrodlo.przedDrukiem?.();
    const p = this.zrodlo.projekt();
    this.ciag = rozwin(p);
    const ile = this.ciag.egzemplarze.length;
    const { od, do: doStrony } = this.f.elements;
    od.max = ile; doStrony.max = ile; od.value = 1; doStrony.value = ile;
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
    return { uklad: e.uklad.value, papier: e.papier.value, dopasowanie: e.dopasowanie.value, zakres: e.zakres.value, szarosc: e.szarosc.checked, znaki: e.znaki.checked, od: Number(e.od.value), do: Number(e.do.value) };
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
    $('#druk-pole-znaki').hidden = o.uklad !== 'broszura';
    const egz = this.egzemplarze(o);
    const plan = { uklad: o.uklad, skladka: 16 };
    const kartek = o.uklad === 'broszura' ? planImpozycji(egz.length, plan).strony.length / 2 : planImpozycji(egz.length, plan).strony.length;
    this.kartek = kartek;
    $('#druk-opis').textContent = o.uklad === 'jedna'
      ? `${egz.length} ${egz.length === 1 ? 'strona' : 'stron'} na ${o.papier}, ${o.dopasowanie === 'dopasuj' ? 'dopasowane do kartki' : 'w rzeczywistym rozmiarze (zmniejszone tylko, gdy się nie mieszczą)'}.`
      : `${opisPlanu(egz.length, plan)} Papier ${o.papier}.`;
    pokazPlanArkuszy($('#druk-plan'), egz, plan);
    $('#druk-pomoc-tresc').innerHTML = pomoc(o.uklad);
  }

  async wykonaj(drukuj) {
    if (this.trwa) return;
    const o = this.opcje();
    const egz = this.egzemplarze(o);
    if (!egz.length) { $('#druk-komunikat').textContent = 'W wybranym zakresie nie ma stron.'; return; }
    this.trwa = true;
    const przyciski = this.okno.querySelectorAll('.przyciski-dialogu button');
    przyciski.forEach((b) => { b.disabled = true; });
    const pasek = postep('Składanie pliku do druku…', { razem: egz.length });
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
      $('#druk-komunikat').textContent = `Nie udało się przygotować wydruku: ${e.message}`;
    } finally {
      pasek.koniec();
      przyciski.forEach((b) => { b.disabled = false; });
      this.trwa = false;
    }
  }
}
