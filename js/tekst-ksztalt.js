/* global fabric */
// Kształt tekstu (#131B): tekst po łuku, okręgu, elipsie albo dowolnej ścieżce i wyginanie (obwiednie).
//
// Pole elementu `ksztalt_tekstu` (zapisywane z projektem):
//   { rodzaj, zgiecie, promien, przesuniecie, strona, wyrownanie, odwroc, d, szer }
//   rodzaj: 'luk' | 'okrag' | 'elipsa' | 'sciezka' – litery stawiane po linii (obracane wzdłuż niej),
//           'luk_gora' | 'luk_dol' | 'wypuklosc' | 'wkleslosc' | 'fala' | 'flaga' | 'zwezenie' – wygięcie
//           (litery na prostej linii bazowej, każda przekształcona według obwiedni).
//   zgiecie: −100…100 – siła łuku albo wygięcia (ujemna – w drugą stronę),
//   promien: mm (okrąg, łuk; 0 – dobrany do długości tekstu), przesuniecie: stopnie (okrąg) albo % długości
//   (ścieżka), strona: 'zewn' | 'wewn' (okrąg; po ścieżce – litery nad albo pod linią),
//   wyrownanie: 'lewo' | 'srodek' | 'prawo' (po ścieżce), odwroc: kierunek ścieżki odwrotnie,
//   d: ścieżka w milimetrach (SVG, w układzie środka tekstu) – kopia kształtu wskazanego na stronie,
//   szer: szerokość ramki tekstu prosto (wraca po ustawieniu „Prosto” i na czas pisania).
//
// Litery są rysowane po jednej zwykłym fillText z przekształceniem – w PDF (js/pdf-wektorowy.js) zostają tekstem
// wektorowym z osadzoną czcionką. W trakcie pisania tekst jest prosty (kursor i zaznaczanie jak w zwykłym tekście),
// po wyjściu z pisania wraca kształt. Ramka elementu obejmuje litery po kształcie, więc ostrzeżenia
// (poza stroną, poza marginesem) liczą się od tego, co naprawdę widać.

export const RODZAJE_KSZTALTU = [
  ['prosto', 'Prosto'],
  ['luk', 'Łuk'],
  ['okrag', 'Okrąg'],
  ['elipsa', 'Elipsa'],
  ['sciezka', 'Po ścieżce'],
  ['luk_gora', 'Wygięcie: łuk górny'],
  ['luk_dol', 'Wygięcie: łuk dolny'],
  ['wypuklosc', 'Wygięcie: wypukłość'],
  ['wkleslosc', 'Wygięcie: wklęsłość'],
  ['fala', 'Wygięcie: fala'],
  ['flaga', 'Wygięcie: flaga'],
  ['zwezenie', 'Wygięcie: zwężenie'],
];
const PO_LINII = new Set(['luk', 'okrag', 'elipsa', 'sciezka']);
const WYGIECIA = new Set(['luk_gora', 'luk_dol', 'wypuklosc', 'wkleslosc', 'fala', 'flaga', 'zwezenie']);
export const czyPoLinii = (r) => PO_LINII.has(r);
export const czyWygiecie = (r) => WYGIECIA.has(r);

const ogranicz = (v, a, b, d) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d);

export function normalizujKsztalt(k) {
  if (!k || typeof k !== 'object') return null;
  const rodzaj = RODZAJE_KSZTALTU.some(([r]) => r === k.rodzaj) ? k.rodzaj : 'prosto';
  if (rodzaj === 'prosto') return null;
  return {
    rodzaj,
    zgiecie: ogranicz(k.zgiecie, -100, 100, rodzaj === 'luk' ? 50 : 40),
    promien: ogranicz(k.promien, 0, 2000, 0),
    przesuniecie: ogranicz(k.przesuniecie, -360, 360, 0),
    strona: k.strona === 'wewn' ? 'wewn' : 'zewn',
    wyrownanie: ['lewo', 'prawo'].includes(k.wyrownanie) ? k.wyrownanie : 'srodek',
    odwroc: Boolean(k.odwroc),
    d: typeof k.d === 'string' && k.d.length < 200000 ? k.d : '',
    szer: ogranicz(k.szer, 0, 5000, 0),
  };
}

