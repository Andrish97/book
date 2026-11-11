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
// Strona w 300 dpi to kilkanaście milionów pikseli, więc piksele są czytane i pakowane pasami.

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

// plotno: narysowana strona (fabric.StaticCanvas), obiekty: jej elementy, silnik: przeliczanie przez profil.
// Zwraca odwołanie do obrazu CMYK w dokumencie PDF.
export async function obrazStronyCmyk(pdf, silnik, plotno, obiekty) {
  const w = plotno.width; const h = plotno.height;
  if (!(w > 0 && h > 0) || w > MAX_BOK || h > MAX_BOK || w * h > MAX_POLE) throw new Error('Strona jest za duża na tę rozdzielczość. Wybierz niższą jakość.');
  const c = plotno.getContext();
  const czern = silnik.czernSzarosci();

  // 1. Strona bez zdjęć: dla każdego piksela jego szarość albo 256, gdy nie jest neutralny.
  const foto = zdjecia(obiekty);
  let bezZdjec = null;
  if (foto.length) {
    const odmaluj = () => { for (const f of foto) for (const r of f.rodzice) r.dirty = true; plotno.renderAll(); };
    for (const f of foto) f.o.visible = false;
    odmaluj();
    bezZdjec = new Uint16Array(w * h);
    for (let y = 0; y < h; y += PAS) {
      const n = Math.min(PAS, h - y);
      const d = c.getImageData(0, y, w, n).data;
      let q = y * w;
      for (let i = 0; i < d.length; i += 4, q += 1) bezZdjec[q] = d[i + 3] === 255 && d[i] === d[i + 1] && d[i] === d[i + 2] ? d[i] : 256;
    }
    for (const f of foto) f.o.visible = true;
    odmaluj();
  }

  // 2. Pełna strona pasami: wszystko przez profil, a neutralne piksele spoza zdjęć – samą czarną farbą.
  const zapis = new ZapisObrazu(w, 4);
  for (let y = 0; y < h; y += PAS) {
    const n = Math.min(PAS, h - y);
    const d = c.getImageData(0, y, w, n).data;
    // Strona leży na białym papierze: przezroczyste miejsca płótna są białe.
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (a === 255) continue;
      d[i - 3] = (d[i - 3] * a) / 255 + 255 - a; d[i - 2] = (d[i - 2] * a) / 255 + 255 - a; d[i - 1] = (d[i - 1] * a) / 255 + 255 - a; d[i] = 255;
    }
    const cmyk = silnik.obraz(d);
    let q = y * w;
    for (let i = 0; i < d.length; i += 4, q += 1) {
      const v = d[i];
      if (v !== d[i + 1] || v !== d[i + 2] || (bezZdjec && bezZdjec[q] !== v)) continue;
      cmyk[i] = 0; cmyk[i + 1] = 0; cmyk[i + 2] = 0; cmyk[i + 3] = czern[v];
    }
    await zapis.dopisz(cmyk);
  }
  const ctx = pdf.context;
  return ctx.register(ctx.stream(await zapis.koniec(), {
    Type: 'XObject', Subtype: 'Image', Width: w, Height: h, BitsPerComponent: 8, ColorSpace: 'DeviceCMYK',
    Filter: 'FlateDecode', DecodeParms: { Predictor: 15, Colors: 4, BitsPerComponent: 8, Columns: w },
  }));
}
