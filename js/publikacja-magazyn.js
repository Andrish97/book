// Publikacja linku do podglądu – wspólna dla aplikacji (wysyłka przez worker z sesją właściciela) i dla rysowania
// na serwerze (#335, worker zapisuje wprost do R2). Bez zależności od reszty aplikacji: magazyn podaje wywołujący.
//
// magazyn: {
//   czytajOpis(folder) → manifest (obiekt) albo null,
//   wyslij(klucz, blob, { cache }) – zapis pliku w buckecie podglądów,
//   lista(folder) → [klucze] – pliki folderu (z prefiksem „folder/”),
//   usun(klucze),
// }

import { kolejnoscStron } from './prace-w-tle.js';

// Obrazy stron linku: WebP albo JPEG (dawne linki) – rozszerzenie zapisane w opisie (manifest.rozszerzenie).
export const typZRozszerzenia = (r) => (r === 'webp' ? 'image/webp' : 'image/jpeg');

export async function skrotPliku(plik) {
  const bajty = new Uint8Array(await crypto.subtle.digest('SHA-256', await plik.arrayBuffer()));
  return [...bajty].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Publikacja obrazów stron do folderu linku (zwykły link: <konto>/<projekt>/<kod>; link z ochroną:
// <konto>/<projekt>/<kod>.<sekret>, #97). pelna: wszystkie strony od nowa. chroniony: pliki tylko w pamięci prywatnej.
// Udostępnianie w tle (#204): opis podglądu (manifest) zapisuje się od razu i co kilka sekund w trakcie –
// link działa natychmiast, a strony pojawiają się u oglądającego po kolei („przygotowanie” – brakuje stron).
// naLink() – wywołane po pierwszym zapisie opisu (link już działa).
// odciski: { idStrony: odcisk tego, co na stronie widać } (publikacja-linku.js odciskStrony).
//
// Pliki według treści, nie według miejsca (#438, A2): obraz strony ma nazwę od swojego odcisku („o-<odcisk>”),
// a opis linku mówi tylko, który plik pokazać na której stronie (manifest.pliki: { idStrony: nazwa }). Strona,
// której odcisk już jest w folderze (ta sama strona albo inna – np. dzień serii przesunięty o jedno miejsce),
// nie jest ani rysowana, ani wysyłana. Bez odcisków nazwą jest skrót samego obrazu („p-<skrót>”). Dawne linki
// (bez manifest.pliki) mają pliki „<idStrony>.<rozszerzenie>” – te też są używane, dopóki pasują.
// Strona jest jednostką atomową: plik zapisany → wpis w opisie; opis zapisuje się w całości (jeden obiekt).
// Praca w tle (#438, etap C): przedStrona() – wywoływane przed każdą stroną; zwraca true, gdy trzeba przerwać
// (nowsza wersja projektu, praca odebrana). Przerwana publikacja zapisuje opis z tym, co już gotowe (link działa,
// następna praca rysuje tylko brakujące strony) i nie usuwa plików. ogladane – id stron rysowanych najpierw;
// potem zmienione, brakujące i reszta (js/prace-w-tle.js kolejnoscStron).
// Zwraca { zaktualizowano, wyslane, wszystkie, narysowane, przerwane }.
export async function publikujDoMagazynu(magazyn, folder, uklad, strony, obraz, postep, odciski, { rozszerzenie = 'jpg', pelna = false, chroniony = false, naLink = null, przedStrona = null, ogladane = [] } = {}) {
  let poprzednie = {};
  let poprzednieTresci = {};
  let poprzedniePliki = {};
  if (!pelna) {
    try {
      const m = await magazyn.czytajOpis(folder);
      // Inny format obrazów niż poprzednio (np. dawny link w JPEG) – wszystkie strony od nowa.
      if (m && (m.rozszerzenie || 'jpg') === rozszerzenie) {
        poprzednie = m.skroty || {};
        poprzednieTresci = m.tresci || {};
        // Dawny opis bez „pliki”: plik strony nazywa się jak strona.
        poprzedniePliki = m.pliki || Object.fromEntries(Object.keys(poprzednie).map((id) => [id, id]));
      }
    } catch { /* pierwsza publikacja albo brak sieci – wyślemy wszystko */ }
  }
  // Pliki już w folderze według odcisku: odcisk → { plik, skrot }.
  const wgOdcisku = new Map();
  for (const [id, o] of Object.entries(poprzednieTresci)) {
    if (o && poprzedniePliki[id] && poprzednie[id] && !wgOdcisku.has(o)) wgOdcisku.set(o, { plik: poprzedniePliki[id], skrot: poprzednie[id] });
  }
  const istniejace = new Set(Object.values(poprzedniePliki));
  const pamiec = `${chroniony ? 'private' : 'public'}, max-age=31536000, immutable`;
  const skroty = {};
  const pliki = {};
  let gotowe = 0;
  let wyslane = 0;
  let narysowane = 0;
  // Opis w trakcie: strony już gotowe (nowe pliki) i jeszcze nie przerobione z poprzedniej publikacji.
  // Odciski zapisują się też w opisie w trakcie (#331): przerwana publikacja (zamknięta karta, uśpiony telefon)
  // nie zmusza następnej do rysowania wszystkich stron od nowa.
  const zapiszOpis = async (koniec) => {
    const wpis = (x) => (skroty[x.id] ? [skroty[x.id], pliki[x.id], odciski?.[x.id]] : [poprzednie[x.id], poprzedniePliki[x.id], poprzednieTresci[x.id]]);
    const tSkroty = {}; const tPliki = {}; const tTresci = {};
    for (const x of strony) {
      const [sk, pl, tr] = koniec ? [skroty[x.id], pliki[x.id], odciski?.[x.id]] : wpis(x);
      if (!sk || !pl) continue;
      tSkroty[x.id] = sk; tPliki[x.id] = pl;
      if (tr) tTresci[x.id] = tr;
    }
    const brak = strony.some((x) => !tSkroty[x.id]);
    const m = { format: 'seriodruk-podglad', wersja: 2, zaktualizowano: new Date().toISOString(), v: Date.now(), uklad, skroty: tSkroty, pliki: tPliki, rozszerzenie, ...(odciski ? { tresci: tTresci } : {}), ...(!koniec && brak ? { przygotowanie: true, gotowe, wszystkie: strony.length } : {}) };
    await magazyn.wyslij(`${folder}/manifest.json`, new Blob([JSON.stringify(m)], { type: 'application/json' }), { cache: 'no-cache' });
    return m;
  };
  // Opis od razu (#331): nowy układ i makieta 3D są w linku zaraz po kliknięciu.
  // (pełna publikacja bez linku – np. nowe hasło – nie pokazuje „w przygotowaniu”, dopóki stary opis jest dobry)
  if (naLink || !pelna) await zapiszOpis(false);
  if (naLink) await naLink();
  let ostatniOpis = Date.now();
  let przerwane = false;
  for (const s of kolejnoscStron(strony, { ogladane, poprzednie: poprzednieTresci, odciski: odciski || {} })) {
    const o = odciski?.[s.id];
    if (przedStrona && !(o && wgOdcisku.has(o)) && await przedStrona()) { przerwane = true; break; }
    const jest = o && wgOdcisku.get(o);
    if (jest) {
      skroty[s.id] = jest.skrot;
      pliki[s.id] = jest.plik;
    } else {
      const plik = await obraz(s);
      narysowane += 1;
      const sk = await skrotPliku(plik);
      const nazwa = o ? `o-${o}` : `p-${sk.slice(0, 32)}`;
      if (!istniejace.has(nazwa)) {
        await magazyn.wyslij(`${folder}/${nazwa}.${rozszerzenie}`, new Blob([plik], { type: typZRozszerzenia(rozszerzenie) }), { cache: pamiec });
        istniejace.add(nazwa);
        wyslane += 1;
      }
      skroty[s.id] = sk;
      pliki[s.id] = nazwa;
      if (o) wgOdcisku.set(o, { plik: nazwa, skrot: sk });
    }
    gotowe += 1;
    postep(gotowe, strony.length);
    if ((naLink || !pelna) && Date.now() - ostatniOpis > 3000 && gotowe < strony.length) { ostatniOpis = Date.now(); await zapiszOpis(false); }
  }
  if (przerwane) {
    const { zaktualizowano } = await zapiszOpis(false);
    return { zaktualizowano, wyslane, wszystkie: strony.length, narysowane, przerwane: true };
  }
  const { zaktualizowano } = await zapiszOpis(true);
  // Pliki, których żadna strona już nie pokazuje (po zapisaniu opisu – oglądający nie trafi na brakujący plik).
  const potrzebne = new Set([...strony.map((s) => `${pliki[s.id]}.${rozszerzenie}`), 'manifest.json']);
  const zbedne = (await magazyn.lista(folder)).filter((k) => !potrzebne.has(k.slice(folder.length + 1)));
  if (zbedne.length) await magazyn.usun(zbedne);
  return { zaktualizowano, wyslane, wszystkie: strony.length, narysowane, przerwane: false };
}
