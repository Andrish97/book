// Kopie robocze dużych obrazów.
//
// Zdjęcie z aparatu ma kilkadziesiąt milionów pikseli, a na ekranie widać je
// w ułamku tej wielkości. Dlatego na płótnie, w miniaturach i w podglądzie
// pracuje pomniejszona kopia, a oryginał zostaje nietknięty w projekcie i
// trafia do eksportu (PNG, PDF).
//
// Kopia istnieje tylko w pamięci przeglądarki – nie jest zapisywana ani
// wysyłana. Obiekt obrazu na stronie zawsze ma wymiary i przycięcie liczone
// w pikselach oryginału, więc projekt wygląda tak samo z kopią i bez niej.

import './fabric-ustawienia.js';
import { adresZasobu, kluczZasobu, kopiaZMagazynu, zapamietajKopie } from './zasoby.js';

const PROG_PX = 2000; // dłuższy bok, od którego powstaje kopia robocza
const BOK_PX = 1600; // dłuższy bok kopii roboczej

const kopie = new WeakMap(); // zasób → { odcisk, obietnica, url }
const oryginaly = new Map(); // adres kopii roboczej → { szer, wys } oryginału

function wczytajObraz(src) {
  return new Promise((ok, blad) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => blad(new Error('Nie udało się wczytać obrazu.'));
    img.src = src;
  });
}

// Krótki znak treści świeżo dodanego obrazu (z `dataUrl`) – żeby zauważyć podmianę pliku pod tym samym
// identyfikatorem, nie trzymając w pamięci całego tekstu.
const odcisk = (zasob) => (zasob.dataUrl ? `${zasob.dataUrl.length}:${zasob.dataUrl.slice(-48)}` : null);

// zrodlo – adres oryginału; klucz – klucz pliku w magazynie przeglądarki (null dla obrazu jeszcze
// niezapisanego). Pod tym kluczem kopia jest zapamiętywana, więc przy następnym otwarciu projektu
// oryginału nie trzeba dekodować.
async function zrobKopie(zrodlo, zasob, klucz) {
  if (zasob.typ === 'image/svg+xml' || /^data:image\/svg/i.test(zrodlo)) return null; // rysunek wektorowy skaluje się sam
  if (klucz) {
    const z = await kopiaZMagazynu(klucz);
    if (z?.mala) return null;
    if (z?.blob) { const url = URL.createObjectURL(z.blob); oryginaly.set(url, { szer: z.szer, wys: z.wys }); return url; }
  }
  const img = await wczytajObraz(zrodlo);
  const szer = img.naturalWidth;
  const wys = img.naturalHeight;
  if (Math.max(szer, wys) <= PROG_PX) { if (klucz) zapamietajKopie(klucz, { mala: true }); return null; }
  const k = BOK_PX / Math.max(szer, wys);
  const plotno = document.createElement('canvas');
  plotno.width = Math.max(1, Math.round(szer * k));
  plotno.height = Math.max(1, Math.round(wys * k));
  const ctx = plotno.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, plotno.width, plotno.height);
  // WebP zachowuje przezroczystość; przeglądarka, która go nie zapisuje, odda PNG.
  const blob = await new Promise((ok) => plotno.toBlob(ok, 'image/webp', 0.86));
  plotno.width = 0; plotno.height = 0;
  if (!blob) return null;
  if (klucz) zapamietajKopie(klucz, { blob, szer, wys });
  const url = URL.createObjectURL(blob);
  oryginaly.set(url, { szer, wys });
  return url;
}

function przygotuj(zasob) {
  const zrodlo = adresZasobu(zasob);
  if (!zrodlo) return null;
  let wpis = kopie.get(zasob);
  // Kopia zostaje, gdy obraz przeszedł z projektu do magazynu; powstaje od nowa, gdy plik podmieniono.
  if (!wpis || (zasob.dataUrl && wpis.odcisk !== odcisk(zasob))) {
    wpis = { odcisk: odcisk(zasob), url: null, obietnica: null };
    wpis.obietnica = zrobKopie(zrodlo, zasob, kluczZasobu(zasob)).then((url) => { wpis.url = url; }, () => {});
    kopie.set(zasob, wpis);
  }
  return wpis.obietnica;
}

export function zbierzZasoby(obiekty, zbior = new Set()) {
  for (const o of obiekty || []) {
    if (o.type === 'image' && o.zasob) zbior.add(o.zasob);
    if (Array.isArray(o.objects)) zbierzZasoby(o.objects, zbior);
  }
  return zbior;
}

// Czeka, aż obrazy użyte w podanych obiektach (JSON) mają kopie robocze.
export async function przygotujKopie(zasoby, obiekty) {
  await Promise.all([...zbierzZasoby(obiekty)].map((id) => przygotuj(zasoby?.[id])));
}

// Adres kopii roboczej zasobu albo null, gdy obraz jest mały lub kopii jeszcze nie ma.
export function kopiaRobocza(zasob) {
  const wpis = zasob && kopie.get(zasob);
  return wpis && (!zasob.dataUrl || wpis.odcisk === odcisk(zasob)) ? wpis.url : null;
}

// Rozmiar oryginału w pikselach – niezależnie od tego, czy obiekt pokazuje kopię.
export function rozmiarOryginalu(obj) {
  const el = obj.getElement();
  const o = oryginaly.get(el?.src);
  return o ? { nw: o.szer, nh: o.wys } : { nw: el.naturalWidth || el.width, nh: el.naturalHeight || el.height };
}

// Fabric rysuje obraz wycinkiem „szerokość × wysokość od przycięcia” w pikselach
// źródła. Gdy źródłem jest kopia robocza, przeliczamy ten wycinek na jej piksele.
// Dzieje się to przy każdym rysowaniu, więc działa także po powieleniu obiektu.
if (typeof fabric !== 'undefined' && !fabric.FabricImage.prototype._zKopiaRobocza) {
  const rysuj = fabric.FabricImage.prototype._renderFill;
  fabric.FabricImage.prototype._zKopiaRobocza = true;
  fabric.FabricImage.prototype._renderFill = function renderFill(ctx) {
    const el = this._element;
    const o = el && oryginaly.get(el.src);
    if (o) {
      this._filterScalingX = el.naturalWidth / o.szer;
      this._filterScalingY = el.naturalHeight / o.wys;
    }
    return rysuj.call(this, ctx);
  };
}
