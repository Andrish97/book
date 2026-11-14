/* global fabric */
// Kształt jako ramka obrazu (decyzja #123): prostokąt, elipsa, wielokąt, gwiazda albo zamknięty kształt
// z pióra może mieć w sobie obraz. Obraz jest przycięty do kształtu i zawsze go wypełnia (jak „wypełnij
// ramkę”); kształt zostaje kształtem – z obrysem, cieniem, zaokrągleniem i edycją punktów.
//
// Zapis: ten sam klucz `zasob` co w obrazie (dzięki temu lista obrazów projektu, zmiana nazwy pliku,
// podmiana i łącznik AI widzą obraz w kształcie bez osobnej obsługi) oraz `obraz_kadr`:
//   { x, y } – przesunięcie środka obrazu względem środka kształtu, w ułamkach widocznej szerokości
//              i wysokości kształtu (0 = na środku; większe wartości są przycinane, żeby obraz zawsze
//              zakrywał cały kształt),
//   skala    – powiększenie ponad „wypełnij” (1 = obraz dokładnie zakrywa kształt),
//   punkt    – (tylko na stronach z danych) punkt zdjęcia 0–1, który staje na środku kształtu.
// Wypełnienie kształtu (kolor albo przejście) zostaje pod obrazem – widać je przez przezroczyste
// części obrazu (np. po usunięciu tła).
//
// Rysowanie: kształt rysuje swoją ścieżkę, wypełnia ją jak zwykle, potem przycina do niej i rysuje
// obraz, a na końcu obrys. Te same polecenia rysowania rozumie PDF wektorowy (js/pdf-wektorowy.js),
// więc w PDF obraz jest przycięty wektorowo i osadzony w oryginalnej rozdzielczości.

import { rozmiarOryginalu } from './obrazy.js';

const TYPY = new Set(['rect', 'ellipse', 'circle', 'polygon', 'triangle', 'path']);

// Czy kształt może być ramką obrazu: zamknięty kształt (ścieżka z pióra tylko zamknięta).
export function moznaWstawicObraz(o) {
  if (!o || !TYPY.has(o.type) || o.tabela) return false;
  if (o.type === 'path') return (o.path || []).some((k) => k[0] === 'Z' || k[0] === 'z');
  return true;
}

// Czy element jest kształtem z obrazem.
export const maObraz = (o) => Boolean(o && o.zasob && o.type !== 'image' && TYPY.has(o.type));

// Skąd wziąć adres obrazu, gdy obiekt nie dostał go przy wczytaniu (nowy, skopiowany, cofnięty).
let zrodloDomyslne = null;
export function ustawZrodloObrazow(fn) { zrodloDomyslne = fn; }

const pamiec = new Map();
function wczytajEl(src) {
  if (pamiec.has(src)) return pamiec.get(src);
  const p = fabric.util.loadImage(src).catch(() => null);
  // Pełne obrazy z eksportu (data:) nie zostają w pamięci po złożeniu strony.
  if (!src.startsWith('data:')) pamiec.set(src, p);
  return p;
}

const srcDla = (o) => o._src_obrazu || zrodloDomyslne?.(o.zasob) || null;

function oznaczDoPrzerysowania(o) {
  for (let p = o; p; p = p.group || p.parent) p.dirty = true;
  (o.canvas || o.group?.canvas)?.requestRenderAll();
}

// Wczytuje obrazy kształtów z podanych obiektów (także w grupach) – przed rysowaniem na płótnie,
// które nie przerysuje się samo (miniatury, podgląd, PDF).
export async function przygotujObrazyKsztaltow(obiekty) {
  const czekaj = [];
  const zbierz = (lista) => {
    for (const o of lista || []) {
      if (maObraz(o)) {
        const src = srcDla(o);
        if (src && (o._obrazSrc !== src || !o._obrazEl)) {
          czekaj.push(wczytajEl(src).then((el) => { o._obrazEl = el; o._obrazSrc = src; oznaczDoPrzerysowania(o); }));
        }
      }
      if (typeof o.getObjects === 'function') zbierz(o.getObjects());
    }
  };
  zbierz(obiekty);
  await Promise.all(czekaj);
}

