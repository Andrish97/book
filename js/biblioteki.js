// Duże biblioteki (Excel, ZIP, PDF) wczytują się dopiero wtedy, gdy są potrzebne.
// Adres ma w sobie numer wersji, więc service worker trzyma je w pamięci.

const wczytywane = new Map();

// url – adres skryptu, nazwa – zmienna, którą skrypt zostawia w window,
// opis – czego nie udało się wczytać (do komunikatu, w dopełniaczu).
export function biblioteka(url, nazwa, opis) {
  if (window[nazwa]) return Promise.resolve(window[nazwa]);
  if (!wczytywane.has(url)) {
    wczytywane.set(url, new Promise((ok, blad) => {
      const skrypt = document.createElement('script');
      skrypt.src = url;
      skrypt.onload = () => ok(window[nazwa]);
      skrypt.onerror = () => {
        wczytywane.delete(url);
        skrypt.remove();
        blad(new Error(`Nie udało się wczytać ${opis}. Sprawdź połączenie z internetem.`));
      };
      document.head.append(skrypt);
    }));
  }
  return wczytywane.get(url);
}