// Czy element ma teraz być rysowany po kształcie (nie w trakcie pisania).
export const ksztaltAktywny = (o) => {
  const k = o?.ksztalt_tekstu;
  if (!k || !k.rodzaj || k.rodzaj === 'prosto' || o.isEditing) return false;
  if (k.rodzaj === 'sciezka' && !k.d) return false;
  return true;
};

// ---------- Pomiar liter ----------

let pomiar = null;
const MNOZNIK = 100; // mierzymy w większym stopniu – mniej zaokrągleń przeglądarki przy rozmiarach w mm
function kontekstPomiaru() {
  if (!pomiar) pomiar = document.createElement('canvas').getContext('2d');
  return pomiar;
}

function zmienLitery(o, s) {
  if (o.wielkosc_liter === 'wielkie' || o.wielkosc_liter === 'kapitaliki') return s.toLocaleUpperCase('pl');
  if (o.wielkosc_liter === 'male') return s.toLocaleLowerCase('pl');
  return s;
}

// Znaki tekstu (jedna linia: końce wierszy jako spacje) z szerokościami w mm.
function znakiTekstu(o) {
  const tekst = zmienLitery(o, String(o.text || '').replace(/\s*\n\s*/g, ' ').replace(/\t/g, ' '));
  const znaki = typeof o.graphemeSplit === 'function' ? o.graphemeSplit(tekst) : Array.from(tekst);
  const F = o.fontSize || 4;
  const c = kontekstPomiaru();
  c.font = o._getFontDeclaration({ fontFamily: o.fontFamily, fontSize: F * MNOZNIK, fontWeight: o.fontWeight, fontStyle: o.fontStyle });
  const odstep = ((o.charSpacing || 0) / 1000) * F;
  return znaki.map((z) => ({ z, w: c.measureText(z).width / MNOZNIK + odstep }));
}

// ---------- Ścieżka ----------

function sciezkaFabric(d) {
  try {
    const p = fabric.util.makePathSimpler(fabric.util.parsePath(d));
    const info = fabric.util.getPathSegmentsInfo(p);
    const dl = info.length ? info[info.length - 1].length : 0;
    return dl > 0 ? { p, info, dl } : null;
  } catch { return null; }
}

// Elipsa jako ścieżka (półosie rx, ry, start u góry, zgodnie z ruchem wskazówek zegara).
const sciezkaElipsy = (rx, ry) => `M 0 ${-ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 0 ${-ry} Z`;

