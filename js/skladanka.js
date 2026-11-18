// Składanki i wycinanki (#224): model z papieru z wielu części na wielu arkuszach.
//
// Część to grupa elementów budowana z definicji `czesc` (pole elementu, zapisywane w projekcie):
//   { nr: 'A', punkty: [{x,y}…] – obrys ściany w mm (układ części),
//     krawedzie: [{ typ: 'ciecie'|'zakladka'|'klej', para: '3'|null, szer: 7 }] – krawędź i: punkty[i] → punkty[i+1],
//     zgiecia: [{ a:{x,y}, b:{x,y}, rodzaj: 'dolina'|'gora', kat: 90 }] – linie zgięcia w środku części,
//     pola: [{ x, y, w, h, para, spod }] – miejsca klejenia na powierzchni (spod – na drugiej stronie, bez druku),
//     szczeliny: [{ a:{x,y}, b:{x,y}, szer }] – nacięcia na wypustki innych części (szerokość z grubości materiału),
//     kolor: '#ffffff', druk: 'domowy'|'drukarnia' }
// Krawędź 'wypustka' – język bez kleju do wsunięcia w szczelinę (ścianki, przegródki wsuwane do środka).
// Z niej powstają zwykłe elementy (dzięki temu PDF, plik dla plotera, kontrola i zapis do innych programów działają
// bez zmian): ściana (kolor części), zakładki klejowe z numerem pary, linie zgięć drukowane (dolina – kreski,
// góra – kreska-kropka) i na płycie Crease, obrys cięcia na płycie CutContour (#218) i drukowany cienki obrys
// (cięcie nożyczkami w domu), numer pary przy krawędzi do sklejenia i nazwa części.
//
// Moduł bez DOM: geometria (podział na ściany, zakładki) jest też dla makiety 3D i rozkładania na arkusze.

/* global fabric */

export const RODZAJE_KRAWEDZI = { ciecie: 'Cięcie', zakladka: 'Zakładka klejowa', klej: 'Do sklejenia (bez zakładki)', wypustka: 'Wypustka do szczeliny' };
export const RODZAJE_ZGIEC = { dolina: 'Dolina – zginaj do siebie', gora: 'Góra – zginaj od siebie' };
export const KRESKI = { dolina: [2.4, 1.6], gora: [3, 1.2, 0.6, 1.2] };
const SZER_ZAKLADKI = 7;
const zaokr = (v) => Math.round(v * 100) / 100;
const P = (x, y) => ({ x: zaokr(x), y: zaokr(y) });

