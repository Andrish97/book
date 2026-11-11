// Obraz całej strony w CMYK – do PDF w trybie „Obrazy stron” z profilem warunków druku (PDF/X-4).
//
// Strona narysowana przez przeglądarkę jest w RGB. Przeliczenie wszystkiego przez profil dałoby
// czarny tekst z czterech farb – nieostry przy najmniejszym przesunięciu farb w druku. Dlatego:
//  – piksele zdjęć idą przez profil (tak jak zdjęcia w pliku wektorowym),
//  – czerń i szarości wszystkiego poza zdjęciami (tekst, kształty, cienie) idą samą czarną farbą,
//    o jasności dobranej według profilu; biel to czysty papier.
// Co jest „poza zdjęciami”, rozstrzyga drugi obraz tej samej strony ze schowanymi zdjęciami:
// piksel, który jest w obu taki sam i neutralny, nie pochodzi ze zdjęcia.
//
// Bez strat cała strona ze zdjęciami zajmowałaby w pliku wiele megabajtów, dlatego strona ze zdjęciami składa się
// z dwóch warstw (obie w CMYK, w tej samej rozdzielczości):
//  – pod spodem prostokąty ze zdjęciami jako JPEG w czterech farbach (js/jpeg-cmyk.js) – tak jak zdjęcia
//    w trybie „Obrazy stron” bez CMYK, które też są JPEG-iem (gdy prostokąt bez strat wychodzi mniejszy,
//    np. gładka grafika wstawiona jako zdjęcie, zostaje bez strat);
//  – na wierzchu reszta strony (tekst, kształty, tła) bez strat, z maską, która w miejscu pikseli zdjęć
//    nic nie maluje. Tekst i szarości zostają więc dokładne co do piksela, także gdy leżą na zdjęciu.
// Piksel „należy do zdjęcia”, gdy na obrazie strony ze schowanymi zdjęciami wygląda inaczej.
// Przy jakości 1 nic nie jest stratne: cała strona jest jednym obrazem bez strat (plik dużo większy).
//
// Strona w 300 dpi to kilkanaście milionów pikseli, więc piksele są czytane i pakowane pasami.

import { jpegCmyk } from './jpeg-cmyk.js';

const PAS = 256; // wierszy naraz
// Granice płótna w przeglądarce (bok i powierzchnia) – powyżej nich obraz strony by nie powstał.
const MAX_BOK = 32767;
const MAX_POLE = 268435456;

const toZdjecie = (o) => o.type === 'image' && !/^data:image\/svg\+xml/i.test(o.getElement?.()?.src || '');

// Widoczne zdjęcia wśród obiektów (także w grupach), każde z grupami, w których leży.
function zdjecia(obiekty, rodzice = [], lista = []) {
  for (const o of obiekty || []) {
    if (o.visible === false) continue;
    if (toZdjecie(o)) lista.push({ o, rodzice });
    else if (Array.isArray(o._objects)) zdjecia(o._objects, [...rodzice, o], lista);
  }
  return lista;
}

// Pakuje wiersze obrazu po kawałku: każdy wiersz dostaje „przewidywanie” jak w PNG (różnica względem
// piksela z lewej albo wiersza wyżej – zdjęcia pakują się wtedy wyraźnie lepiej), a całość idzie przez Flate.
class ZapisObrazu {
  constructor(szer, kanaly) {
    this.kanaly = kanaly;
    this.dl = szer * kanaly;
    this.wyzej = new Uint8Array(this.dl);
    const strumien = new CompressionStream('deflate');
    this.pisarz = strumien.writable.getWriter();
    this.wynik = new Response(strumien.readable).arrayBuffer();
  }

