// Makieta 3D (#131D): jak projekt będzie wyglądał po wydrukowaniu – książka (miękka i twarda oprawa),
// notes na spirali, kalendarz ścienny i biurkowy, pojedyncza kartka. Bez bibliotek z CDN: geometria liczona
// tutaj (czyste funkcje – testy), rysowanie przez WebGL (utworzRenderer). Okno: js/app/makieta-okno.js.
//
// Model to lista kartek: { przod, tyl, w, h, d, kolor } – przod/tyl to klucze tekstur (np. „p:3” – strona
// numer 3 w kolejności druku, „okl:przod” – przód okładki) albo null (biały papier). Kartki obracają się
// na zawiasie: książka – na grzbiecie (oś pionowa), kalendarze – na górnej krawędzi (oś pozioma).
// Położenie w kartkowaniu to liczba u: całkowita – tyle kartek przewróconych; ułamkowa – kartka floor(u)
// jest w trakcie przewracania (s = u − floor(u)).

export const MODELE = {
  ksiazka_miekka: 'Książka – miękka oprawa',
  ksiazka_twarda: 'Książka – twarda oprawa',
  notes: 'Notes na spirali',
  kalendarz_scienny: 'Kalendarz ścienny',
  kalendarz_biurkowy: 'Kalendarz biurkowy',
  kartka: 'Pojedyncza kartka',
};

const PAPIER = '#f6f3ec';
const KRAWEDZ_OKLADKI = '#d9d4ca';
const DRUT = '#3a3d44';
const TEKTURA = '#9c8f7c';

// ---------- Kartki modelu ----------

// strony: liczba stron środka (w kolejności druku), format: { w, h } (mm), okladka: { w, h, tektura } | null,
// kartka_mm: grubość kartki środka.
export function kartkiModelu(model, { strony, format, okladka = null, kartka_mm = 0.1 }) {
  const d = Math.max(0.06, kartka_mm || 0.1);
  const { w, h } = format;
  const kartki = [];
  if (model === 'kalendarz_scienny' || model === 'kalendarz_biurkowy') {
    for (let i = 0; i < strony; i += 1) kartki.push({ przod: `p:${i}`, tyl: null, w, h, d: Math.max(d, 0.15), kolor: PAPIER });
    return kartki;
  }
  if (model === 'kartka') {
    for (let i = 0; i < strony; i += 2) kartki.push({ przod: `p:${i}`, tyl: i + 1 < strony ? `p:${i + 1}` : null, w, h, d: Math.max(d, 0.2), kolor: PAPIER });
    return kartki;
  }
  const twarda = model === 'ksiazka_twarda';
  const dOkl = twarda ? (okladka?.tektura || 2.5) : model === 'notes' ? 0.6 : 0.35;
  const wOkl = twarda ? Math.max(w + 3, okladka?.w || 0) : w;
  const hOkl = twarda ? Math.max(h + 6, okladka?.h || 0) : h;
  const zOkladka = Boolean(okladka) || twarda || model === 'notes';
  if (zOkladka) kartki.push({ przod: okladka ? 'okl:przod' : (strony ? 'p:0' : null), tyl: null, w: wOkl, h: hOkl, d: dOkl, kolor: KRAWEDZ_OKLADKI, okladka: true });
  // Bez sekcji okładki pierwsza strona jest okładką (miękka): środek zaczyna się od niej.
  const od = zOkladka && !okladka && strony ? 1 : 0;
  for (let i = od; i < strony; i += 2) kartki.push({ przod: `p:${i}`, tyl: i + 1 < strony ? `p:${i + 1}` : null, w, h, d, kolor: PAPIER });
  if (zOkladka) kartki.push({ przod: null, tyl: okladka ? 'okl:tyl' : null, w: wOkl, h: hOkl, d: dOkl, kolor: KRAWEDZ_OKLADKI, okladka: true });
  return kartki;
}

// Ile położeń kartkowania ma model (u od 0 do tej liczby).
export const polozenia = (model, kartki) => (model === 'kartka' ? Math.max(1, kartki.length * 2 - 1) : kartki.length);

