// Publikacja linku do podglądu – wspólna dla aplikacji (wysyłka przez worker z sesją właściciela) i dla rysowania
// na serwerze (#335, worker zapisuje wprost do R2). Bez zależności od reszty aplikacji: magazyn podaje wywołujący.
//
// magazyn: {
//   czytajOpis(folder) → manifest (obiekt) albo null,
//   wyslij(klucz, blob, { cache }) – zapis pliku w buckecie podglądów,
//   lista(folder) → [klucze] – pliki folderu (z prefiksem „folder/”),
//   usun(klucze),
// }

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
// odciski: { idStrony: skrót treści } – strona o tym samym skrócie co poprzednio nie jest nawet rysowana.
// Zwraca { zaktualizowano, wyslane, wszystkie }.
export async function publikujDoMagazynu(magazyn, folder, uklad, strony, obraz, postep, odciski, { rozszerzenie = 'jpg', pelna = false, chroniony = false, naLink = null } = {}) {
  // Skróty obrazów z poprzedniej publikacji: strona, której obraz się nie zmienił, nie jest wysyłana drugi raz.
  let poprzednie = {};
  let poprzednieTresci = {};
  if (!pelna) {
    try {
      const m = await magazyn.czytajOpis(folder);
      // Inny format obrazów niż poprzednio (np. dawny link w JPEG) – wszystkie strony od nowa.
      if (m && (m.rozszerzenie || 'jpg') === rozszerzenie) { poprzednie = m.skroty || {}; poprzednieTresci = m.tresci || {}; }
    } catch { /* pierwsza publikacja albo brak sieci – wyślemy wszystko */ }
  }
  const pamiec = `${chroniony ? 'private' : 'public'}, max-age=31536000, immutable`;
  const skroty = {};
  let gotowe = 0;
  let wyslane = 0;
  // Opis w trakcie: strony już gotowe (nowe skróty) i jeszcze nie przerobione z poprzedniej publikacji.
  // Odciski treści zapisują się też w opisie w trakcie (#331): przerwana publikacja (zamknięta karta, uśpiony telefon)
  // nie zmusza następnej do rysowania wszystkich stron od nowa – strony już wysłane mają odcisk nowej treści,
  // a te jeszcze nie przerobione – odcisk sprzed (ich obrazy się nie zmieniły).
  const zapiszOpis = async (koniec) => {
    const teraz = koniec ? skroty : { ...Object.fromEntries(strony.map((x) => [x.id, poprzednie[x.id]]).filter(([, v]) => v)), ...skroty };
    const brak = strony.some((x) => !teraz[x.id]);
    const tresci = !odciski ? null : koniec ? odciski
      : Object.fromEntries(strony.map((x) => [x.id, skroty[x.id] ? odciski[x.id] : poprzednieTresci[x.id]]).filter(([, v]) => v));
    const m = { format: 'seriodruk-podglad', wersja: 1, zaktualizowano: new Date().toISOString(), v: Date.now(), uklad, skroty: teraz, rozszerzenie, ...(tresci ? { tresci } : {}), ...(!koniec && brak ? { przygotowanie: true, gotowe, wszystkie: strony.length } : {}) };
    await magazyn.wyslij(`${folder}/manifest.json`, new Blob([JSON.stringify(m)], { type: 'application/json' }), { cache: 'no-cache' });
    return m;
  };
  // Opis od razu (#331): nowy układ i makieta 3D są w linku zaraz po kliknięciu, a nie dopiero po przejściu
  // wszystkich stron; strony, których obraz się nie zmienił, zostają z poprzedniej publikacji.
  // (pełna publikacja bez linku – np. nowe hasło – nie pokazuje „w przygotowaniu”, dopóki stary opis jest dobry)
  if (naLink || !pelna) await zapiszOpis(false);
  if (naLink) await naLink();
  let ostatniOpis = Date.now();
  for (const s of strony) {
    if (odciski && poprzednie[s.id] && poprzednieTresci[s.id] === odciski[s.id]) {
      skroty[s.id] = poprzednie[s.id];
    } else {
      const plik = await obraz(s);
      skroty[s.id] = await skrotPliku(plik);
      if (poprzednie[s.id] !== skroty[s.id]) {
        // Adres obrazu ma wersję (skrót) w zapytaniu – przeglądarka może go trzymać długo.
        await magazyn.wyslij(`${folder}/${s.id}.${rozszerzenie}`, new Blob([plik], { type: typZRozszerzenia(rozszerzenie) }), { cache: pamiec });
        wyslane += 1;
      }
    }
    gotowe += 1;
    postep(gotowe, strony.length);
    if ((naLink || !pelna) && Date.now() - ostatniOpis > 3000 && gotowe < strony.length) { ostatniOpis = Date.now(); await zapiszOpis(false); }
  }
  // Obrazy stron usuniętych od poprzedniej aktualizacji.
  const potrzebne = new Set([...strony.map((s) => `${s.id}.${rozszerzenie}`), 'manifest.json']);
  const zbedne = (await magazyn.lista(folder)).filter((k) => !potrzebne.has(k.slice(folder.length + 1)));
  if (zbedne.length) await magazyn.usun(zbedne);

  const { zaktualizowano } = await zapiszOpis(true);
  return { zaktualizowano, wyslane, wszystkie: strony.length };
}