  async dopisz(dane) {
    const { dl, kanaly } = this;
    const wierszy = dane.length / dl;
    const wyj = new Uint8Array(wierszy * (dl + 1));
    for (let w = 0; w < wierszy; w += 1) {
      const wiersz = dane.subarray(w * dl, (w + 1) * dl);
      const { wyzej } = this;
      // Który sposób da mniejsze liczby: różnica z lewej (1) czy z góry (2).
      let zLewej = 0; let zGory = 0;
      for (let i = 0; i < dl; i += 1) {
        const a = (wiersz[i] - (i >= kanaly ? wiersz[i - kanaly] : 0)) & 255;
        const b = (wiersz[i] - wyzej[i]) & 255;
        zLewej += a < 128 ? a : 256 - a;
        zGory += b < 128 ? b : 256 - b;
      }
      const p = w * (dl + 1);
      if (zGory <= zLewej) {
        wyj[p] = 2;
        for (let i = 0; i < dl; i += 1) wyj[p + 1 + i] = wiersz[i] - wyzej[i];
      } else {
        wyj[p] = 1;
        for (let i = 0; i < dl; i += 1) wyj[p + 1 + i] = wiersz[i] - (i >= kanaly ? wiersz[i - kanaly] : 0);
      }
      this.wyzej = wiersz;
    }
    this.wyzej = this.wyzej.slice(); // pas z pikselami może zaraz zniknąć
    await this.pisarz.write(wyj);
  }

  async koniec() {
    await this.pisarz.close();
    return new Uint8Array(await this.wynik);
  }
}

// Zapis maski (1 bit na piksel, 1 = tu warstwa bez strat nic nie maluje), pakowany po kawałku.
class ZapisMaski {
  constructor() {
    const strumien = new CompressionStream('deflate');
    this.pisarz = strumien.writable.getWriter();
    this.wynik = new Response(strumien.readable).arrayBuffer();
  }

  dopisz(bajty) { return this.pisarz.write(bajty); }

  async koniec() { await this.pisarz.close(); return new Uint8Array(await this.wynik); }
}

// Prostokąty (w pikselach strony), w których leżą zdjęcia: ramka każdego zdjęcia z zapasem na obrys i cień,
// przycięta do strony; zachodzące na siebie łączą się w jeden.
function prostokatyZdjec(plotno, foto, w, h) {
  const v = plotno.viewportTransform || [1, 0, 0, 1, 0, 0];
  const lista = [];
  for (const { o, rodzice } of foto) {
    const r = o.getBoundingRect();
    let zapas = 3;
    for (const x of [o, ...rodzice]) if (x.shadow) zapas += (Math.abs(x.shadow.offsetX || 0) + Math.abs(x.shadow.offsetY || 0) + 2 * (x.shadow.blur || 0)) * Math.abs(v[0]);
    const x1 = Math.max(0, Math.floor(r.left * v[0] + v[4] - zapas)); const y1 = Math.max(0, Math.floor(r.top * v[3] + v[5] - zapas));
    const x2 = Math.min(w, Math.ceil((r.left + r.width) * v[0] + v[4] + zapas)); const y2 = Math.min(h, Math.ceil((r.top + r.height) * v[3] + v[5] + zapas));
    if (x2 > x1 && y2 > y1) lista.push({ x1, y1, x2, y2 });
  }
  for (let zmiana = true; zmiana;) {
    zmiana = false;
    for (let i = 0; i < lista.length && !zmiana; i += 1) {
      for (let j = i + 1; j < lista.length && !zmiana; j += 1) {
        const a = lista[i]; const b = lista[j];
        if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
          lista[i] = { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) };
          lista.splice(j, 1);
          zmiana = true;
        }
      }
    }
  }
  return lista;
}

// Strona leży na białym papierze: przezroczyste miejsca płótna są białe.
function naBialym(d) {
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    if (a === 255) continue;
    d[i - 3] = (d[i - 3] * a) / 255 + 255 - a; d[i - 2] = (d[i - 2] * a) / 255 + 255 - a; d[i - 1] = (d[i - 1] * a) / 255 + 255 - a; d[i] = 255;
  }
}

