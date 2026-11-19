// Porównanie wyliczonych stylów (silnik stylów, #291): na tej samej stronie, w tym samym stanie, styl każdego
// widocznego elementu z bieżącymi arkuszami i z innym zestawem arkuszy (np. starym css/aplikacja.css z gita).
// Bez szumu zrzutów (godziny, animacje, losowe tokeny) – różnica to zawsze inna reguła. Zwraca listę różnic
// „element: właściwość: przed → po”.

const WLASCIWOSCI = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'order',
  'color', 'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color', 'border-bottom-width', 'border-left-width',
  'border-right-width', 'border-bottom-color', 'border-top-left-radius', 'border-bottom-right-radius', 'box-shadow', 'opacity', 'visibility', 'overflow-x', 'overflow-y',
  'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'z-index', 'transform', 'cursor', 'outline-style'];

async function stylyStrony(strona) {
  return strona.evaluate((W) => {
    const wynik = {};
    const sciezka = (el) => {
      const cz = [];
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
        cz.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}:${i}`);
      }
      return cz.join('>');
    };
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') && el.tagName !== 'svg') continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' && !el.matches('[hidden], dialog:not([open])')) { wynik[sciezka(el)] = 'display:none'; continue; }
      if (cs.display === 'none') continue;
      wynik[sciezka(el)] = W.map((p) => cs.getPropertyValue(p)).join('|');
    }
    return wynik;
  }, WLASCIWOSCI);
}

// Podmiana arkuszy: wyłącza <link> aplikacji (poza czcionkami) i wstawia podany tekst CSS – albo przywraca.
async function podmienArkusze(strona, css) {
  await strona.evaluate((tekst) => {
    // media zamiast disabled: ponowne włączenie przez disabled = false stosuje arkusz z opóźnieniem.
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) if (!/czcionki/.test(l.href) && l.id !== 'bez-przejsc') l.media = tekst !== null ? 'not all' : 'all';
    document.getElementById('porownanie-stylow')?.remove();
    if (tekst !== null) { const s = document.createElement('style'); s.id = 'porownanie-stylow'; s.textContent = tekst; document.getElementById('bez-przejsc').before(s); }
  }, css);
  await strona.evaluate(() => new Promise((ok) => { requestAnimationFrame(() => requestAnimationFrame(ok)); }));
}

async function porownajStyle(strona, innyCss, gdzie = '') {
  // Bez przejść i animacji – inaczej kolory łapane w połowie przejścia po zmianie arkuszy albo motywu.
  await strona.evaluate(() => {
    if (document.getElementById('bez-przejsc')) return;
    const st = document.createElement('style');
    st.id = 'bez-przejsc';
    st.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.append(st);
  });
  const teraz = await stylyStrony(strona);
  await podmienArkusze(strona, innyCss);
  const inne = await stylyStrony(strona);
  await podmienArkusze(strona, null);
  const roznice = [];
  for (const [k, v] of Object.entries(teraz)) {
    const s = inne[k];
    if (s === undefined || s === v) continue;
    if (v === 'display:none' || s === 'display:none') { roznice.push(`${gdzie} ${k}: widoczność ${s} → ${v}`); continue; }
    const a = s.split('|'); const b = v.split('|');
    const r = WLASCIWOSCI.map((p, i) => (a[i] !== b[i] ? `${p}: ${a[i]} → ${b[i]}` : null)).filter(Boolean);
    if (r.length) roznice.push(`${gdzie} ${k}: ${r.join('; ')}`);
  }
  return roznice;
}

module.exports = { porownajStyle, podmienArkusze, stylyStrony };
