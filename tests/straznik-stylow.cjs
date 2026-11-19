// Strażnik stylów (#289, silnik stylów krok 4): wyszukuje na stronie widoczne przyciski, pola, listy i pola tekstowe
// w wyglądzie domyślnym przeglądarki – tło, ramka i zaokrąglenie takie same jak u tego samego elementu w pustej
// ramce bez stylów aplikacji. Taki element nie dostał stylu bazowego ani klasy komponentu (tak było z przyciskami
// w oknie „Sztuczna inteligencja”). Zwraca listę opisów: „gdzie: <tag> #id .klasy „tekst””.

async function sprawdzStyle(strona, gdzie = '') {
  return strona.evaluate((miejsce) => {
    let ramka = document.getElementById('straznik-wzor');
    if (!ramka) {
      ramka = document.createElement('iframe');
      ramka.id = 'straznik-wzor';
      ramka.setAttribute('aria-hidden', 'true');
      ramka.style.cssText = 'position:fixed;left:-10000px;top:0;width:50px;height:50px;border:0';
      document.body.append(ramka);
    }
    const d = ramka.contentDocument;
    const wzory = new Map();
    const KLUCZE = ['backgroundColor', 'borderTopStyle', 'borderTopWidth', 'borderTopColor', 'borderTopLeftRadius', 'backgroundImage'];
    const wzor = (el) => {
      const k = `${el.tagName}:${el.type || ''}`;
      if (!wzory.has(k)) {
        const x = d.createElement(el.tagName);
        if (el.type && el.tagName === 'INPUT') x.type = el.type;
        d.body.append(x);
        const cs = ramka.contentWindow.getComputedStyle(x);
        wzory.set(k, Object.fromEntries(KLUCZE.map((p) => [p, cs[p]])));
      }
      return wzory.get(k);
    };
    const wynik = [];
    for (const el of document.querySelectorAll('button, input, select, textarea')) {
      if (el.type === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const cs = getComputedStyle(el);
      const w = wzor(el);
      // Cały wygląd domyślny albo jego resztki: wypukła ramka przeglądarki („outset”) albo szare tło przycisku
      // przeglądarki przy elemencie, który dostał tylko część stylu.
      const caly = KLUCZE.every((p) => cs[p] === w[p]);
      const resztki = (el.tagName === 'BUTTON' || ['button', 'submit', 'reset'].includes(el.type)) && (cs.borderTopStyle === 'outset' || cs.borderTopStyle === 'inset' || (cs.backgroundColor === w.backgroundColor && cs.backgroundImage === 'none' && w.backgroundColor !== 'rgba(0, 0, 0, 0)'));
      if (caly || resztki) {
        const okno = el.closest('dialog, section[id], [role="dialog"], aside[id], main[id], header[id], div[id]');
        const tekst = (el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        wynik.push(`${miejsce ? `${miejsce}: ` : ''}${okno?.id ? `#${okno.id} ` : ''}<${el.tagName.toLowerCase()}${el.type && el.tagName === 'INPUT' ? ` type=${el.type}` : ''}>${el.id ? ` #${el.id}` : ''}${el.className && typeof el.className === 'string' ? ` .${el.className.trim().split(/\s+/).join('.')}` : ''}${el.dataset.akcja ? ` [${el.dataset.akcja}]` : ''} „${tekst}”`);
      }
    }
    return wynik;
  }, gdzie);
}

module.exports = { sprawdzStyle };