// plotno: narysowana strona (fabric.StaticCanvas), obiekty: jej elementy, silnik: przeliczanie przez profil,
// jakosc: jakość JPEG zdjęć (0–1; 1 = cała strona bez strat).
// Zwraca { strona, zdjecia: [{ obraz, x, y, w, h }], w, h }: odwołania do obrazów CMYK w dokumencie PDF –
// warstwę bez strat (cała strona) i prostokąty ze zdjęciami, które trzeba narysować pod nią (piksele strony).
export async function obrazStronyCmyk(pdf, silnik, plotno, obiekty, { jakosc = 0.92 } = {}) {
  const w = plotno.width; const h = plotno.height;
  if (!(w > 0 && h > 0) || w > MAX_BOK || h > MAX_BOK || w * h > MAX_POLE) throw new Error('Strona jest za duża na tę rozdzielczość. Wybierz niższą jakość.');
  const c = plotno.getContext();
  const czern = silnik.czernSzarosci();
  const ctx = pdf.context;

  // 1. Strona bez zdjęć – zapamiętana jako drugi obraz, do porównania piksel po pikselu.
  const foto = zdjecia(obiekty);
  let bez = null;
  if (foto.length) {
    const odmaluj = () => { for (const f of foto) for (const r of f.rodzice) r.dirty = true; plotno.renderAll(); };
    for (const f of foto) f.o.visible = false;
    odmaluj();
    const kopia = Object.assign(document.createElement('canvas'), { width: w, height: h });
    bez = kopia.getContext('2d', { willReadFrequently: true });
    bez.drawImage(c.canvas, 0, 0, w, h, 0, 0, w, h);
    for (const f of foto) f.o.visible = true;
    odmaluj();
  }
  const dwieWarstwy = Boolean(bez) && jakosc < 1;

  // 2. Pełna strona pasami: wszystko przez profil, a neutralne piksele spoza zdjęć – samą czarną farbą.
  // Zwraca warstwę bez strat, maskę i piksele prostokątów ze zdjęciami; `poza` – gdy piksel zdjęcia
  // wypadł poza prostokątami (np. nietypowy cień) – wtedy przebieg trzeba powtórzyć z jednym, szerszym.
  const przebieg = async (prostokaty) => {
    const zapis = new ZapisObrazu(w, 4);
    const maska = dwieWarstwy ? new ZapisMaski() : null;
    const bajtowMaski = Math.ceil(w / 8);
    const bufory = prostokaty.map((r) => new Uint8Array((r.x2 - r.x1) * (r.y2 - r.y1) * 4));
    const zasieg = { x1: w, y1: h, x2: 0, y2: 0 };
    let poza = false; let pikseliZdjec = 0;
    for (let y = 0; y < h; y += PAS) {
      const n = Math.min(PAS, h - y);
      const d = c.getImageData(0, y, w, n).data;
      naBialym(d);
      const b = bez ? bez.getImageData(0, y, w, n).data : null;
      if (b) naBialym(b);
      const cmyk = silnik.obraz(d);
      const pasMaski = maska ? new Uint8Array(n * bajtowMaski) : null;
      // Które piksele są zdjęciem (inne niż na stronie bez zdjęć); pozostałe neutralne – samą czarną farbą.
      const zdjecie = b ? new Uint8Array(w * n) : null;
      for (let i = 0, q = 0; i < d.length; i += 4, q += 1) {
        const inny = b ? (d[i] !== b[i] || d[i + 1] !== b[i + 1] || d[i + 2] !== b[i + 2]) : false;
        if (inny) { zdjecie[q] = 1; continue; }
        const v = d[i];
        if (v !== d[i + 1] || v !== d[i + 2]) continue;
        cmyk[i] = 0; cmyk[i + 1] = 0; cmyk[i + 2] = 0; cmyk[i + 3] = czern[v];
      }
      if (dwieWarstwy) {
        // Prostokąty ze zdjęciami dostają gotowe piksele strony (razem z tym, co na zdjęciach leży).
        prostokaty.forEach((r, k) => {
          const od = Math.max(r.y1, y); const doY = Math.min(r.y2, y + n);
          const szer = r.x2 - r.x1;
          for (let yy = od; yy < doY; yy += 1) bufory[k].set(cmyk.subarray(((yy - y) * w + r.x1) * 4, ((yy - y) * w + r.x2) * 4), (yy - r.y1) * szer * 4);
        });
        // Warstwa bez strat: w miejscu pikseli zdjęć pusto, a maska mówi, żeby tam nie malować.
        for (let yy = 0, q = 0; yy < n; yy += 1) {
          for (let x = 0; x < w; x += 1, q += 1) {
            if (!zdjecie[q]) continue;
            pikseliZdjec += 1;
            cmyk[q * 4] = 0; cmyk[q * 4 + 1] = 0; cmyk[q * 4 + 2] = 0; cmyk[q * 4 + 3] = 0;
            pasMaski[yy * bajtowMaski + (x >> 3)] |= 128 >> (x & 7);
            const wiersz = y + yy;
            if (x < zasieg.x1) zasieg.x1 = x;
            if (x >= zasieg.x2) zasieg.x2 = x + 1;
            if (wiersz < zasieg.y1) zasieg.y1 = wiersz;
            if (wiersz >= zasieg.y2) zasieg.y2 = wiersz + 1;
            if (!poza && !prostokaty.some((r) => x >= r.x1 && x < r.x2 && wiersz >= r.y1 && wiersz < r.y2)) poza = true;
          }
        }
        await maska.dopisz(pasMaski);
      }
      await zapis.dopisz(cmyk);
    }
    return { bezStrat: await zapis.koniec(), maska: maska ? await maska.koniec() : null, bufory, poza, zasieg, pikseliZdjec };
  };

  let prostokaty = dwieWarstwy ? prostokatyZdjec(plotno, foto, w, h) : [];
  let wynik = await przebieg(prostokaty);
  if (wynik.poza) {
    prostokaty = [wynik.zasieg];
    wynik = await przebieg(prostokaty);
  }

  const opis = {
    Type: 'XObject', Subtype: 'Image', Width: w, Height: h, BitsPerComponent: 8, ColorSpace: 'DeviceCMYK',
    Filter: 'FlateDecode', DecodeParms: { Predictor: 15, Colors: 4, BitsPerComponent: 8, Columns: w },
  };
  const zdjeciaStrony = [];
  if (dwieWarstwy && wynik.pikseliZdjec) {
    opis.Mask = ctx.register(ctx.stream(wynik.maska, { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ImageMask: true, BitsPerComponent: 1, Filter: 'FlateDecode' }));
    for (let k = 0; k < prostokaty.length; k += 1) {
      const r = prostokaty[k];
      const szer = r.x2 - r.x1; const wys = r.y2 - r.y1;
      const wspolne = { Type: 'XObject', Subtype: 'Image', Width: szer, Height: wys, BitsPerComponent: 8, ColorSpace: 'DeviceCMYK' };
      // Zdjęcie jako JPEG – chyba że bez strat wychodzi mniejsze (gładka grafika zapisana jako zdjęcie).
      const jpeg = await jpegCmyk(wynik.bufory[k], szer, wys, jakosc);
      const zapis = new ZapisObrazu(szer, 4);
      await zapis.dopisz(wynik.bufory[k]);
      const bezStrat = await zapis.koniec();
      const obraz = bezStrat.length <= jpeg.length
        ? ctx.register(ctx.stream(bezStrat, { ...wspolne, Filter: 'FlateDecode', DecodeParms: { Predictor: 15, Colors: 4, BitsPerComponent: 8, Columns: szer } }))
        : ctx.register(ctx.stream(jpeg, { ...wspolne, Filter: 'DCTDecode', DecodeParms: { ColorTransform: 0 } }));
      zdjeciaStrony.push({ obraz, x: r.x1, y: r.y1, w: szer, h: wys });
    }
  }
  return { strona: ctx.register(ctx.stream(wynik.bezStrat, opis)), zdjecia: zdjeciaStrony, w, h };
}
