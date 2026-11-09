// Własny format pliku projektu: .seriodruk
//
// Plik to archiwum ZIP (tak jak .docx czy .odt), w środku:
//   mimetype         application/vnd.seriodruk+zip (pierwszy, bez kompresji)
//   manifest.json    co jest w pliku: format, wersja formatu, projekt, lista zasobów
//   projekt.json     dane projektu (sekcje, wzorce, strony) bez obrazów
//   zasoby/<id>.png  obrazy jako zwykłe pliki (bez kodowania base64)
//   miniatura.png    podgląd pierwszej strony
//
// Dzięki temu plik jest mniejszy niż JSON z obrazami w środku, można go
// rozpakować dowolnym programem do ZIP, a manifest pozwala sprawdzić wersję
// formatu przed wczytaniem.

import { NAZWA, ROZSZERZENIE, TYP_MIME, FORMAT_PLIKU } from './marka.js';

export { ROZSZERZENIE, TYP_MIME };
export const WERSJA_FORMATU = 1;

const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

let ladowanie = null;
function jszip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!ladowanie) {
    ladowanie = new Promise((ok, blad) => {
      const skrypt = document.createElement('script');
      skrypt.src = JSZIP_URL;
      skrypt.onload = () => ok(window.JSZip);
      skrypt.onerror = () => { ladowanie = null; blad(new Error('Nie udało się wczytać modułu ZIP. Sprawdź internet.')); };
      document.head.append(skrypt);
    });
  }
  return ladowanie;
}

const ROZSZERZENIA = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif',
};
const TYPY = Object.fromEntries(Object.entries(ROZSZERZENIA).map(([t, r]) => [r, t]));

async function dataUrlNaBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

export async function zapiszPlikProjektu(projekt) {
  const JSZip = await jszip();
  const zip = new JSZip();
  zip.file('mimetype', TYP_MIME, { compression: 'STORE' });

  const { miniatura, ...dane } = projekt;
  const zasoby = {};
  const listaZasobow = [];
  for (const [id, z] of Object.entries(projekt.zasoby || {})) {
    if (!z.dataUrl) continue;
    const blob = await dataUrlNaBlob(z.dataUrl);
    const plik = `zasoby/${id}.${ROZSZERZENIA[blob.type] || 'bin'}`;
    zip.file(plik, blob);
    zasoby[id] = { nazwa: z.nazwa, plik };
    listaZasobow.push({ id, plik, typ: blob.type, nazwa: z.nazwa, bajty: blob.size });
  }

  const manifest = {
    format: FORMAT_PLIKU,
    wersja_formatu: WERSJA_FORMATU,
    aplikacja: NAZWA,
    utworzono: new Date().toISOString(),
    projekt: {
      id: projekt.id,
      nazwa: projekt.nazwa,
      wersja_modelu: projekt.wersja,
      sekcje: projekt.sekcje?.length || 0,
      strony: projekt.strony?.length || 0,
      wzorce: projekt.wzorce?.length || 0,
      zmieniono: projekt.zmieniono,
    },
    pliki: { projekt: 'projekt.json', miniatura: miniatura ? 'miniatura.png' : null },
    zasoby: listaZasobow,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('projekt.json', JSON.stringify({ ...dane, zasoby }));
  if (miniatura) zip.file('miniatura.png', await dataUrlNaBlob(miniatura));

  return zip.generateAsync({ type: 'blob', mimeType: TYP_MIME, compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// Wczytuje .seriodruk (lub starszy .json) i zwraca obiekt projektu z obrazami w dataUrl.
export async function wczytajPlikProjektu(plik) {
  const naglowek = new Uint8Array(await plik.slice(0, 4).arrayBuffer());
  const toZip = naglowek[0] === 0x50 && naglowek[1] === 0x4b; // „PK”
  if (!toZip) {
    try {
      return JSON.parse(await plik.text());
    } catch {
      throw new Error(`To nie jest plik projektu ${NAZWA}.`);
    }
  }

  const JSZip = await jszip();
  const zip = await JSZip.loadAsync(plik);
  const plikManifestu = zip.file('manifest.json');
  if (!plikManifestu) throw new Error(`W pliku brakuje manifestu – to nie jest projekt ${NAZWA}.`);
  const manifest = JSON.parse(await plikManifestu.async('string'));
  if (manifest.format !== FORMAT_PLIKU) throw new Error(`To nie jest plik projektu ${NAZWA}.`);
  if (manifest.wersja_formatu > WERSJA_FORMATU) {
    throw new Error('Plik zapisano w nowszej wersji aplikacji. Odśwież stronę, aby wczytać najnowszą wersję.');
  }

  const projekt = JSON.parse(await zip.file(manifest.pliki?.projekt || 'projekt.json').async('string'));
  for (const z of Object.values(projekt.zasoby || {})) {
    const wpis = z.plik && zip.file(z.plik);
    if (!wpis) continue;
    const typ = TYPY[z.plik.split('.').pop()] || 'application/octet-stream';
    z.dataUrl = `data:${typ};base64,${await wpis.async('base64')}`;
    delete z.plik;
  }
  const mini = manifest.pliki?.miniatura && zip.file(manifest.pliki.miniatura);
  if (mini) projekt.miniatura = `data:image/png;base64,${await mini.async('base64')}`;
  return projekt;
}