// ---------- Układ liter ----------
//
// Każda litera: { z, w, x, y, kat, sx, sy, skos, dy } – punkt (x, y) to środek litery na linii bazowej,
// kat – obrót (radiany), sx/sy – skala, skos – pochylenie pionowe (flaga), dy – przesunięcie linii bazowej
// przed skalą (wygięcia zakotwiczone u góry albo w środku).
export function ukladKsztaltu(o) {
  const k = normalizujKsztalt(o.ksztalt_tekstu);
  if (!k) return null;
  const znaki = znakiTekstu(o);
  const F = o.fontSize || 4;
  const gora = F * 0.8; // wysokość liter nad linią bazową (do ramki elementu)
  const dol = F * 0.22;
  const L = znaki.reduce((s, g) => s + g.w, 0);
  const b = k.zgiecie / 100;
  const litery = [];
  if (!znaki.length || !(L > 0)) return { litery, ramka: { x: -1, y: -gora, w: 2, h: gora + dol }, gora, dol };

  const naLinii = (punktNa, dlugosc, start) => {
    let s = start;
    for (const g of znaki) {
      const p = punktNa(s + g.w / 2, dlugosc);
      if (p) litery.push({ ...g, x: p.x, y: p.y, kat: p.kat, sx: 1, sy: 1, skos: 0, dy: p.dy || 0 });
      s += g.w;
    }
  };

  if (k.rodzaj === 'luk') {
    if (Math.abs(b) < 0.005) {
      let x = -L / 2;
      for (const g of znaki) { litery.push({ ...g, x: x + g.w / 2, y: 0, kat: 0, sx: 1, sy: 1, skos: 0, dy: 0 }); x += g.w; }
    } else {
      const R = k.promien > 0 ? k.promien : L / (Math.abs(b) * Math.PI);
      const znak = Math.sign(b);
      naLinii((s) => {
        const fi = (s - L / 2) / R;
        return { x: R * Math.sin(fi), y: znak * R * (1 - Math.cos(fi)), kat: znak * fi };
      }, L, 0);
    }
  } else if (k.rodzaj === 'okrag') {
    const R = k.promien > 0 ? k.promien : L / (2 * Math.PI * 0.97); // napis prawie dookoła – jak w pieczęci
    const start = (k.przesuniecie * Math.PI) / 180;
    const zewn = k.strona === 'zewn' !== k.odwroc;
    naLinii((s) => {
      const t = (s - L / 2) / R;
      if (zewn) { const a = -Math.PI / 2 + start + t; return { x: R * Math.cos(a), y: R * Math.sin(a), kat: a + Math.PI / 2 }; }
      const a = Math.PI / 2 + start - t;
      return { x: R * Math.cos(a), y: R * Math.sin(a), kat: a - Math.PI / 2 };
    }, L, 0);
  } else if (k.rodzaj === 'elipsa' || k.rodzaj === 'sciezka') {
    let d = k.d;
    if (k.rodzaj === 'elipsa') {
      const rx = k.promien > 0 ? k.promien : Math.max(L / (2 * Math.PI * 0.8), F);
      const ry = rx * Math.max(0.15, 1 - Math.abs(b) * 0.85);
      d = sciezkaElipsy(rx, ry);
    }
    const sc = sciezkaFabric(d);
    if (sc) {
      const zamknieta = /z\s*$/i.test(d.trim()) || k.rodzaj === 'elipsa';
      let start = ((k.przesuniecie || 0) / 100) * sc.dl;
      if (!zamknieta) {
        if (k.wyrownanie === 'srodek') start += (sc.dl - L) / 2;
        else if (k.wyrownanie === 'prawo') start += sc.dl - L;
      } else if (k.wyrownanie === 'srodek') start -= L / 2;
      const pod = k.strona === 'wewn';
      naLinii((s) => {
        let poz = s + start;
        if (zamknieta) poz = ((poz % sc.dl) + sc.dl) % sc.dl;
        else if (poz < 0 || poz > sc.dl) return null; // litery poza końcem otwartej ścieżki nie są rysowane
        const odl = k.odwroc ? sc.dl - poz : poz;
        const p = fabric.util.getPointOnPath(sc.p, odl, sc.info);
        if (!p) return null;
        let kat = (p.angle || 0) + (k.odwroc ? Math.PI : 0);
        return { x: p.x, y: p.y, kat, dy: pod ? gora : 0 };
      }, L, 0);
    }
  } else if (WYGIECIA.has(k.rodzaj)) {
    let x = -L / 2;
    for (const g of znaki) {
      const u = (x + g.w / 2 + L / 2) / L; // 0…1 wzdłuż tekstu
      const l = { ...g, x: x + g.w / 2, y: 0, kat: 0, sx: 1, sy: 1, skos: 0, dy: 0 };
      const sinPi = Math.sin(Math.PI * u);
      if (k.rodzaj === 'luk_gora') { l.sy = Math.max(0.15, 1 + b * 0.9 * sinPi); }
      else if (k.rodzaj === 'luk_dol') { l.sy = Math.max(0.15, 1 + b * 0.9 * sinPi); l.dy = (l.sy - 1) * dol; l.kotwica = 'gora'; }
      else if (k.rodzaj === 'wypuklosc') { l.sy = Math.max(0.15, 1 + b * 0.9 * sinPi); l.kotwica = 'srodek'; }
      else if (k.rodzaj === 'wkleslosc') { l.sy = Math.max(0.15, 1 - b * 0.6 * sinPi); l.kotwica = 'srodek'; }
      else if (k.rodzaj === 'fala' || k.rodzaj === 'flaga') {
        const A = b * F * 0.9;
        l.y = -A * Math.sin(2 * Math.PI * u);
        const nachylenie = (-A * 2 * Math.PI * Math.cos(2 * Math.PI * u)) / L;
        if (k.rodzaj === 'fala') l.kat = Math.atan(nachylenie); else l.skos = nachylenie;
      } else if (k.rodzaj === 'zwezenie') {
        const t = b >= 0 ? u : 1 - u;
        l.sy = Math.max(0.15, 1 - Math.abs(b) * 0.7 * t);
        l.kotwica = 'srodek';
      }
      litery.push(l);
      x += g.w;
    }
  }

  // Ramka: narożniki każdej litery po przekształceniu.
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const l of litery) {
    const m = macierzLitery(l, gora, dol);
    for (const [px, py] of [[-l.w / 2, -gora], [l.w / 2, -gora], [-l.w / 2, dol], [l.w / 2, dol]]) {
      const X = m[0] * px + m[2] * py + m[4]; const Y = m[1] * px + m[3] * py + m[5];
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  if (!Number.isFinite(x0)) { x0 = -1; x1 = 1; y0 = -gora; y1 = dol; }
  return { litery, ramka: { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }, gora, dol };
}

// Macierz litery [a b c d e f]: przesunięcie do (x, y), obrót, pochylenie, skala względem kotwicy.
function macierzLitery(l, gora, dol) {
  const cos = Math.cos(l.kat); const sin = Math.sin(l.kat);
  // Kotwica skali w pionie: linia bazowa (domyślnie), góra liter albo ich środek.
  const ky = l.kotwica === 'gora' ? -gora : (l.kotwica === 'srodek' ? (-gora + dol) / 2 : 0);
  // M = T(x, y) · R(kat) · K(skos) · T(0, dy) · T(0, ky) · S(sx, sy) · T(0, −ky)
  let m = [1, 0, 0, 1, 0, 0];
  const razy = (a, n) => [a[0] * n[0] + a[2] * n[1], a[1] * n[0] + a[3] * n[1], a[0] * n[2] + a[2] * n[3], a[1] * n[2] + a[3] * n[3], a[0] * n[4] + a[2] * n[5] + a[4], a[1] * n[4] + a[3] * n[5] + a[5]];
  m = razy(m, [1, 0, 0, 1, l.x, l.y]);
  m = razy(m, [cos, sin, -sin, cos, 0, 0]);
  if (l.skos) m = razy(m, [1, l.skos, 0, 1, 0, 0]);
  m = razy(m, [1, 0, 0, 1, 0, l.dy || 0]);
  m = razy(m, [1, 0, 0, 1, 0, ky]);
  m = razy(m, [l.sx, 0, 0, l.sy, 0, 0]);
  m = razy(m, [1, 0, 0, 1, 0, -ky]);
  return m;
}

// ---------- Łatki na fabric.Textbox ----------

export function zalatajKsztaltTekstu() {
  const P = fabric.Textbox.prototype;
  if (P._ksztaltZalatany) return;
  P._ksztaltZalatany = true;
  const T = fabric.Textbox;
  if (!T.textLayoutProperties.includes('ksztalt_tekstu')) T.textLayoutProperties = [...T.textLayoutProperties, 'ksztalt_tekstu'];
  if (!T.cacheProperties.includes('ksztalt_tekstu')) T.cacheProperties = [...T.cacheProperties, 'ksztalt_tekstu'];

  const wymiary = P.initDimensions;
  P.initDimensions = function initDimensions() {
    if (ksztaltAktywny(this)) {
      // Ramka obejmuje litery po kształcie; środek elementu zostaje w miejscu przy zmianie wymiarów.
      wymiary.call(this);
      if (!this.initialized) return;
      const u = ukladKsztaltu(this);
      if (!u) return;
      this._ukladKsztaltu = u;
      const nowa = { w: u.ramka.w, h: u.ramka.h };
      if (Math.abs(nowa.w - this.width) > 1e-6 || Math.abs(nowa.h - this.height) > 1e-6) {
        const srodek = this.canvas ? this.getCenterPoint() : null;
        this.width = nowa.w;
        this.height = nowa.h;
        if (srodek) this.setPositionByOrigin(srodek, 'center', 'center');
      }
      this._ksztaltUstawiony = true;
      return;
    }
    this._ukladKsztaltu = null;
    // Powrót do pisania albo do „Prosto”: ramka wraca do szerokości tekstu prosto.
    if (this._ksztaltUstawiony && this.ksztalt_tekstu?.szer > 0 && Math.abs(this.width - this.ksztalt_tekstu.szer) > 1e-6) {
      const srodek = this.canvas ? this.getCenterPoint() : null;
      this.width = this.ksztalt_tekstu.szer;
      wymiary.call(this);
      if (srodek) this.setPositionByOrigin(srodek, 'center', 'center');
    } else wymiary.call(this);
    this._ksztaltUstawiony = false;
  };

  const tekst = P._renderText;
  P._renderText = function _renderText(ctx) {
    if (!ksztaltAktywny(this)) { tekst.call(this, ctx); return; }
    const u = this._ukladKsztaltu || ukladKsztaltu(this);
    if (!u) return;
    const cx = u.ramka.x + u.ramka.w / 2; const cy = u.ramka.y + u.ramka.h / 2;
    const F = this.fontSize || 4;
    ctx.save();
    ctx.font = this._getFontDeclaration({ fontFamily: this.fontFamily, fontSize: F, fontWeight: this.fontWeight, fontStyle: this.fontStyle });
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const obrys = this.stroke && this.strokeWidth > 0;
    if (typeof this._setFillStyles === 'function') this._setFillStyles(ctx, this); else ctx.fillStyle = typeof this.fill === 'string' ? this.fill : '#000000';
    if (obrys) { if (typeof this._setStrokeStyles === 'function') this._setStrokeStyles(ctx, this); else ctx.strokeStyle = this.stroke; }
    const odstep = ((this.charSpacing || 0) / 1000) * F;
    for (const l of u.litery) {
      if (!l.z.trim()) continue;
      const m = macierzLitery(l, u.gora, u.dol);
      ctx.save();
      ctx.transform(m[0], m[1], m[2], m[3], m[4] - cx, m[5] - cy);
      const x = -l.w / 2 + odstep / 2;
      if (obrys && this.paintFirst === 'stroke') ctx.strokeText(l.z, x, 0);
      if (this.fill) ctx.fillText(l.z, x, 0);
      if (obrys && this.paintFirst !== 'stroke') ctx.strokeText(l.z, x, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  // Tło wierszy, podkreślenie i przekreślenie dotyczą tekstu prosto.
  for (const nazwa of ['_renderTextLinesBackground', '_renderTextDecoration']) {
    const pierwotna = P[nazwa];
    if (typeof pierwotna !== 'function') continue;
    P[nazwa] = function bezKsztaltu(...a) { if (ksztaltAktywny(this)) return undefined; return pierwotna.apply(this, a); };
  }

  // Pisanie: tekst prosto (kursor, zaznaczanie); po wyjściu z pisania wraca kształt.
  const wejdz = P.enterEditing;
  P.enterEditing = function enterEditing(...a) {
    const mial = ksztaltAktywny(this);
    const w = wejdz.apply(this, a);
    if (mial) { this.initDimensions(); this.setCoords(); this.canvas?.requestRenderAll(); }
    return w;
  };
  const wyjdz = P.exitEditing;
  P.exitEditing = function exitEditing(...a) {
    const w = wyjdz.apply(this, a);
    if (this.ksztalt_tekstu?.rodzaj && this.ksztalt_tekstu.rodzaj !== 'prosto') { this.initDimensions(); this.setCoords(); this.dirty = true; this.canvas?.requestRenderAll(); }
    return w;
  };
}

// ---------- Uchwyt zgięcia na płótnie ----------

// Uchwyt pod środkiem tekstu (nad nim jest uchwyt obrotu): przeciągnięcie w górę i w dół zmienia zgięcie.
export function kontrolkaZgiecia(naZmiane) {
  return new fabric.Control({
    x: 0,
    y: 0.5,
    offsetY: 22,
    cursorStyle: 'ns-resize',
    actionName: 'zgiecie',
    actionHandler: (e, t, x, y) => {
      const o = t.target;
      const k = normalizujKsztalt(o.ksztalt_tekstu);
      if (!k || k.rodzaj === 'okrag' || k.rodzaj === 'sciezka') return false;
      if (t._zgiecieStart === undefined) { t._zgiecieStart = k.zgiecie; t._zgiecieY = y; }
      const dy = t._zgiecieY - y; // w górę – mocniej
      const skala = Math.max(5, (o.fontSize || 4) * 3);
      const nowe = Math.round(ogranicz(t._zgiecieStart + (dy / skala) * 50, -100, 100, 0));
      if (nowe === k.zgiecie) return false;
      o.set('ksztalt_tekstu', { ...k, zgiecie: nowe });
      o.initDimensions();
      o.setCoords();
      naZmiane?.(o);
      return true;
    },
    render: (ctx, left, top) => {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, top - 6); ctx.lineTo(left + 6, top); ctx.lineTo(left, top + 6); ctx.lineTo(left - 6, top); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  });
}

// Uchwyt zgięcia tylko przy łuku i wygięciach (okrąg i ścieżka mają swoje liczby w panelu).
export function ustawKontrolkiKsztaltu(o, naZmiane) {
  if (!o || o.type !== 'textbox') return;
  const k = normalizujKsztalt(o.ksztalt_tekstu);
  const potrzebny = k && (k.rodzaj === 'luk' || WYGIECIA.has(k.rodzaj));
  const bazowe = fabric.Textbox.prototype.controls || o.controls;
  if (potrzebny) {
    if (!o.controls?.zgiecie) o.controls = { ...(o.controls || bazowe), zgiecie: kontrolkaZgiecia(naZmiane) };
  } else if (o.controls?.zgiecie) {
    const { zgiecie, ...reszta } = o.controls;
    o.controls = reszta;
  }
}

// Kopia kształtu ze strony jako ścieżka w mm, w układzie środka tekstu (do „Po ścieżce”).
export function sciezkaZKsztaltu(ksztalt, tekst) {
  const m = ksztalt.calcTransformMatrix();
  const t = tekst.getCenterPoint();
  const p = (x, y) => { const q = fabric.util.transformPoint(new fabric.Point(x, y), m); return `${(q.x - t.x).toFixed(3)} ${(q.y - t.y).toFixed(3)}`; };
  const typ = String(ksztalt.type).toLowerCase();
  if (typ === 'ellipse' || typ === 'circle') {
    const rx = ksztalt.rx ?? ksztalt.radius; const ry = ksztalt.ry ?? ksztalt.radius;
    const n = 72; const pk = [];
    for (let i = 0; i <= n; i += 1) { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; pk.push(p(rx * Math.cos(a), ry * Math.sin(a))); }
    return `M ${pk.join(' L ')} Z`;
  }
  if (typ === 'rect') {
    const w = ksztalt.width / 2; const h = ksztalt.height / 2;
    return `M ${p(-w, -h)} L ${p(w, -h)} L ${p(w, h)} L ${p(-w, h)} Z`;
  }
  if (typ === 'line') {
    const pts = ksztalt.calcLinePoints();
    return `M ${p(pts.x1, pts.y1)} L ${p(pts.x2, pts.y2)}`;
  }
  if ((typ === 'polygon' || typ === 'polyline') && Array.isArray(ksztalt.points)) {
    const o = ksztalt.pathOffset || { x: 0, y: 0 };
    const pk = ksztalt.points.map((q) => p(q.x - o.x, q.y - o.y));
    return `M ${pk.join(' L ')}${typ === 'polygon' ? ' Z' : ''}`;
  }
  if (typ === 'path' && Array.isArray(ksztalt.path)) {
    const o = ksztalt.pathOffset || { x: 0, y: 0 };
    const czesci = [];
    for (const s of fabric.util.makePathSimpler(ksztalt.path)) {
      const [kom, ...a] = s;
      const pary = [];
      for (let i = 0; i + 1 < a.length; i += 2) pary.push(p(a[i] - o.x, a[i + 1] - o.y));
      czesci.push(kom === 'Z' || kom === 'z' ? 'Z' : `${kom} ${pary.join(' ')}`);
    }
    return czesci.join(' ');
  }
  return null;
}
