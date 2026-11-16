// Obrazy w czasie ładowania (#193): zamiast pustego miejsca, napisu alt albo systemowej ikonki „zepsutego
// obrazu” – migoczące tło (CSS: img:not(.zaladowany)). Załadowany obraz dostaje klasę „zaladowany”; obraz,
// który się nie wczytał – spokojny zastępczy rysunek (szara ramka z ikoną obrazka) i klasę „blad-obrazu”.
// Jeden mechanizm dla całej aplikacji: podgląd, link, karty projektów, miniatury stron, obrazy, biblioteka.

const ZASTEPCZY = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#ecebe7"/><g fill="none" stroke="#a8a49b" stroke-width="3" stroke-linejoin="round"><rect x="38" y="27" width="44" height="36" rx="4"/><path d="M42 58l12-12 9 9 6-6 9 9"/></g><circle cx="70" cy="37" r="4" fill="#a8a49b"/></svg>')}`;

function oznacz(img) {
  if (!(img instanceof window.HTMLImageElement)) return;
  if (img.complete && img.naturalWidth > 0) img.classList.add('zaladowany');
}

export function wlaczLadowanieObrazow(korzen = document) {
  korzen.addEventListener('load', (e) => {
    const img = e.target;
    if (img instanceof window.HTMLImageElement) { img.classList.add('zaladowany'); if (img.src !== ZASTEPCZY) img.classList.remove('blad-obrazu'); }
  }, true);
  korzen.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof window.HTMLImageElement) || !img.getAttribute('src') || img.src === ZASTEPCZY) return;
    img.classList.add('blad-obrazu');
    img.src = ZASTEPCZY; // po wczytaniu zastępczego dostaje „zaladowany” – bez migotania
  }, true);
  // Obraz wczytany z pamięci, zanim trafił do dokumentu (zdarzenie load poszło obok) – oznaczamy po wstawieniu.
  document.querySelectorAll('img').forEach(oznacz);
  new MutationObserver((zmiany) => {
    for (const z of zmiany) {
      if (z.type === 'attributes') { if (z.target.tagName === 'IMG') { z.target.classList.remove('zaladowany'); oznacz(z.target); } continue; }
      for (const w of z.addedNodes) {
        if (w.nodeType !== 1) continue;
        if (w.tagName === 'IMG') oznacz(w); else if (w.firstElementChild) w.querySelectorAll('img').forEach(oznacz);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}