// Element obrazu do narysowania; brakujący zaczyna się wczytywać (płótno edytora przerysuje się samo).
function elementDla(o) {
  const src = srcDla(o);
  if (!src) return null;
  if (o._obrazSrc === src && o._obrazEl) return o._obrazEl;
  if (o._wczytuje !== src) {
    o._wczytuje = src;
    wczytajEl(src).then((el) => {
      if (o._wczytuje !== src) return;
      o._wczytuje = null;
      o._obrazEl = el; o._obrazSrc = src;
      oznaczDoPrzerysowania(o);
    });
  }
  return o._obrazEl || null; // do czasu wczytania nowego – poprzedni obraz
}

const ogranicz = (v, a) => Math.min(a, Math.max(-a, v));

// Rozmiar obrazu w pikselach oryginału (także gdy element pokazuje lżejszą kopię roboczą).
export function wymiaryObrazu(el) {
  const r = rozmiarOryginalu({ getElement: () => el });
  return { nw: r.nw || 1, nh: r.nh || 1 };
}

// Gdzie leży obraz w kształcie. Zwraca prostokąt w układzie kształtu (bez skali: x, y, w, h – do
// rysowania) oraz w milimetrach widocznych na stronie: W, H – kształt, Wi, Hi – cały obraz, cx, cy –
// przesunięcie środka obrazu, k – mm na piksel oryginału.
export function ukladObrazu(o, el) {
  const sx = Math.abs(o.scaleX || 1); const sy = Math.abs(o.scaleY || 1);
  const W = Math.max(0.01, (o.width || 0) * sx); const H = Math.max(0.01, (o.height || 0) * sy);
  const { nw, nh } = wymiaryObrazu(el);
  const kadr = o.obraz_kadr || {};
  const k = Math.max(W / nw, H / nh) * Math.max(1, Number(kadr.skala) || 1);
  const Wi = nw * k; const Hi = nh * k;
  // punkt: { x, y } – który punkt zdjęcia (0–1) ma stać na środku kształtu (kadr z danych, #123).
  const cx = ogranicz(kadr.punkt ? (0.5 - kadr.punkt.x) * Wi : (Number(kadr.x) || 0) * W, (Wi - W) / 2);
  const cy = ogranicz(kadr.punkt ? (0.5 - kadr.punkt.y) * Hi : (Number(kadr.y) || 0) * H, (Hi - H) / 2);
  return { x: (cx - Wi / 2) / sx, y: (cy - Hi / 2) / sy, w: Wi / sx, h: Hi / sy, W, H, Wi, Hi, cx, cy, k, nw, nh };
}

// Ustawia kadr z przesunięcia w mm i powiększenia – z przycięciem, żeby obraz zakrywał kształt.
export function ustawKadr(o, { cx, cy, skala }) {
  const s = Math.max(1, Math.min(20, skala));
  const el = o._obrazEl;
  const kadr = { x: 0, y: 0, skala: s };
  if (el) {
    const u = ukladObrazu({ ...o, obraz_kadr: kadr, width: o.width, height: o.height, scaleX: o.scaleX, scaleY: o.scaleY }, el);
    kadr.x = ogranicz(cx, (u.Wi - u.W) / 2) / u.W;
    kadr.y = ogranicz(cy, (u.Hi - u.H) / 2) / u.H;
  }
  const zaokr = (v) => Math.round(v * 10000) / 10000;
  o.obraz_kadr = { x: zaokr(kadr.x), y: zaokr(kadr.y), skala: zaokr(kadr.skala) };
  oznaczDoPrzerysowania(o);
}

if (!fabric.FabricObject.prototype._obrazWKsztalcie) {
  fabric.FabricObject.prototype._obrazWKsztalcie = true;
  const zwykle = fabric.FabricObject.prototype._renderFill;
  fabric.FabricObject.prototype._renderFill = function renderFill(ctx) {
    if (!maObraz(this)) { zwykle.call(this, ctx); return; }
    if (this.fill) zwykle.call(this, ctx); // kolor albo przejście pod obrazem (z cieniem kształtu)
    const el = elementDla(this);
    if (!el) return;
    const u = ukladObrazu(this, el);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    if (this.fillRule === 'evenodd') ctx.clip('evenodd'); else ctx.clip();
    ctx.drawImage(el, u.x, u.y, u.w, u.h);
    ctx.restore();
  };
}
