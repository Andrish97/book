/* global fabric */
// Ustawienia Fabric.js 7 wspólne dla edytora i składania stron. Każdy moduł, który tworzy
// albo wczytuje obiekty Fabric, importuje ten plik – ustawienia są gotowe przed pierwszym użyciem.

// Własne właściwości obiektów, które zapisujemy razem z JSON-em Fabric.
export const WLASNE_POLA = [
  'id', 'nazwa', 'zasob', 'bez_ostrzezen',
  'warstwa', // element wzorca: 'nad' = nad treścią strony (domyślnie pod)
  'zablokowany', 'styl',
  'z', // kolejność na rozkładówce (żeby po zapisie stron osobno dało się ją odtworzyć)
  // Na etap 2 (pola z danymi): już teraz przenoszone przez zapis.
  'pole', 'autodopasowanie', 'min_rozmiar',
  'ramka_h', 'wyrownanie_pion', 'rozmiar_bazowy', // ramka tekstu o stałej wysokości (tekst-ramka.js)
  'ramka_pola',
  'boki', 'gwiazda', // wielokąt foremny albo gwiazda (punkty liczone z tych dwóch liczb)
  'lista', 'lista_start', // wypunktowanie / numerowanie akapitów (tekst-ramka.js)
  'watek', 'watek_nr', 'lacznik', // przelewanie tekstu między ramkami (watki.js)
  'z_danych', // kolor i przesunięcie zależne od pola z danych (pola.js)
  'bez_pol', // klamry w tym tekście to zwykły tekst, nie pola
  'wielkosc_liter', // 'wielkie' | 'male' – tylko wygląd, treść zostaje jak wpisana
  'tabela', // tabela jako jeden element: { kolumny, wiersze, naglowek, linia } (tabela-obiekt.js)
];

if (!fabric.BaseFabricObject.prototype._ustawieniaSeriodruku) {
  fabric.BaseFabricObject.prototype._ustawieniaSeriodruku = true;

  // Położenie obiektu (left, top) to jego lewy górny róg – tak są zapisane wszystkie projekty.
  // (Fabric 7 domyślnie liczy od środka.)
  Object.assign(fabric.BaseFabricObject.ownDefaults, { originX: 'left', originY: 'top' });

  // Wygląd uchwytów: powiększony obszar dotyku na tablecie (4.7).
  Object.assign(fabric.InteractiveFabricObject.ownDefaults, {
    transparentCorners: false,
    cornerColor: '#ffffff',
    cornerStrokeColor: '#2563eb',
    borderColor: '#2563eb',
    cornerStyle: 'circle',
    cornerSize: 11,
    touchCornerSize: 40,
    borderScaleFactor: 1.5,
  });

  // Własne pola trafiają do każdego zapisu obiektu (toObject, clone, zapis płótna).
  fabric.FabricObject.customProperties = WLASNE_POLA;

  // W zapisie typ obiektu zostaje taki jak dotąd (małe litery: 'textbox', 'image', 'rect'…).
  // Fabric 7 wczytuje obie pisownie, a reszta aplikacji i zapisane projekty znają tę jedną.
  const zapis = fabric.BaseFabricObject.prototype.toObject;
  fabric.BaseFabricObject.prototype.toObject = function toObject(pola) {
    const o = zapis.call(this, pola);
    o.type = this.type;
    // Opis tabeli jest zmieniany w miejscu – zapis dostaje własną kopię, nie odwołanie do żywego obiektu.
    if (o.tabela) o.tabela = JSON.parse(JSON.stringify(o.tabela));
    return o;
  };
}

// Czy obiekt jest zaznaczeniem kilku elementów naraz.
export const toZaznaczenie = (o) => o instanceof fabric.ActiveSelection;