// Opis położenia dla człowieka – „Okładka”, „Strony 2–3”, „Strona 5 z 13”…
export function opisPolozenia(model, kartki, u) {
  const t = Math.round(u);
  if (model === 'kartka') {
    const k = kartki[Math.floor(t / 2)];
    const klucz = t % 2 ? k?.tyl : k?.przod;
    return klucz ? `Strona ${Number(klucz.slice(2)) + 1}` : 'Tył kartki (pusty)';
  }
  if (model.startsWith('kalendarz')) return `Karta ${Math.min(t + 1, kartki.length)} z ${kartki.length}`;
  if (t === 0) return 'Okładka';
  if (t >= kartki.length) return 'Tył okładki';
  const nr = (klucz) => (klucz?.startsWith('p:') ? Number(klucz.slice(2)) + 1 : null);
  const lewa = nr(kartki[t - 1].tyl);
  const prawa = nr(kartki[t].przod);
  if (lewa && prawa) return `Strony ${lewa}–${prawa}`;
  return lewa || prawa ? `Strona ${lewa || prawa}` : 'Wyklejka';
}

// ---------- Geometria ----------

const lerp = (a, b, s) => a + (b - a) * s;
const gladko = (s) => s * s * (3 - 2 * s);

// Prostopadłościan w układzie kartki (x0..x1, y0..y1, z0..z1), przekształcony funkcją T (punkt → punkt).
// Ściana z1 – przód kartki (tekstura tp), z0 – tył (tt); uvP/uvT liczą współrzędne tekstury z (x, y).
function prostopadloscian(quady, T, [x0, x1, y0, y1, z0, z1], { tp, tt, kolor, uvP, uvT }) {
  const sciana = (pkt, uv, tex, n) => {
    const p = pkt.map((q) => T(q));
    const zero = T([pkt[0][0], pkt[0][1], pkt[0][2]]);
    const kon = T([pkt[0][0] + n[0], pkt[0][1] + n[1], pkt[0][2] + n[2]]);
    quady.push({ p, uv, tex, n: [kon[0] - zero[0], kon[1] - zero[1], kon[2] - zero[2]] });
  };
  const krawedz = `kolor:${kolor}`;
  const rog = [[x0, y1], [x1, y1], [x1, y0], [x0, y0]];
  sciana(rog.map(([x, y]) => [x, y, z1]), rog.map(([x, y]) => uvP(x, y)), tp || 'kolor:#ffffff', [0, 0, 1]);
  sciana(rog.map(([x, y]) => [x, y, z0]), rog.map(([x, y]) => uvT(x, y)), tt || 'kolor:#ffffff', [0, 0, -1]);
  const uv0 = [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (z1 - z0 > 0.001) {
    sciana([[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], uv0, krawedz, [1, 0, 0]);
    sciana([[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], uv0, krawedz, [-1, 0, 0]);
    sciana([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], uv0, krawedz, [0, 1, 0]);
    sciana([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], uv0, krawedz, [0, -1, 0]);
  }
}

// Kolejne kartki o tym samym rozmiarze w jednym stosie – jeden prostopadłościan zamiast setek.
function grupy(kartki, od, do_) {
  const wynik = [];
  for (let j = od; j < do_; j += 1) {
    const k = kartki[j];
    const g = wynik.at(-1);
    if (g && g.w === k.w && g.h === k.h && g.kolor === k.kolor) g.do = j + 1;
    else wynik.push({ od: j, do: j + 1, w: k.w, h: k.h, kolor: k.kolor });
  }
  return wynik;
}

// Przesunięcia kartek wzdłuż grubości: po prawej (nieprzewrócone) – suma grubości kartek pod spodem,
// po lewej (przewrócone) – ujemne (po obrocie o pół obrotu wychodzą nad zawias w kolejności przewracania).
function przesuniecia(kartki) {
  const n = kartki.length;
  const prawe = new Array(n).fill(0);
  const lewe = new Array(n).fill(0);
  let s = 0;
  for (let j = n - 1; j >= 0; j -= 1) { prawe[j] = s; s += kartki[j].d; }
  s = 0;
  for (let j = 0; j < n; j += 1) { s += kartki[j].d; lewe[j] = -s; }
  return { prawe, lewe, razem: s };
}

const obrotY = (th, dz = 0) => ([x, y, z]) => { const zz = z + dz; return [x * Math.cos(th) + zz * Math.sin(th), y, -x * Math.sin(th) + zz * Math.cos(th)]; };
const obrotX = (ps, dz = 0, y0 = 0) => ([x, y, z]) => { const zz = z + dz; return [x, y * Math.cos(ps) - zz * Math.sin(ps) + y0, y * Math.sin(ps) + zz * Math.cos(ps)]; };

// Scena modelu w położeniu u: lista czworokątów { p: [4 punkty], uv: [4], tex, n }.
export function scena(model, kartki, u = 0) {
  const quady = [];
  if (!kartki.length) return quady;
  const k = Math.floor(u + 1e-9);
  const s = gladko(Math.min(1, Math.max(0, u - k)));
  const obracana = u - k > 1e-6 ? k : null;

  if (model === 'kartka') {
    const kk = Math.min(kartki.length * 2 - 1, k);
    const j = Math.min(kartki.length - 1, Math.floor((kk + (s > 0.5 ? 1 : 0)) / 2));
    const kar = kartki[j];
    const th = -Math.PI * ((kk % 2) + (obracana === null ? 0 : s));
    const { w, h, d } = kar;
    prostopadloscian(quady, obrotY(th), [-w / 2, w / 2, -h / 2, h / 2, -d / 2, d / 2], {
      tp: kar.przod, tt: kar.tyl, kolor: kar.kolor,
      uvP: (x, y) => [(x + w / 2) / w, (h / 2 - y) / h], uvT: (x, y) => [(w / 2 - x) / w, (h / 2 - y) / h],
    });
    return quady;
  }

  const { prawe, lewe, razem } = przesuniecia(kartki);
  const kalendarz = model.startsWith('kalendarz');
  const nachylenie = model === 'kalendarz_biurkowy' ? 0.36 : 0.02;
  // Transformacja kartki j przy postępie obrotu q (0 – nieprzewrócona, 1 – przewrócona).
  const T = (j, q) => {
    const dz = lerp(prawe[j], lewe[j], q);
    if (kalendarz) return obrotX(lerp(-nachylenie, -(2 * Math.PI - nachylenie), q), dz);
    return obrotY(-Math.PI * q, dz);
  };
  const uvKsiazki = (w, h) => ({ uvP: (x, y) => [x / w, (h / 2 - y) / h], uvT: (x, y) => [1 - x / w, (h / 2 - y) / h] });
  const uvKalendarza = (w, h) => ({ uvP: (x, y) => [(x + w / 2) / w, -y / h], uvT: (x, y) => [(w / 2 - x) / w, -y / h] });
  const blok = (g, q, dz0, dz1) => {
    const Tg = kalendarz ? obrotX(lerp(-nachylenie, -(2 * Math.PI - nachylenie), q)) : obrotY(-Math.PI * q);
    const gora = kartki[q ? g.do - 1 : g.od];
    const dol = kartki[q ? g.od : g.do - 1];
    const wym = kalendarz ? [-g.w / 2, g.w / 2, -g.h, 0, dz0, dz1] : [0, g.w, -g.h / 2, g.h / 2, dz0, dz1];
    // Po lewej (q = 1) przód kartki j leży na dole, a jej tył na górze stosu.
    prostopadloscian(quady, Tg, wym, {
      tp: q ? dol.przod : gora.przod, tt: q ? gora.tyl : dol.tyl, kolor: g.kolor,
      ...(kalendarz ? uvKalendarza(g.w, g.h) : uvKsiazki(g.w, g.h)),
    });
  };
  const doLewej = obracana === null ? k : obracana;
  const odPrawej = obracana === null ? k : obracana + 1;
  for (const g of grupy(kartki, 0, Math.min(doLewej, kartki.length))) blok(g, 1, lewe[g.do - 1], lewe[g.od] + kartki[g.od].d);
  for (const g of grupy(kartki, odPrawej, kartki.length)) blok(g, 0, prawe[g.do - 1], prawe[g.od] + kartki[g.od].d);
  if (obracana !== null && obracana < kartki.length) {
    const kar = kartki[obracana];
    const wym = kalendarz ? [-kar.w / 2, kar.w / 2, -kar.h, 0, 0, kar.d] : [0, kar.w, -kar.h / 2, kar.h / 2, 0, kar.d];
    prostopadloscian(quady, T(obracana, s), wym, { tp: kar.przod, tt: kar.tyl, kolor: kar.kolor, ...(kalendarz ? uvKalendarza(kar.w, kar.h) : uvKsiazki(kar.w, kar.h)) });
  }

  if (!kalendarz && model !== 'notes') {
    // Grzbiet: pas od krawędzi zawiasu przedniej okładki do krawędzi zawiasu tylnej (zamknięta – pion).
    const n = kartki.length - 1;
    const q0 = obracana === 0 ? s : (k >= 1 ? 1 : 0);
    const qn = obracana === n ? s : (k >= kartki.length ? 1 : 0);
    const h = kartki[0].h;
    const A = T(0, q0);
    const B = T(n, qn);
    const p0 = A([0, h / 2, kartki[0].d]);
    const p1 = A([0, -h / 2, kartki[0].d]);
    const p2 = B([0, -h / 2, 0]);
    const p3 = B([0, h / 2, 0]);
    const szer = Math.hypot(p0[0] - p3[0], p0[2] - p3[2]);
    if (szer > 0.05) {
      const n0 = [p3[2] - p0[2], 0, -(p3[0] - p0[0])];
      quady.push({ p: [p3, p0, p1, p2], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], tex: kartki[0].przod?.startsWith('okl') ? 'okl:grzbiet' : `kolor:${KRAWEDZ_OKLADKI}`, n: n0, grzbiet: true });
    }
  }

  // Spirala (notes, kalendarze): pierścienie z drutu wzdłuż zawiasu.
  if (model === 'notes' || kalendarz) {
    const dl = kalendarz ? kartki[0].w : kartki[0].h;
    const krok = 8;
    const ile = Math.max(3, Math.floor((dl - 10) / krok));
    const r = kalendarz ? Math.min(10, razem + 3) : Math.max(3, Math.min(8, razem / 2 + 2.5));
    const os = (t) => (kalendarz ? [t, 1.5, 0] : [1.5, t, razem / 2]);
    for (let i = 0; i < ile; i += 1) {
      const t = -dl / 2 + 5 + (i + 0.5) * ((dl - 10) / ile);
      const o = os(t);
      for (let a = 0; a < 12; a += 1) {
        const a0 = (a / 12) * 2 * Math.PI;
        const a1 = ((a + 1) / 12) * 2 * Math.PI;
        const pkt = (al, dt) => (kalendarz ? [t + dt, o[1] + r * Math.sin(al), r * Math.cos(al)] : [o[0] - r * Math.sin(al), t + dt, o[2] + r * Math.cos(al)]);
        const P = [pkt(a0, -0.6), pkt(a0, 0.6), pkt(a1, 0.6), pkt(a1, -0.6)];
        const mid = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2, (P[0][2] + P[2][2]) / 2];
        const n = [mid[0] - o[0], mid[1] - o[1], mid[2] - o[2]];
        quady.push({ p: P, uv: [[0, 0], [1, 0], [1, 1], [0, 1]], tex: `kolor:${DRUT}`, n });
      }
    }
  }

  // Kalendarz biurkowy: tylna podpórka z tektury pod przewróconymi kartami.
  if (model === 'kalendarz_biurkowy') {
    const kar = kartki[0];
    prostopadloscian(quady, obrotX(-(2 * Math.PI - nachylenie), -razem - 1.6), [-kar.w / 2, kar.w / 2, -kar.h, 0, 0, 1.5], {
      tp: `kolor:${TEKTURA}`, tt: `kolor:${TEKTURA}`, kolor: TEKTURA, uvP: () => [0, 0], uvT: () => [0, 0],
    });
  }
  return quady;
}

// Prostopadłościan obejmujący scenę – środek i rozmiar dla kamery.
export function obwiednia(quady) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of quady) for (const p of q.p) for (let i = 0; i < 3; i += 1) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  return { min, max, srodek: min.map((v, i) => (v + max[i]) / 2), rozmiar: Math.max(...max.map((v, i) => v - min[i])) };
}

