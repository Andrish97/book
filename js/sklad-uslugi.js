/* global fabric */
// Usługa składu (#436): to, co dotąd działało tylko w otwartym edytorze, na zapisie projektu – na serwerze (rysuj.js,
// przeglądarka workera) i w czacie AI w aplikacji. Projekt musi mieć wczytane czcionki i obrazy (przygotuj w rysuj.js
// albo otwarta aplikacja).

import { t as tt } from './jezyk.js';

const doBase64 = async (blob) => {
  const bajty = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
};

// dzialania: [{ rodzaj: 'przelej', watki?: [id] (brak – wszystkie wątki), suchy? }, { rodzaj: 'wysokosci', strony?: [id] },
//   { rodzaj: 'sprawdz' }, { rodzaj: 'podglad', strona, egzemplarz?, szerokosc? (px) }, { rodzaj: 'opis', strona, element? }]
// Zwraca { przelej: [{ watek, zmiany, raport, opis }], wysokosci: [{ strona, id, height }], sprawdz: [uwagi],
//   podglad: { b64, typ, szerokosc, wysokosc }, opis: [...] }. Kolejne działania widzą wynik poprzednich (np. przelanie).
// Brak czcionki (#439, zgłoszenie 26.11 „serwer podstawia zamiennik”): wynik.brakCzcionek = [nazwy]. Przelanie,
// treść z tabel i wysokości wtedy się NIE liczą (pomiar zastępczym krojem dałby podział, który w edytorze się nie
// mieści) – zwracają pusty wynik; podgląd, opis i sprawdzenie liczą się, ale z tą informacją.
const ZALEZNE_OD_POMIARU = new Set(['przelej', 'tresc_z_tabel', 'wysokosci']);
export async function skladaj(p, dzialania = [], { etap = () => {} } = {}) {
  const { rozwin } = await import('./serie.js');
  const wynik = {};
  const { zapewnijCzcionki, brakujaceCzcionki } = await import('./czcionki.js');
  const teksty = [...(p.strony || []), ...(p.wzorce || [])].flatMap((s) => s.obiekty || []);
  await zapewnijCzcionki(teksty);
  const braki = brakujaceCzcionki(p, teksty);
  if (braki.length) wynik.brakCzcionek = braki;
  for (const d of dzialania) {
    etap(`skład: ${d.rodzaj}`);
    if (braki.length && ZALEZNE_OD_POMIARU.has(d.rodzaj)) { wynik[d.rodzaj] = []; continue; }
    if (d.rodzaj === 'przelej') {
      const { przelejWatek, opisRaportu } = await import('./przelewanie.js');
      const { watkiProjektu } = await import('./watki.js');
      const ids = Array.isArray(d.watki) && d.watki.length ? d.watki : [...watkiProjektu(p).keys()];
      wynik.przelej = [];
      for (const w of ids) {
        const { zmiany, raport } = await przelejWatek(p, w, { suchy: Boolean(d.suchy) });
        wynik.przelej.push({ watek: w, zmiany, raport, opis: opisRaportu(w, raport) });
      }
    } else if (d.rodzaj === 'tresc_z_tabel') {
      // Treść z tabeli (#432) po zmianie danych – wpisy ułożone od nowa (strony z nowym tekstem).
      const { odswiezTekstyZTabel } = await import('./tekst-z-tabeli.js');
      const strony = await odswiezTekstyZTabel(p);
      // Nowe treści ramek na zmienionych stronach (łącznik zapisuje je w tej samej wersji co zmianę danych).
      wynik.tresc_z_tabel = strony.flatMap((id) => (p.strony.find((s) => s.id === id)?.obiekty || []).filter((o) => o?.type === 'textbox')
        .map((o) => ({ strona: id, id: o.id, pola: { text: o.text, styles: o.styles, lacznik: o.lacznik, lista_start: o.lista_start, z_tabeli: o.z_tabeli } })));
    } else if (d.rodzaj === 'wysokosci') {
      // Ramki rosnące z tekstem: wysokość po złożeniu (zapis bywa nieaktualny – #431).
      const strony = p.strony.filter((s) => !d.strony?.length || d.strony.includes(s.id));
      const json = strony.flatMap((s) => (s.obiekty || []).filter((o) => o?.type === 'textbox' && !(o.ramka_h > 0)).map((o) => ({ s, o })));
      const { zapewnijCzcionki } = await import('./czcionki.js');
      await zapewnijCzcionki(json.map((x) => x.o));
      const zywe = json.length ? await fabric.util.enlivenObjects(json.map((x) => JSON.parse(JSON.stringify(x.o)))) : [];
      wynik.wysokosci = [];
      zywe.forEach((z, i) => {
        z.initDimensions();
        if (Math.abs((json[i].o.height || 0) - z.height) > 0.01) {
          json[i].o.height = z.height;
          wynik.wysokosci.push({ strona: json[i].s.id, id: z.id, height: z.height });
        }
      });
    } else if (d.rodzaj === 'sprawdz') {
      const { sprawdzWszystko } = await import('./kontrola-skladu.js');
      wynik.sprawdz = (await sprawdzWszystko(p)).map((u) => ({ rodzaj: u.rodzaj, opis: u.opis, strony: u.strony, idObiektu: u.idObiektu, idStrony: u.idStrony }));
    } else if (d.rodzaj === 'podglad') {
      const ciag = rozwin(p);
      const egz = ciag.egzemplarze.filter((e) => e.strona?.id === d.strona);
      const e = egz[Math.max(0, Math.min(egz.length - 1, (Number(d.egzemplarz) || 1) - 1))];
      if (!e) throw new Error(tt('kod.brakStrony', { strona: d.strona ?? '' }));
      const { renderujCel } = await import('./zlozenie.js');
      const szer = Math.min(1600, Math.max(200, Number(d.szerokosc) || 700));
      const url = await renderujCel(p, e, { szerokoscPx: szer, spad: false, ciag, oryginaly: false });
      const blob = await (await fetch(url)).blob();
      const w = e.sekcja.wydruk;
      wynik.podglad = { b64: await doBase64(blob), typ: blob.type || 'image/png', szerokosc: szer, wysokosc: Math.round((szer * w.wysokosc_mm) / w.szerokosc_mm) };
    } else if (d.rodzaj === 'opis') {
      // Lekki odczyt: teksty strony (albo jeden element) po złożeniu – tekst, liczba wierszy, czy się mieści.
      const ciag = rozwin(p);
      const egz = ciag.egzemplarze.find((e) => e.strona?.id === d.strona);
      if (!egz) throw new Error(tt('kod.brakStrony', { strona: d.strona ?? '' }));
      const { tekstyEgzemplarza } = await import('./zlozenie.js');
      const { nieMiesciSie } = await import('./tekst-ramka.js');
      wynik.opis = (await tekstyEgzemplarza(p, egz, ciag, { wszystkie: true, ...(d.element ? { tylko: new Set([d.element]) } : {}) }))
        .filter((x) => !d.element || x.id === d.element)
        .map(({ obiekt: o, id, zrodlo }) => ({ id, zrodlo, nazwa: o.nazwa || '', tekst: String(o.text || '').slice(0, 2000), wierszy: o._textLines?.length || 0, miesciSie: !nieMiesciSie(o), wysokosc: Math.round((o._wysokoscTresci ?? o.height) * 100) / 100, ramka_h: o.ramka_h || null, watek: o.watek || null }));
    }
  }
  return wynik;
}