export function normalizujCzesc(c = {}) {
  const punkty = (Array.isArray(c.punkty) ? c.punkty : []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map((p) => P(p.x, p.y));
  const krawedzie = punkty.map((_, i) => {
    const k = c.krawedzie?.[i] || {};
    return { typ: RODZAJE_KRAWEDZI[k.typ] ? k.typ : 'ciecie', para: k.para ? String(k.para) : null, szer: Number.isFinite(k.szer) && k.szer > 0 ? Math.min(30, k.szer) : SZER_ZAKLADKI };
  });
  const zgiecia = (Array.isArray(c.zgiecia) ? c.zgiecia : []).filter((z) => z?.a && z?.b).map((z) => ({
    a: P(z.a.x, z.a.y), b: P(z.b.x, z.b.y), rodzaj: z.rodzaj === 'gora' ? 'gora' : 'dolina', kat: Number.isFinite(z.kat) ? Math.max(0, Math.min(180, z.kat)) : 90,
  }));
  const liczba = (v, d) => (Number.isFinite(v) ? v : d);
  const pola = (Array.isArray(c.pola) ? c.pola : []).filter((x) => x && Number.isFinite(x.x) && Number.isFinite(x.y)).map((x) => ({
    x: zaokr(x.x), y: zaokr(x.y), w: zaokr(Math.max(2, liczba(x.w, 15))), h: zaokr(Math.max(2, liczba(x.h, 10))), para: x.para ? String(x.para) : null, spod: Boolean(x.spod),
  }));
  const szczeliny = (Array.isArray(c.szczeliny) ? c.szczeliny : []).filter((z) => z?.a && z?.b).map((z) => ({ a: P(z.a.x, z.a.y), b: P(z.b.x, z.b.y), szer: zaokr(Math.max(0.2, Math.min(10, liczba(z.szer, 0.8)))), para: z.para ? String(z.para) : null }));
  return {
    nr: String(c.nr || 'A'), punkty, krawedzie, zgiecia, pola, szczeliny, kolor: typeof c.kolor === 'string' ? c.kolor : '#ffffff',
    pokaz_numery: c.pokaz_numery !== false, druk: c.druk === 'drukarnia' ? 'drukarnia' : 'domowy',
    ...(Number.isFinite(c.uklad?.x) && Number.isFinite(c.uklad?.y) ? { uklad: { x: c.uklad.x, y: c.uklad.y } } : {}),
  };
}

// ---------- Geometria ----------

export function poleWielokata(p) {
  let s = 0;
  for (let i = 0; i < p.length; i += 1) { const a = p[i]; const b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}

// Normalna na zewnątrz krawędzi i (jednostkowa).
export function normalnaZewn(punkty, i) {
  const a = punkty[i];
  const b = punkty[(i + 1) % punkty.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return poleWielokata(punkty) > 0 ? { x: dy / l, y: -dx / l } : { x: -dy / l, y: dx / l };
}

// Zakładka na krawędzi i: trapez od krawędzi na zewnątrz (skos 45°, nie więcej niż 1/3 długości z każdej strony).
export function zakladka(punkty, i, szer = SZER_ZAKLADKI) {
  const a = punkty[i];
  const b = punkty[(i + 1) % punkty.length];
  const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const d = { x: (b.x - a.x) / dl, y: (b.y - a.y) / dl };
  const n = normalnaZewn(punkty, i);
  const w = Math.min(szer, dl * 0.45);
  const s = Math.min(w, dl / 3);
  return [a, b, P(b.x + n.x * w - d.x * s, b.y + n.y * w - d.y * s), P(a.x + n.x * w + d.x * s, a.y + n.y * w + d.y * s)];
}

// Wypustka na krawędzi i: prostokątny język o długości ok. 1/3 krawędzi, pośrodku, z małymi fazami na końcu.
export function wypustka(punkty, i, szer = SZER_ZAKLADKI) {
  const a = punkty[i];
  const b = punkty[(i + 1) % punkty.length];
  const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const d = { x: (b.x - a.x) / dl, y: (b.y - a.y) / dl };
  const n = normalnaZewn(punkty, i);
  const pol = Math.min(dl / 3, 30) / 2;
  const s = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const f = Math.min(1.5, szer / 3);
  const pk = (t, h) => P(s.x + d.x * t + n.x * h, s.y + d.y * t + n.y * h);
  return [pk(-pol, 0), pk(pol, 0), pk(pol, szer - f), pk(pol - f, szer), pk(-pol + f, szer), pk(-pol, szer - f)];
}

// Obrys cięcia: ściana z zakładkami i wypustkami (ich wierzchołki między końcami krawędzi).
export function obrysCiecia(c) {
  const wynik = [];
  c.punkty.forEach((p, i) => {
    wynik.push(p);
    const k = c.krawedzie[i];
    if (k?.typ === 'zakladka') { const z = zakladka(c.punkty, i, k.szer); wynik.push(z[3], z[2]); }
    else if (k?.typ === 'wypustka') { const z = wypustka(c.punkty, i, k.szer); wynik.push(z[0], z[5], z[4], z[3], z[2], z[1]); }
  });
  return wynik;
}

// Szczelina jako wąski prostokąt wokół odcinka a–b (do wycięcia).
export function prostokatSzczeliny(z) {
  const dl = Math.hypot(z.b.x - z.a.x, z.b.y - z.a.y) || 1;
  const n = { x: -(z.b.y - z.a.y) / dl * (z.szer / 2), y: (z.b.x - z.a.x) / dl * (z.szer / 2) };
  return [P(z.a.x + n.x, z.a.y + n.y), P(z.b.x + n.x, z.b.y + n.y), P(z.b.x - n.x, z.b.y - n.y), P(z.a.x - n.x, z.a.y - n.y)];
}


// Punkt na obwodzie wielokąta najbliższy p: { i (krawędź), t (0..1), punkt, odl }.
export function naObwodzie(punkty, p) {
  let naj = null;
  punkty.forEach((a, i) => {
    const b = punkty[(i + 1) % punkty.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const odl = Math.hypot(p.x - q.x, p.y - q.y);
    if (!naj || odl < naj.odl) naj = { i, t, punkt: q, odl };
  });
  return naj;
}

// Podział wielokąta cięciwą a–b (oba punkty na obwodzie) na dwa wielokąty – albo null.
export function podzielWielokat(punkty, a, b) {
  const pa = naObwodzie(punkty, a);
  const pb = naObwodzie(punkty, b);
  if (!pa || !pb || pa.odl > 0.6 || pb.odl > 0.6) return null;
  // Obwód z wstawionymi punktami a i b.
  const lista = [];
  let ia = -1;
  let ib = -1;
  punkty.forEach((p, i) => {
    lista.push(p);
    const wstaw = [[pa, 'a'], [pb, 'b']].filter(([q]) => q.i === i && q.t > 1e-6 && q.t < 1 - 1e-6).sort((x, y) => x[0].t - y[0].t);
    for (const [q, k] of wstaw) { lista.push(q.punkt); if (k === 'a') ia = lista.length - 1; else ib = lista.length - 1; }
    if (pa.i === i && pa.t <= 1e-6) ia = lista.length - 1;
    if (pb.i === i && pb.t <= 1e-6) ib = lista.length - 1;
  });
  const n = lista.length;
  if (ia < 0) ia = (lista.indexOf(punkty[(pa.i + 1) % punkty.length]));
  if (ib < 0) ib = (lista.indexOf(punkty[(pb.i + 1) % punkty.length]));
  if (ia < 0 || ib < 0 || ia === ib) return null;
  const luk = (od, do_) => { const w = []; for (let i = od; ; i = (i + 1) % n) { w.push(lista[i]); if (i === do_) break; } return w; };
  const p1 = luk(ia, ib);
  const p2 = luk(ib, ia);
  if (p1.length < 3 || p2.length < 3 || Math.abs(poleWielokata(p1)) < 0.5 || Math.abs(poleWielokata(p2)) < 0.5) return null;
  return [p1, p2];
}

// Ściany części: wielokąt podzielony kolejnymi zgięciami. Zwraca { sciany: [[{x,y}]], zawiasy: [{ s1, s2, a, b, zgiecie }] }.
export function scianyCzesci(c) {
  let sciany = [c.punkty];
  const uzyte = [];
  c.zgiecia.forEach((z, nr) => {
    const srodek = { x: (z.a.x + z.b.x) / 2, y: (z.a.y + z.b.y) / 2 };
    const i = sciany.findIndex((s) => wWielokacie(s, srodek));
    if (i < 0) return;
    const podzial = podzielWielokat(sciany[i], z.a, z.b);
    if (!podzial) return;
    sciany = [...sciany.slice(0, i), podzial[0], ...sciany.slice(i + 1), podzial[1]];
    uzyte.push(nr);
  });
  // Zawias: dwie ściany, na których obwodzie leży środek zgięcia.
  const zawiasy = [];
  for (const nr of uzyte) {
    const z = c.zgiecia[nr];
    const m = { x: (z.a.x + z.b.x) / 2, y: (z.a.y + z.b.y) / 2 };
    const przy = sciany.map((s, i) => [i, naObwodzie(s, m).odl]).filter(([, d]) => d < 0.6).map(([i]) => i);
    if (przy.length === 2) zawiasy.push({ s1: przy[0], s2: przy[1], a: z.a, b: z.b, zgiecie: nr });
  }
  return { sciany, zawiasy };
}

export function wWielokacie(p, q) {
  let w = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
    if ((p[i].y > q.y) !== (p[j].y > q.y) && q.x < ((p[j].x - p[i].x) * (q.y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) w = !w;
  }
  return w;
}

// Ramka części razem z zakładkami.
export function ramkaCzesci(c) {
  const o = obrysCiecia(c);
  const xs = o.map((p) => p.x);
  const ys = o.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// Środek ciężkości wielokąta (do podpisu części).
export function srodekWielokata(p) {
  const A = poleWielokata(p) || 1;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i += 1) { const a = p[i]; const b = p[(i + 1) % p.length]; const f = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f; }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

// ---------- Elementy edytora ----------

const KOLOR_LINII = '#6b6b6b';
const KOLOR_ZAKLADKI = '#eeeeee';

// Lista elementów Fabric części w układzie części (mm). Środek grupy liczy wywołujący.
export function elementyCzesci(def) {
  const c = normalizujCzesc(def);
  if (c.punkty.length < 3) return [];
  const el = [];
  const domowy = c.druk === 'domowy'; // druk domowy: linie cięcia i zgięć drukowane; drukarnia – tylko płyty techniczne
  const wspolne = { strokeUniform: true, objectCaching: false, selectable: false, evented: false };
  const zgiecie = (a, b, rodzaj) => {
    if (domowy) el.push(new fabric.Line([a.x, a.y, b.x, b.y], { ...wspolne, stroke: KOLOR_LINII, strokeWidth: 0.2, strokeDashArray: KRESKI[rodzaj], skladanka: 'zgiecie' }));
    el.push(new fabric.Line([a.x, a.y, b.x, b.y], { ...wspolne, stroke: '#1f6feb', strokeWidth: 0.3, uszlachetnienie: 'big', skladanka: 'zgiecie' }));
  };
  const numer = (t, x, y, rozmiar, kolor = '#555555') => el.push(new fabric.Text(t, { ...wspolne, left: x, top: y, originX: 'center', originY: 'center', fontSize: rozmiar, fontFamily: 'Inter', fill: kolor, skladanka: 'numer' }));
  // Zakładki i wypustki (pod ścianą – zgięcie u nasady rysuje się osobno).
  c.krawedzie.forEach((k, i) => {
    if (k.typ !== 'zakladka' && k.typ !== 'wypustka') return;
    const z = k.typ === 'zakladka' ? zakladka(c.punkty, i, k.szer) : wypustka(c.punkty, i, k.szer);
    el.push(new fabric.Polygon(z, { ...wspolne, fill: k.typ === 'zakladka' ? KOLOR_ZAKLADKI : c.kolor, stroke: null, strokeWidth: 0, nazwa: `${k.typ === 'zakladka' ? 'Zakładka' : 'Wypustka'} ${k.para || ''}`.trim(), skladanka: k.typ }));
    const [a, b] = k.typ === 'zakladka' ? [z[0], z[1]] : [z[0], z[1]];
    zgiecie(a, b, 'dolina');
    if (k.para && c.pokaz_numery) { const s = srodekWielokata(z); numer(k.para, s.x, s.y, Math.min(3.2, k.szer * 0.5)); }
  });
  el.push(new fabric.Polygon(c.punkty, { ...wspolne, fill: c.kolor, stroke: null, strokeWidth: 0, nazwa: 'Ściana', skladanka: 'sciana' }));
  for (const z of c.zgiecia) zgiecie(z.a, z.b, z.rodzaj);
  // Miejsca klejenia: na wierzchu – jasne pole z numerem (drukowane) i płyta Glue; na spodzie – tylko płyta Glue.
  for (const pole of c.pola) {
    const r = { left: pole.x, top: pole.y, width: pole.w, height: pole.h };
    if (!pole.spod) {
      el.push(new fabric.Rect({ ...wspolne, ...r, fill: '#e6efe0', stroke: '#9bb58a', strokeWidth: 0.2, strokeDashArray: [1.2, 0.8], skladanka: 'pole' }));
      if (pole.para && c.pokaz_numery) numer(`${pole.para}`, pole.x + pole.w / 2, pole.y + pole.h / 2, Math.min(3.2, pole.h * 0.45), '#5f7a50');
    }
    el.push(new fabric.Rect({ ...wspolne, ...r, fill: '#14a35a', stroke: null, strokeWidth: 0, opacity: 0.25, uszlachetnienie: 'klej', skladanka: pole.spod ? 'pole-spod' : 'pole-klej' }));
  }
  // Numery krawędzi do sklejenia (bez zakładki) – po wewnętrznej stronie.
  c.krawedzie.forEach((k, i) => {
    if (k.typ !== 'klej' || !k.para || !c.pokaz_numery) return;
    const a = c.punkty[i];
    const b = c.punkty[(i + 1) % c.punkty.length];
    const n = normalnaZewn(c.punkty, i);
    numer(k.para, (a.x + b.x) / 2 - n.x * 2.4, (a.y + b.y) / 2 - n.y * 2.4, 2.6, '#777777');
  });
  if (c.pokaz_numery) { const s = srodekWielokata(c.punkty); numer(c.nr, s.x, s.y, 3, '#9a9a9a'); }
  const obrys = obrysCiecia(c);
  if (domowy) el.push(new fabric.Polygon(obrys, { ...wspolne, fill: null, stroke: '#888888', strokeWidth: 0.15, skladanka: 'obrys' }));
  el.push(new fabric.Polygon(obrys, { ...wspolne, fill: null, stroke: '#e0004d', strokeWidth: 0.3, uszlachetnienie: 'ciecie', skladanka: 'ciecie' }));
  // Szczeliny – wycinane (osobne kontury cięcia).
  for (const z of c.szczeliny) {
    const pr = prostokatSzczeliny(z);
    if (domowy) el.push(new fabric.Polygon(pr, { ...wspolne, fill: null, stroke: '#888888', strokeWidth: 0.15, skladanka: 'obrys' }));
    el.push(new fabric.Polygon(pr, { ...wspolne, fill: null, stroke: '#e0004d', strokeWidth: 0.3, uszlachetnienie: 'ciecie', skladanka: 'szczelina' }));
    if (z.para && c.pokaz_numery) { const n = { x: (z.a.x + z.b.x) / 2, y: (z.a.y + z.b.y) / 2 }; numer(z.para, n.x + 2.5, n.y + 2.5, 2.4, '#777777'); }
  }
  return el;
}

// Grupa części. Elementy powstają w układzie części przesuniętym o (left, top) – Fabric liczy z nich ramkę grupy;
// `czesc.uklad` zapamiętuje, który punkt części jest środkiem grupy (do przeliczeń punkt strony ↔ punkt części).
// Przebudowa (`grupa` – dotychczasowa grupa) daje NOWĄ grupę w tym samym miejscu, z tym samym obrotem: punkty
// części, które się nie zmieniły, zostają na stronie tam, gdzie były. Podmienia ją wywołujący.
export function zbudujCzesc(def, { grupa = null, left = 0, top = 0 } = {}) {
  const c = normalizujCzesc(def);
  const el = elementyCzesci(c);
  for (const o of el) { o.set({ left: o.left + left, top: o.top + top }); o.setCoords(); }
  const g = new fabric.Group(el, { nazwa: `Część ${c.nr}`, subTargetCheck: false, interactive: false, objectCaching: false });
  const srodek = g.getCenterPoint();
  c.uklad = { x: zaokr(srodek.x - left), y: zaokr(srodek.y - top) };
  g.czesc = c;
  if (!grupa) return g;
  // To samo miejsce i obrót: środek nowej grupy = punkt strony, w którym stary układ ma nowy środek.
  const m = grupa.calcTransformMatrix();
  const stary = grupa.czesc?.uklad || ramkaSrodek(normalizujCzesc(grupa.czesc));
  const naStronie = fabric.util.transformPoint(new fabric.Point(c.uklad.x - stary.x, c.uklad.y - stary.y), m);
  g.set({ angle: grupa.angle || 0, flipX: Boolean(grupa.flipX), flipY: Boolean(grupa.flipY) });
  g.setPositionByOrigin(naStronie, 'center', 'center');
  g.setCoords();
  return g;
}

const ramkaSrodek = (c) => { const r = ramkaCzesci(c); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
const srodekUkladu = (grupa) => grupa.czesc?.uklad || ramkaSrodek(normalizujCzesc(grupa.czesc));

// Punkt strony (mm) → układ części (mm) dla grupy części.
export function doUkladuCzesci(grupa, p) {
  const s = srodekUkladu(grupa);
  const q = fabric.util.transformPoint(new fabric.Point(p.x, p.y), fabric.util.invertTransform(grupa.calcTransformMatrix()));
  return { x: q.x + s.x, y: q.y + s.y };
}
export function zUkladuCzesci(grupa, p) {
  const s = srodekUkladu(grupa);
  return fabric.util.transformPoint(new fabric.Point(p.x - s.x, p.y - s.y), grupa.calcTransformMatrix());
}

// Definicja części z kształtu (prostokąt, wielokąt, ścieżka z odcinków, elipsa – przybliżona) w układzie strony.
export function czescZKsztaltu(o, nr = 'A') {
  const m = o.calcTransformMatrix();
  let lokalne = null;
  const t = String(o.type).toLowerCase();
  if (t === 'rect') lokalne = [[-o.width / 2, -o.height / 2], [o.width / 2, -o.height / 2], [o.width / 2, o.height / 2], [-o.width / 2, o.height / 2]];
  else if (t === 'polygon' || t === 'polyline') lokalne = o.points.map((q) => [q.x - o.pathOffset.x, q.y - o.pathOffset.y]);
  else if (t === 'triangle') lokalne = [[0, -o.height / 2], [o.width / 2, o.height / 2], [-o.width / 2, o.height / 2]];
  else if (t === 'ellipse' || t === 'circle') {
    const rx = o.rx ?? o.radius;
    const ry = o.ry ?? o.radius;
    lokalne = Array.from({ length: 24 }, (_, i) => { const k = (i / 24) * 2 * Math.PI; return [rx * Math.cos(k), ry * Math.sin(k)]; });
  } else if (t === 'path') {
    lokalne = [];
    for (const k of o.path || []) {
      const v = k.slice(1);
      if (v.length >= 2) lokalne.push([v[v.length - 2] - o.pathOffset.x, v[v.length - 1] - o.pathOffset.y]);
    }
  }
  if (!lokalne || lokalne.length < 3) return null;
  const punkty = lokalne.map(([x, y]) => fabric.util.transformPoint(new fabric.Point(x, y), m));
  // Bez powtórzonego ostatniego punktu.
  const ost = punkty[punkty.length - 1];
  if (Math.hypot(ost.x - punkty[0].x, ost.y - punkty[0].y) < 0.01) punkty.pop();
  const minX = Math.min(...punkty.map((q) => q.x));
  const minY = Math.min(...punkty.map((q) => q.y));
  return {
    def: normalizujCzesc({ nr, punkty: punkty.map((q) => ({ x: q.x - minX, y: q.y - minY })), kolor: typeof o.fill === 'string' ? o.fill : '#ffffff' }),
    left: minX, top: minY,
  };
}

// Następna wolna nazwa części (A, B, … Z, AA…) i numer pary krawędzi w projekcie.
export function kolejnaNazwa(uzyte) {
  for (let i = 0; i < 702; i += 1) {
    const n = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    if (!uzyte.has(n)) return n;
  }
  return `C${uzyte.size + 1}`;
}
export function kolejnaPara(uzyte) {
  let n = 1;
  while (uzyte.has(String(n))) n += 1;
  return String(n);
}

// Wszystkie części na liście obiektów (także w grupach), z nazwami i parami.
export function czesciWObiektach(obiekty) {
  const wynik = [];
  const idz = (lista) => { for (const o of lista || []) { if (o?.czesc) wynik.push(o); else if (o?.objects) idz(o.objects); } };
  idz(obiekty);
  return wynik;
}

// ---------- Sprawdzanie (#234) ----------

const dlKrawedzi = (c, i) => { const a = c.punkty[i]; const b = c.punkty[(i + 1) % c.punkty.length]; return Math.hypot(b.x - a.x, b.y - a.y); };
const mmTxt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

// Narożniki części na stronie z zapisanej grupy (left/top to punkt początku – origin – grupy; obrót wokół niego).
export function ramkaNaStronie(o) {
  const w = (o.width || 0) * (o.scaleX || 1);
  const h = (o.height || 0) * (o.scaleY || 1);
  const ox = o.originX === 'center' ? w / 2 : o.originX === 'right' ? w : 0;
  const oy = o.originY === 'center' ? h / 2 : o.originY === 'bottom' ? h : 0;
  const k = ((o.angle || 0) * Math.PI) / 180;
  const pkt = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => {
    const dx = x - ox; const dy = y - oy;
    return { x: (o.left || 0) + dx * Math.cos(k) - dy * Math.sin(k), y: (o.top || 0) + dx * Math.sin(k) + dy * Math.cos(k) };
  });
  const xs = pkt.map((p) => p.x);
  const ys = pkt.map((p) => p.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

// Uwagi o częściach na arkuszach sekcji składanki: [{ rodzaj, opis, strony, idStrony?, idObiektu? }].
// arkusze: [{ strona (obiekt strony projektu), nr (numer w wydruku), w, h, margines, grubosc }].
export function uwagiSkladanki(arkusze) {
  const uwagi = [];
  const wpisy = new Map(); // para → [{ rodzaj: 'zakladka'|'klej'|'wypustka'|'pole'|'szczelina', dl, gdzie }]
  for (const a of arkusze) {
    for (const o of czesciWObiektach(a.strona.obiekty)) {
      const c = normalizujCzesc(o.czesc);
      const gdzie = { strony: a.nr ? [a.nr] : [], idStrony: a.strona.id, idObiektu: o.id, nazwa: c.nr };
      const r = ramkaNaStronie(o);
      if (r.x1 < -0.2 || r.y1 < -0.2 || r.x2 > a.w + 0.2 || r.y2 > a.h + 0.2) uwagi.push({ rodzaj: 'skladanka', ...gdzie, opis: `Część ${c.nr} wystaje poza arkusz – przesuń ją albo przenieś na inny arkusz.` });
      else if (a.margines > 0 && (r.x1 < a.margines || r.y1 < a.margines || r.x2 > a.w - a.margines || r.y2 > a.h - a.margines)) uwagi.push({ rodzaj: 'skladanka', ...gdzie, opis: `Część ${c.nr} wchodzi w margines drukarki (${mmTxt(a.margines)} mm) – ten kawałek może się nie wydrukować.` });
      c.krawedzie.forEach((k, i) => { if (k.para && k.typ !== 'ciecie') (wpisy.get(k.para) || wpisy.set(k.para, []).get(k.para)).push({ rodzaj: k.typ, dl: dlKrawedzi(c, i), szer: k.szer, gdzie, opis: `krawędź ${i + 1} części ${c.nr}` }); });
      for (const p of c.pola) if (p.para) (wpisy.get(p.para) || wpisy.set(p.para, []).get(p.para)).push({ rodzaj: 'pole', dl: Math.max(p.w, p.h), szer: Math.min(p.w, p.h), gdzie, opis: `miejsce klejenia na części ${c.nr}` });
      for (const z of c.szczeliny) {
        if (z.para) (wpisy.get(z.para) || wpisy.set(z.para, []).get(z.para)).push({ rodzaj: 'szczelina', dl: Math.hypot(z.b.x - z.a.x, z.b.y - z.a.y), gdzie, opis: `szczelina na części ${c.nr}` });
        if (z.szer < a.grubosc) uwagi.push({ rodzaj: 'skladanka', ...gdzie, opis: `Szczelina na części ${c.nr} ma ${mmTxt(z.szer)} mm, a materiał ${mmTxt(a.grubosc)} mm – wypustka się nie zmieści. Ustaw szerokość co najmniej ${mmTxt(a.grubosc + 0.2)} mm.` });
      }
    }
  }
  for (const [para, lista] of wpisy) {
    const g = lista[0].gdzie;
    if (lista.length === 1) { uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Numer ${para} (${lista[0].opis}) nie ma pary – nie wiadomo, do czego to przykleić. Połącz z krawędzią albo miejscem (narzędzie „Połącz”) albo usuń numer.` }); continue; }
    if (lista.length > 2) uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Numer ${para} jest użyty ${lista.length} razy (${lista.map((x) => x.opis).join(', ')}) – para to dwa miejsca; nadaj pozostałym inne numery.` });
    const krawedzie = lista.filter((w) => ['zakladka', 'klej'].includes(w.rodzaj));
    if (krawedzie.length === 2 && Math.abs(krawedzie[0].dl - krawedzie[1].dl) > 0.5) uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Para ${para}: krawędzie mają różne długości (${mmTxt(krawedzie[0].dl)} i ${mmTxt(krawedzie[1].dl)} mm) – po sklejeniu jedna będzie wystawać.` });
    const zak = lista.find((w) => w.rodzaj === 'zakladka');
    const pole = lista.find((w) => w.rodzaj === 'pole');
    if (zak && pole && (pole.dl < zak.dl - 3 || pole.szer < zak.szer - 1)) uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Para ${para}: miejsce klejenia (${mmTxt(pole.dl)} × ${mmTxt(pole.szer)} mm) jest mniejsze niż zakładka (${mmTxt(zak.dl)} × ${mmTxt(zak.szer)} mm) – klej wyjdzie poza nie.` });
    const wyp = lista.find((w) => w.rodzaj === 'wypustka');
    const szcz = lista.find((w) => w.rodzaj === 'szczelina');
    if (wyp && szcz && szcz.dl < Math.min(wyp.dl / 3, 30) + 0.5) uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Para ${para}: szczelina (${mmTxt(szcz.dl)} mm) jest krótsza niż wypustka (${mmTxt(Math.min(wyp.dl / 3, 30))} mm).` });
  }
  return uwagi;
}
