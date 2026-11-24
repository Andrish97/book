// Obrazy z kolumn danych na stronie serii (#418 – wydzielone z js/zlozenie.js, bez Fabric: korzysta z tego też
// kontrola przed drukiem, która działa na zapisanym projekcie).
import { kadrZWartosci, punktKadru } from './pola.js';
import { obrazZNazwy } from './nazwy-obrazow.js';
import { moznaWstawicObraz } from './ksztalty-obrazow.js';

// Obraz z pola: kolumna tabeli podaje nazwę pliku wgranego do projektu.
// Podmieniony obraz wpisuje się w ramkę obrazu-wzoru (ramka_pola), bez zmiany proporcji.
// Nazwa wskazuje obraz według reguły z js/nazwy-obrazow.js (rozszerzenie się liczy).

export function obrazyZPol(obiekty, wartosc, zasoby) {
  return obiekty.map((o) => {
    if (Array.isArray(o.objects)) return { ...o, objects: obrazyZPol(o.objects, wartosc, zasoby) };
    if (o.type !== 'image' && o.pole?.kolumna && moznaWstawicObraz(o)) {
      // Kształt jako ramka obrazu z danych (#123): obraz z kolumny wypełnia kształt; kadr z „Zostaje część zdjęcia”.
      const nazwa = wartosc(o.pole.kolumna, null);
      if (nazwa === undefined) return o;
      const id = obrazZNazwy(zasoby, nazwa)?.id;
      const k = o.pole.kadr_z ? kadrZWartosci(wartosc(o.pole.kadr_z, null)) : null;
      const punkt = k || (o.pole.kadr ? punktKadru(o.pole.kadr) : null);
      const kadr = punkt ? { skala: o.obraz_kadr?.skala || 1, punkt } : o.obraz_kadr;
      return id ? { ...o, zasob: id, obraz_kadr: kadr } : { ...o, zasob: undefined };
    }
    if (o.type !== 'image' || !o.pole?.kolumna) return o;
    const nazwa = wartosc(o.pole.kolumna, null);
    if (nazwa === undefined) return o;
    const id = obrazZNazwy(zasoby, nazwa)?.id;
    const ramka = { w: (o.width || 0) * (o.scaleX ?? 1), h: (o.height || 0) * (o.scaleY ?? 1) };
    // Kadr z kolumny: osobny dla każdego wiersza danych; pusta albo niezrozumiała wartość zostawia ustawienie wzoru.
    const kadr = o.pole.kadr_z ? kadrZWartosci(wartosc(o.pole.kadr_z, null)) : null;
    if (kadr) ramka.kadr = kadr;
    // Rozmiar i przycięcie należały do obrazu-wzoru; podmieniony obraz ma własne.
    const { width, height, cropX, cropY, ...reszta } = o;
    // Brak pliku o tej nazwie: znak „brak obrazu” w miejscu ramki.
    return { ...reszta, zasob: id || 'brak-pliku', ramka_pola: ramka };
  });
}