// ---------- WebGL ----------

const mnoz = (a, b) => {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) for (let w = 0; w < 4; w += 1) {
    let s = 0;
    for (let k = 0; k < 4; k += 1) s += a[k * 4 + w] * b[c * 4 + k];
    r[c * 4 + w] = s;
  }
  return r;
};
const perspektywa = (fov, asp, n, f) => {
  const t = 1 / Math.tan(fov / 2);
  return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
};
const przesun = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const obrX = (a) => new Float32Array([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]);
const obrY = (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);

const VS = `attribute vec3 a_p; attribute vec2 a_uv; attribute vec3 a_n;
uniform mat4 u_rzut; uniform mat4 u_widok; varying vec2 v_uv; varying float v_s;
void main() {
  gl_Position = u_rzut * u_widok * vec4(a_p, 1.0);
  vec3 n = normalize((u_widok * vec4(a_n, 0.0)).xyz);
  float d = max(dot(n, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
  v_s = 0.68 + 0.34 * d;
  v_uv = a_uv;
}`;
const FS = `precision mediump float; uniform sampler2D u_t; varying vec2 v_uv; varying float v_s;
void main() { vec4 c = texture2D(u_t, v_uv); gl_FragColor = vec4(c.rgb * v_s, 1.0); }`;

// Renderer na płótnie: ustawTeksture(klucz, obraz|płótno), maTeksture(klucz), rysuj(quady, kamera), zwolnij().
// kamera: { srodek, odleglosc, obrotY, obrotX }. Zwraca null, gdy przeglądarka nie ma WebGL.
export function utworzRenderer(plotno) {
  const gl = plotno.getContext('webgl', { preserveDrawingBuffer: true, antialias: true, alpha: true, premultipliedAlpha: false })
    || plotno.getContext('experimental-webgl', { preserveDrawingBuffer: true });
  if (!gl) return null;
  const shader = (typ, zrodlo) => {
    const s = gl.createShader(typ);
    gl.shaderSource(s, zrodlo);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const a = { p: gl.getAttribLocation(prog, 'a_p'), uv: gl.getAttribLocation(prog, 'a_uv'), n: gl.getAttribLocation(prog, 'a_n') };
  const u = { rzut: gl.getUniformLocation(prog, 'u_rzut'), widok: gl.getUniformLocation(prog, 'u_widok') };
  const bufor = gl.createBuffer();
  const tekstury = new Map();
  const nowaTekstura = (zrodlo) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (typeof zrodlo === 'string') {
      const h = zrodlo.replace('#', '');
      const px = new Uint8Array([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    } else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, zrodlo);
    return t;
  };
  const tekstura = (klucz) => {
    if (tekstury.has(klucz)) return tekstury.get(klucz);
    if (klucz.startsWith('kolor:')) { const t = nowaTekstura(klucz.slice(6)); tekstury.set(klucz, t); return t; }
    return tekstura(`kolor:${PAPIER}`);
  };
  return {
    gl,
    maTeksture: (klucz) => klucz.startsWith('kolor:') || tekstury.has(klucz),
    ustawTeksture(klucz, obraz) {
      const stara = tekstury.get(klucz);
      if (stara) gl.deleteTexture(stara);
      tekstury.set(klucz, nowaTekstura(obraz));
    },
    rysuj(quady, kamera, tlo = [0, 0, 0, 0]) {
      const W = plotno.width;
      const H = plotno.height;
      gl.viewport(0, 0, W, H);
      gl.clearColor(...tlo);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      const rzut = perspektywa((32 * Math.PI) / 180, W / Math.max(1, H), Math.max(1, kamera.odleglosc / 50), kamera.odleglosc * 10);
      const c = kamera.srodek;
      const widok = mnoz(przesun(0, 0, -kamera.odleglosc), mnoz(obrX(kamera.obrotX), mnoz(obrY(kamera.obrotY), przesun(-c[0], -c[1], -c[2]))));
      gl.uniformMatrix4fv(u.rzut, false, rzut);
      gl.uniformMatrix4fv(u.widok, false, widok);
      const wgTeksty = new Map();
      for (const q of quady) {
        const t = tekstura(q.tex);
        if (!wgTeksty.has(t)) wgTeksty.set(t, []);
        wgTeksty.get(t).push(q);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, bufor);
      for (const [t, lista] of wgTeksty) {
        const dane = new Float32Array(lista.length * 6 * 8);
        let i = 0;
        for (const q of lista) {
          for (const v of [0, 1, 2, 0, 2, 3]) {
            dane.set(q.p[v], i); dane.set(q.uv[v], i + 3); dane.set(q.n, i + 5);
            i += 8;
          }
        }
        gl.bufferData(gl.ARRAY_BUFFER, dane, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(a.p); gl.vertexAttribPointer(a.p, 3, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(a.uv); gl.vertexAttribPointer(a.uv, 2, gl.FLOAT, false, 32, 12);
        gl.enableVertexAttribArray(a.n); gl.vertexAttribPointer(a.n, 3, gl.FLOAT, false, 32, 20);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.drawArrays(gl.TRIANGLES, 0, lista.length * 6);
      }
    },
    zwolnij() {
      for (const t of tekstury.values()) gl.deleteTexture(t);
      tekstury.clear();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
