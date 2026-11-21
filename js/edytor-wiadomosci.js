// Edytor treści wiadomości w skrzynce panelu administratora (#183): własny, lekki, bez bibliotek z CDN
// (wcześniej TinyMCE z jsDelivr). Pole contenteditable z paskiem: cofnij/ponów, akapit/nagłówek/cytat,
// pogrubienie, kursywa, podkreślenie, przekreślenie, kolor, listy, link, usuń formatowanie.
// API jak to, którego używała skrzynka: getContent({ format: 'text' }), setContent, focus, remove, on('input').
// Wklejany HTML przechodzi przez czyszczenie (bez skryptów, styli, klas, zdarzeń) – zostaje prosta struktura.
import { t as tt } from './jezyk.js';

const DOZWOLONE = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'DIV', 'SPAN', 'FONT', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'PRE', 'CODE', 'HR', 'IMG', 'SUB', 'SUP']);
const ATRYBUTY = { A: ['href', 'title', 'target', 'rel'], IMG: ['src', 'alt', 'width', 'height'], FONT: ['color'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };
const BEZPIECZNY_ADRES = /^(https?:|mailto:|tel:|cid:|#|\/)/i;

// Czyści HTML do prostej, bezpiecznej struktury (używane przy wklejaniu i ustawianiu treści).
export function wyczyscHtml(html) {
  const dok = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  const przejdz = (wezel) => {
    for (const el of [...wezel.children]) {
      if (!DOZWOLONE.has(el.tagName)) {
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|TEXTAREA|SELECT|META|LINK|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) { el.remove(); continue; }
        przejdz(el);
        el.replaceWith(...el.childNodes); // nieznany znacznik – zostaje jego treść
        continue;
      }
      const dozwolone = ATRYBUTY[el.tagName] || [];
      const kolor = el.style?.color;
      for (const a of [...el.attributes]) if (!dozwolone.includes(a.name.toLowerCase())) el.removeAttribute(a.name);
      if (kolor && el.tagName === 'SPAN') el.style.color = kolor; // kolor tekstu z paska zostaje
      for (const n of ['href', 'src']) if (el.hasAttribute(n) && !BEZPIECZNY_ADRES.test(el.getAttribute(n).trim())) el.removeAttribute(n);
      if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
      przejdz(el);
    }
  };
  przejdz(dok.body);
  return dok.body.innerHTML;
}

const PRZYCISKI = [
  ['cofnij', 'Cofnij (Ctrl+Z)', () => document.execCommand('undo')],
  ['ponow', 'Ponów (Ctrl+Y)', () => document.execCommand('redo')],
  '|',
  ['pogrubienie', 'Pogrubienie (Ctrl+B)', () => document.execCommand('bold'), 'bold'],
  ['kursywa', 'Kursywa (Ctrl+I)', () => document.execCommand('italic'), 'italic'],
  ['podkreslenie', 'Podkreślenie (Ctrl+U)', () => document.execCommand('underline'), 'underline'],
  ['przekreslenie', 'Przekreślenie', () => document.execCommand('strikeThrough'), 'strikeThrough'],
  '|',
  ['lista', 'Lista punktowana', () => document.execCommand('insertUnorderedList'), 'insertUnorderedList'],
  ['listaNumerowana', 'Lista numerowana', () => document.execCommand('insertOrderedList'), 'insertOrderedList'],
  ['cytat', 'Cytat', () => document.execCommand('formatBlock', false, 'blockquote')],
  ['link', 'Link', null],
  '|',
  ['gumka', 'Usuń formatowanie', () => { document.execCommand('removeFormat'); document.execCommand('unlink'); document.execCommand('formatBlock', false, 'p'); }],
];

const SVG = {
  cofnij: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  ponow: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  pogrubienie: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  kursywa: '<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>',
  podkreslenie: '<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>',
  przekreslenie: '<path d="M5 12h14"/><path d="M16.5 7.5C16 5.6 14.3 5 12 5c-2.8 0-4.5 1.3-4.5 3.2 0 1.5 1 2.4 3 3"/><path d="M8 16.5c.6 1.7 2.2 2.5 4.3 2.5 2.8 0 4.5-1.3 4.5-3.2 0-.8-.2-1.4-.7-1.9"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  listaNumerowana: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5h1.5V9M3.5 9h3.5"/><path d="M3.5 14.5c0-1 .8-1.5 1.6-1.5S6.8 13.5 6.8 14.4c0 1.2-3.3 2.4-3.3 4.1H7"/>',
  cytat: '<path d="M7 7h4v5c0 2.5-1.5 4-4 5"/><path d="M14 7h4v5c0 2.5-1.5 4-4 5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  gumka: '<path d="m16 4 4 4-9.5 9.5H6.5L4 15z"/><path d="M9 20h11"/>',
};
const ikona = (n) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[n] || ''}</svg>`;

// Tworzy edytor w miejsce elementu `cel` (zwykle <textarea>, który zostaje ukryty).
// zapytaj(tytul, etykieta, wartosc) – okno pytania o adres linku (Promise<string|null>).
export function utworzEdytorWiadomosci(cel, { zapytaj = async (t, e, w) => window.prompt(e, w) } = {}) {
  const ramka = document.createElement('div');
  ramka.className = 'edytor-wiadomosci';
  const pasek = document.createElement('div');
  pasek.className = 'edytor-wiadomosci-pasek';
  pasek.setAttribute('role', 'toolbar');
  pasek.setAttribute('aria-label', tt('edytorWiadomosci.formatowanieWiadomosci'));
  const styl = document.createElement('select');
  styl.className = 'edytor-wiadomosci-styl';
  styl.setAttribute('aria-label', tt('edytorWiadomosci.stylAkapitu'));
  styl.innerHTML = `<option value="p">${tt('edytorWiadomosci.akapit')}</option><option value="h2">${tt('edytorWiadomosci.naglowek')}</option><option value="h3">${tt('edytorWiadomosci.podtytul')}</option><option value="blockquote">${tt('edytorWiadomosci.cytat')}</option><option value="pre">Kod</option>`;
  const tresc = document.createElement('div');
  tresc.className = 'edytor-wiadomosci-tresc';
  tresc.contentEditable = 'true';
  tresc.setAttribute('role', 'textbox');
  tresc.setAttribute('aria-multiline', 'true');
  tresc.setAttribute('aria-label', cel.getAttribute('aria-label') || tt('edytorWiadomosci.trescWiadomosci'));
  tresc.spellcheck = true;
  tresc.lang = 'pl';

  const sluchacze = new Map();
  const fire = (n, e = {}) => { for (const fn of sluchacze.get(n) || []) fn(e); };
  const zmiana = () => fire('input');

  let zaznaczenie = null;
  const zapamietaj = () => {
    const sel = window.getSelection();
    if (sel.rangeCount && tresc.contains(sel.anchorNode)) zaznaczenie = sel.getRangeAt(0).cloneRange();
  };
  const przywroc = () => {
    tresc.focus();
    if (!zaznaczenie) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(zaznaczenie);
  };
  document.addEventListener('selectionchange', () => { zapamietaj(); odswiezStan(); });

  const przyciski = [];
  pasek.append(styl);
  for (const p of PRZYCISKI) {
    if (p === '|') { const k = document.createElement('span'); k.className = 'kreska'; pasek.append(k); continue; }
    const [nazwa, opis, fn, stan] = p;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk-ikona';
    b.title = opis;
    b.setAttribute('aria-label', opis);
    b.dataset.polecenie = nazwa;
    if (stan) b.setAttribute('aria-pressed', 'false');
    b.innerHTML = ikona(nazwa);
    // mousedown bez utraty zaznaczenia w treści
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', async () => {
      przywroc();
      if (nazwa === 'link') {
        const adres = await zapytaj('Link', 'Adres (https://…, mailto:…)', 'https://');
        przywroc();
        if (!adres || !BEZPIECZNY_ADRES.test(adres.trim())) return;
        if (window.getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${adres.trim().replace(/"/g, '&quot;')}">${adres.trim().replace(/</g, '&lt;')}</a>`);
        else document.execCommand('createLink', false, adres.trim());
        tresc.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
      } else fn();
      zmiana();
      odswiezStan();
    });
    if (stan) przyciski.push([b, stan]);
    pasek.append(b);
  }
  const kolor = document.createElement('input');
  kolor.type = 'color';
  kolor.value = '#1c1b19';
  kolor.className = 'edytor-wiadomosci-kolor';
  kolor.title = tt('edytorWiadomosci.kolorTekstu');
  kolor.setAttribute('aria-label', tt('edytorWiadomosci.kolorTekstu'));
  kolor.addEventListener('input', () => { przywroc(); document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, kolor.value); document.execCommand('styleWithCSS', false, false); zmiana(); });
  pasek.insertBefore(kolor, pasek.querySelector('[data-polecenie="lista"]').previousSibling);
  styl.addEventListener('change', () => { przywroc(); document.execCommand('formatBlock', false, styl.value); zmiana(); });

  function odswiezStan() {
    if (!tresc.contains(window.getSelection().anchorNode)) return;
    for (const [b, polecenie] of przyciski) {
      let w = false;
      try { w = document.queryCommandState(polecenie); } catch { /* starsze przeglądarki */ }
      b.setAttribute('aria-pressed', String(Boolean(w)));
    }
    let blok = window.getSelection().anchorNode;
    while (blok && blok !== tresc && !/^(P|H2|H3|BLOCKQUOTE|PRE)$/.test(blok.nodeName)) blok = blok.parentNode;
    styl.value = blok && blok !== tresc ? blok.nodeName.toLowerCase() : 'p';
  }

  tresc.addEventListener('input', zmiana);
  tresc.addEventListener('keyup', zmiana);
  tresc.addEventListener('keydown', (e) => fire('keydown', e));
  tresc.addEventListener('paste', (e) => {
    const html = e.clipboardData?.getData('text/html');
    const tekst = e.clipboardData?.getData('text/plain');
    if (!html && !tekst) return;
    e.preventDefault();
    const wstaw = html ? wyczyscHtml(html) : tekst.replace(/[&<>]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[z])).replace(/\r?\n/g, '<br>');
    document.execCommand('insertHTML', false, wstaw);
    zmiana();
  });
  // Pusty edytor: zawsze co najmniej akapit, żeby Enter tworzył akapity, nie <div>.
  document.execCommand('defaultParagraphSeparator', false, 'p');

  ramka.append(pasek, tresc);
  cel.style.display = 'none';
  cel.after(ramka);

  return {
    id: cel.id,
    element: ramka,
    tresc,
    getContent: ({ format } = {}) => (format === 'text' ? tresc.innerText.replace(/\n{3,}/g, '\n\n').trim() : tresc.innerHTML),
    setContent: (html) => { tresc.innerHTML = wyczyscHtml(html) || '<p><br></p>'; },
    focus: () => {
      tresc.focus();
      const sel = window.getSelection();
      const r = document.createRange();
      r.setStart(tresc.firstChild || tresc, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    },
    on(nazwy, fn) { for (const n of nazwy.split(/\s+/)) sluchacze.set(n, [...(sluchacze.get(n) || []), fn]); },
    remove() { ramka.remove(); cel.style.display = ''; },
  };
}
