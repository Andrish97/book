// Składanki i wycinanki (#224): model z papieru z wielu części na wielu arkuszach.
//
// Część to grupa elementów budowana z definicji `czesc` (pole elementu, zapisywane w projekcie):
//   { nr: 'A', punkty: [{x,y}…] – obrys ściany w mm (układ części),
//     krawedzie: [{ typ: 'ciecie'|'zakladka'|'klej', para: '3'|null, szer: 7 }] – krawędź i: punkty[i] → punkty[i+1],
//     zgiecia: [{ a:{x,y}, b:{x,y}, rodzaj: 'dolina'|'gora', kat: 90 }] – linie zgięcia w środku części,
//     pola: [{ x, y, w, h, para, spod }] – miejsca klejenia na powierzchni (spod – na drugiej stronie, bez druku),
//     szczeliny: [{ a:{x,y}, b:{x,y}, szer, naciecie? }] – nacięcia na wypustki innych części (szerokość z grubości materiału);
//       naciecie: true – zwykłe cięcie w środku części (pop-up), bez wypustki,
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
    ...(z.luk && Number.isFinite(z.luk.x) && Number.isFinite(z.luk.y) ? { luk: P(z.luk.x, z.luk.y) } : {}),
  }));
  const liczba = (v, d) => (Number.isFinite(v) ? v : d);
  const pola = (Array.isArray(c.pola) ? c.pola : []).filter((x) => x && Number.isFinite(x.x) && Number.isFinite(x.y)).map((x) => ({
    x: zaokr(x.x), y: zaokr(x.y), w: zaokr(Math.max(2, liczba(x.w, 15))), h: zaokr(Math.max(2, liczba(x.h, 10))), para: x.para ? String(x.para) : null, spod: Boolean(x.spod),
    ...(Number.isFinite(x.kat) && x.kat ? { kat: zaokr(x.kat) } : {}),
  }));
  const szczeliny = (Array.isArray(c.szczeliny) ? c.szczeliny : []).filter((z) => z?.a && z?.b).map((z) => ({ a: P(z.a.x, z.a.y), b: P(z.b.x, z.b.y), szer: zaokr(Math.max(0.2, Math.min(10, liczba(z.szer, 0.8)))), para: z.para ? String(z.para) : null, ...(z.naciecie ? { naciecie: true } : {}) }));
  return {
    nr: String(c.nr || 'A'), ...(typeof c.opis === 'string' && c.opis ? { opis: c.opis.slice(0, 80) } : {}), punkty, krawedzie, zgiecia, pola, szczeliny, kolor: typeof c.kolor === 'string' ? c.kolor : '#ffffff',
    // Nadruk (#283): obraz projektu (zasób) w prostokącie części – tekstura modelu 3D.
    ...(c.nadruk && typeof c.nadruk.zasob === 'string' && [c.nadruk.x, c.nadruk.y, c.nadruk.w, c.nadruk.h].every(Number.isFinite) && c.nadruk.w > 0 && c.nadruk.h > 0
      ? { nadruk: { zasob: c.nadruk.zasob, x: zaokr(c.nadruk.x), y: zaokr(c.nadruk.y), w: zaokr(c.nadruk.w), h: zaokr(c.nadruk.h) } } : {}),
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
// Ściany części z nacięciami (#273 – kartka pop-up „wycinanka”): podział planarny obrysu, zgięć i nacięć. Odcinki
// dzielone w punktach przecięć i końcach innych odcinków, półkrawędzie, ściany jako cykle (skręt w lewo); ściana
// zewnętrzna (ujemne pole) odpada. Zawias – zgięcie między dwiema ścianami; nacięcie rozdziela ściany bez zawiasu.
// Zgięcie po łuku (#281): łuk okręgu przez a, luk (punkt w połowie łuku) i b – punkty co ok. 1–2 mm do rysowania
// linii bigowania. Gdy trzy punkty leżą na prostej – odcinek. Ściany i makieta 3D pomijają zgięcia po łuku
// (karton gnie się po krzywej sprężyście – jak w pudełku-poduszce), kontrola i instrukcja liczą je jak zwykłe.
export function punktyLuku(a, m, b, n = 24) {
  const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y));
  if (Math.abs(d) < 1e-9) return [a, b];
  const q = (p) => p.x * p.x + p.y * p.y;
  const ux = (q(a) * (m.y - b.y) + q(m) * (b.y - a.y) + q(b) * (a.y - m.y)) / d;
  const uy = (q(a) * (b.x - m.x) + q(m) * (a.x - b.x) + q(b) * (m.x - a.x)) / d;
  const r = Math.hypot(a.x - ux, a.y - uy);
  const k = (p) => Math.atan2(p.y - uy, p.x - ux);
  const ka = k(a); let km = k(m) - ka; let kb = k(b) - ka;
  const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  km = norm(km); kb = norm(kb);
  const zakres = km < kb ? kb : kb - 2 * Math.PI; // przez punkt m
  return Array.from({ length: n + 1 }, (_, i) => (i === 0 ? { ...a } : i === n ? { ...b } : { x: ux + r * Math.cos(ka + (zakres * i) / n), y: uy + r * Math.sin(ka + (zakres * i) / n) }));
}

function scianyPlanarne(c) {
  const EPS = 0.01;
  const kl = (p) => `${Math.round(p.x / EPS)},${Math.round(p.y / EPS)}`;
  const odc = [];
  c.punkty.forEach((p, i) => odc.push({ a: p, b: c.punkty[(i + 1) % c.punkty.length], typ: 'brzeg' }));
  c.zgiecia.forEach((z, i) => { if (!z.luk) odc.push({ a: z.a, b: z.b, typ: 'zgiecie', nr: i }); });
  for (const z of c.szczeliny) if (z.naciecie) odc.push({ a: z.a, b: z.b, typ: 'ciecie' });
  // Punkty podziału każdego odcinka.
  const naOdcinku = (p, a, b) => {
    const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1e-12;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    if (t <= 1e-6 || t >= 1 - 1e-6) return null;
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    return Math.hypot(q.x - p.x, q.y - p.y) < EPS ? t : null;
  };
  const przeciecie = (o1, o2) => {
    const r = { x: o1.b.x - o1.a.x, y: o1.b.y - o1.a.y };
    const q = { x: o2.b.x - o2.a.x, y: o2.b.y - o2.a.y };
    const d = r.x * q.y - r.y * q.x;
    if (Math.abs(d) < 1e-9) return null;
    const t = ((o2.a.x - o1.a.x) * q.y - (o2.a.y - o1.a.y) * q.x) / d;
    const u = ((o2.a.x - o1.a.x) * r.y - (o2.a.y - o1.a.y) * r.x) / d;
    return t > 1e-6 && t < 1 - 1e-6 && u > -1e-6 && u < 1 + 1e-6 ? t : null;
  };
  const krawedzie = [];
  odc.forEach((o, i) => {
    const ts = [0, 1];
    odc.forEach((o2, j) => {
      if (i === j) return;
      for (const p of [o2.a, o2.b]) { const t = naOdcinku(p, o.a, o.b); if (t !== null) ts.push(t); }
      const t = przeciecie(o, o2);
      if (t !== null) ts.push(t);
    });
    const pk = [...new Set(ts.map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y).map((t) => ({ x: o.a.x + (o.b.x - o.a.x) * t, y: o.a.y + (o.b.y - o.a.y) * t }));
    for (let k = 0; k + 1 < pk.length; k += 1) if (kl(pk[k]) !== kl(pk[k + 1])) krawedzie.push({ u: pk[k], v: pk[k + 1], typ: o.typ, nr: o.nr });
  });
  // Bez powtórzeń (np. zgięcie na brzegu) – pierwszy wygrywa, zgięcie ma pierwszeństwo przed brzegiem.
  const unik = new Map();
  for (const e of krawedzie) {
    const k = [kl(e.u), kl(e.v)].sort().join('|');
    if (!unik.has(k) || (unik.get(k).typ === 'brzeg' && e.typ === 'zgiecie')) unik.set(k, e);
  }
  const wierz = new Map();
  const pol = [];
  for (const e of unik.values()) {
    for (const [a, b] of [[e.u, e.v], [e.v, e.u]]) {
      const h = { od: kl(a), do: kl(b), a, b, e, kat: Math.atan2(b.y - a.y, b.x - a.x) };
      pol.push(h);
      (wierz.get(h.od) || wierz.set(h.od, []).get(h.od)).push(h);
    }
  }
  for (const l of wierz.values()) l.sort((x, y) => x.kat - y.kat);
  const blizniak = new Map(pol.map((h) => [`${h.od}>${h.do}`, h]));
  const uzyte = new Set();
  const sciany = [];
  const scianaPol = new Map();
  for (const h0 of pol) {
    if (uzyte.has(h0)) continue;
    const cykl = [];
    let h = h0;
    let straz = 0;
    while (h && !uzyte.has(h) && straz < 10000) {
      uzyte.add(h);
      cykl.push(h);
      // Następna: przy końcu h – półkrawędź tuż przed bliźniakiem w kolejności kątów (skręt w lewo przy osi y w dół).
      const wyj = wierz.get(h.do);
      const bl = blizniak.get(`${h.do}>${h.od}`);
      const i = wyj.indexOf(bl);
      h = wyj[(i - 1 + wyj.length) % wyj.length];
      straz += 1;
    }
    const w = cykl.map((x) => x.a);
    if (poleWielokata(w) > 1e-3) { const nr = sciany.length; sciany.push(w); for (const x of cykl) scianaPol.set(x, nr); }
  }
  const zawiasy = [];
  const juz = new Set();
  for (const h of pol) {
    if (h.e.typ !== 'zgiecie') continue;
    const s1 = scianaPol.get(h);
    const s2 = scianaPol.get(blizniak.get(`${h.do}>${h.od}`));
    if (s1 === undefined || s2 === undefined || s1 === s2) continue;
    const k = `${Math.min(s1, s2)}|${Math.max(s1, s2)}|${h.e.nr}`;
    if (juz.has(k)) continue;
    juz.add(k);
    zawiasy.push({ s1, s2, a: h.a, b: h.b, zgiecie: h.e.nr });
  }
  return { sciany, zawiasy };
}

// Rozcięcie części linią a → b (oba punkty na obwodzie) na dwie części (#274 – za duża część, ręczne dzielenie modelu).
// Krawędzie dziedziczą rodzaj i parę po krawędzi, na której leżą; nowa krawędź cięcia: w pierwszej części zakładka,
// w drugiej – do sklejenia, z numerem pary `para`. Zgięcia, pola i szczeliny trafiają do części, w której leży ich
// środek (zgięcie przecinające linię jest przycinane do niej). Zwraca [część1, część2] albo null.
export function rozetnijCzesc(c, a, b, para) {
  const podzial = podzielWielokat(c.punkty, a, b);
  if (!podzial) return null;
  const blisko = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.02;
  const naOdc = (p, u, v) => { const d = naObwodzie([u, v], p); return d && d.odl < 0.02; };
  const przeciecieZCieciem = (u, v) => {
    const r = { x: v.x - u.x, y: v.y - u.y };
    const q = { x: b.x - a.x, y: b.y - a.y };
    const d = r.x * q.y - r.y * q.x;
    if (Math.abs(d) < 1e-9) return null;
    const t = ((a.x - u.x) * q.y - (a.y - u.y) * q.x) / d;
    return t > 0 && t < 1 ? { x: u.x + r.x * t, y: u.y + r.y * t } : null;
  };
  return podzial.map((w, nr) => {
    const krawedzie = w.map((u, i) => {
      const v = w[(i + 1) % w.length];
      if ((blisko(u, nr === 0 ? b : a) && blisko(v, nr === 0 ? a : b))) return nr === 0 ? { typ: 'zakladka', para, szer: 7 } : { typ: 'klej', para };
      const j = c.punkty.findIndex((p, k) => naOdc(u, p, c.punkty[(k + 1) % c.punkty.length]) && naOdc(v, p, c.punkty[(k + 1) % c.punkty.length]));
      return j >= 0 ? { ...c.krawedzie[j] } : { typ: 'ciecie' };
    });
    const wSrodku = (p) => wWielokacie(w, p) || (naObwodzie(w, p)?.odl ?? 1) < 0.02;
    const zgiecia = [];
    for (const z of c.zgiecia) {
      const sr = { x: (z.a.x + z.b.x) / 2, y: (z.a.y + z.b.y) / 2 };
      const ma = wSrodku(z.a);
      const mb = wSrodku(z.b);
      if (ma && mb && wSrodku(sr)) zgiecia.push(z);
      else if (ma || mb) { const x = przeciecieZCieciem(z.a, z.b); if (x) zgiecia.push({ ...z, a: ma ? z.a : x, b: mb ? z.b : x }); }
    }
    const srodekPolaKl = (p) => { const r = rogiPola(p); return { x: (r[0].x + r[2].x) / 2, y: (r[0].y + r[2].y) / 2 }; };
    return {
      punkty: w, krawedzie, zgiecia, nadruk: undefined, // nadruk obejmował całą część – po rozcięciu by wystawał
      pola: (c.pola || []).filter((p) => wWielokacie(w, srodekPolaKl(p))),
      szczeliny: (c.szczeliny || []).filter((z) => wWielokacie(w, { x: (z.a.x + z.b.x) / 2, y: (z.a.y + z.b.y) / 2 })),
    };
  });
}

// Scalenie dwóch części po parze krawędzi (#275, odwrotność rozetnijCzesc): krawędź i1 części c1 (A → B) i krawędź i2
// części c2 (C → D) mają ten sam numer pary. c2 obracamy i przesuwamy tak, by C trafiło w B, a D w A; obrys: c1 od B
// do A, potem c2 bez krawędzi i2. Krawędź klejenia staje się zgięciem (góra, 90°). Nachodzenie obrysu – null.
export function scalCzesci(c1, i1, c2, i2) {
  const n = c1.punkty.length;
  const m = c2.punkty.length;
  const A = c1.punkty[i1];
  const B = c1.punkty[(i1 + 1) % n];
  const C = c2.punkty[i2];
  const D = c2.punkty[(i2 + 1) % m];
  const k1 = Math.atan2(A.y - B.y, A.x - B.x);
  const k2 = Math.atan2(D.y - C.y, D.x - C.x);
  if (Math.abs(Math.hypot(A.x - B.x, A.y - B.y) - Math.hypot(D.x - C.x, D.y - C.y)) > 0.5) return null;
  const kat = k1 - k2;
  const cs = Math.cos(kat);
  const sn = Math.sin(kat);
  const T = (p) => ({ x: zaokr(B.x + (p.x - C.x) * cs - (p.y - C.y) * sn), y: zaokr(B.y + (p.x - C.x) * sn + (p.y - C.y) * cs) });
  // Obie części z tym samym obiegiem – inaczej odbijamy c2 (nie: część ma nadruk tylko z jednej strony).
  if (Math.sign(poleWielokata(c1.punkty)) !== Math.sign(poleWielokata(c2.punkty))) return null;
  const punkty = [];
  const krawedzie = [];
  for (let k = 0; k < n; k += 1) { const j = (i1 + 1 + k) % n; punkty.push(c1.punkty[j]); if (j !== i1) krawedzie.push({ ...c1.krawedzie[j] }); }
  // Po A (ostatni z c1) – krawędź A → kolejny z c2: to krawędź c2 po i2 (D → …).
  for (let k = 2; k < m; k += 1) { const j = (i2 + k) % m; punkty.push(T(c2.punkty[j])); }
  for (let k = 1; k < m; k += 1) krawedzie.push({ ...c2.krawedzie[(i2 + k) % m] });
  // Samoprzecięcia obrysu (części nachodziłyby na siebie).
  const L = punkty.length;
  const tnie = (p1, p2, p3, p4) => {
    const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = o(p3, p4, p1); const d2 = o(p3, p4, p2); const d3 = o(p1, p2, p3); const d4 = o(p1, p2, p4);
    return ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) && ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6));
  };
  for (let i = 0; i < L; i += 1) for (let j = i + 2; j < L; j += 1) {
    if (i === 0 && j === L - 1) continue;
    if (tnie(punkty[i], punkty[(i + 1) % L], punkty[j], punkty[(j + 1) % L])) return null;
  }
  const Tz = (z) => ({ ...z, a: T(z.a), b: T(z.b), ...(z.luk ? { luk: T(z.luk) } : {}) });
  const wynik = {
    punkty, krawedzie, nadruk: undefined,
    zgiecia: [...c1.zgiecia, ...c2.zgiecia.map(Tz), { a: { ...A }, b: { ...B }, rodzaj: 'gora', kat: 90 }],
    pola: [...(c1.pola || []), ...(c2.pola || []).map((p) => { const q = T(p); return { ...p, x: q.x, y: q.y, kat: zaokr(((p.kat || 0) + (kat * 180) / Math.PI) % 360) }; })],
    szczeliny: [...(c1.szczeliny || []), ...(c2.szczeliny || []).map(Tz)],
  };
  // Dla treści ścian doklejanej części (#284): punkt i kąt (stopnie) z układu c2 do układu wyniku – poza zapisem.
  Object.defineProperty(wynik, 'przeksztalc', { value: (p) => T(p), enumerable: false });
  Object.defineProperty(wynik, 'obrot', { value: (kat * 180) / Math.PI, enumerable: false });
  return wynik;
}

export function scianyCzesci(c) {
  if ((c.szczeliny || []).some((z) => z.naciecie)) return scianyPlanarne(c);
  let sciany = [c.punkty];
  const uzyte = [];
  c.zgiecia.forEach((z, nr) => {
    if (z.luk) return;
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
// Obrazy nadruku (#283): zasób → wczytany element <img>/<canvas>. Wypełnia aplikacja przed wstawieniem części;
// przebudowa części bierze element z dotychczasowej grupy (po wczytaniu projektu obraz jest już w jej środku).
export const elementyNadruku = new Map();
export function elementyCzesci(def) {
  const c = normalizujCzesc(def);
  if (c.punkty.length < 3) return [];
  const el = [];
  const domowy = c.druk === 'domowy'; // druk domowy: linie cięcia i zgięć drukowane; drukarnia – tylko płyty techniczne
  const wspolne = { strokeUniform: true, objectCaching: false, selectable: false, evented: false };
  const zgiecie = (a, b, rodzaj, luk) => {
    const linia = (o) => (luk ? new fabric.Polyline(punktyLuku(a, luk, b), { ...o, fill: null }) : new fabric.Line([a.x, a.y, b.x, b.y], o));
    if (domowy) el.push(linia({ ...wspolne, stroke: KOLOR_LINII, strokeWidth: 0.2, strokeDashArray: KRESKI[rodzaj], skladanka: 'zgiecie' }));
    el.push(linia({ ...wspolne, stroke: '#1f6feb', strokeWidth: 0.3, uszlachetnienie: 'big', skladanka: 'zgiecie' }));
  };
  const numer = (t, x, y, rozmiar, kolor = '#555555') => el.push(new fabric.Text(t, { ...wspolne, left: x, top: y, originX: 'center', originY: 'center', fontSize: rozmiar, fontFamily: 'Inter', fill: kolor, skladanka: 'numer' }));
  // Zakładki i wypustki (pod ścianą – zgięcie u nasady rysuje się osobno).
  c.krawedzie.forEach((k, i) => {
    if (k.typ !== 'zakladka' && k.typ !== 'wypustka') return;
    const z = k.typ === 'zakladka' ? zakladka(c.punkty, i, k.szer) : wypustka(c.punkty, i, k.szer);
    el.push(new fabric.Polygon(z, { ...wspolne, fill: k.typ === 'zakladka' ? KOLOR_ZAKLADKI : c.kolor, stroke: null, strokeWidth: 0, nazwa: `${k.typ === 'zakladka' ? 'Zakładka' : 'Wypustka'} ${k.para || ''}`.trim(), skladanka: k.typ }));
    const [a, b] = k.typ === 'zakladka' ? [z[0], z[1]] : [z[0], z[1]];
    zgiecie(a, b, 'gora'); // zakładka chowa się pod spód (nadruk na zewnątrz)
    if (k.para && c.pokaz_numery) { const s = srodekWielokata(z); numer(k.para, s.x, s.y, Math.min(3.2, k.szer * 0.5)); }
  });
  el.push(new fabric.Polygon(c.punkty, { ...wspolne, fill: c.kolor, stroke: null, strokeWidth: 0, nazwa: 'Ściana', skladanka: 'sciana' }));
  const obrazNadruku = c.nadruk && elementyNadruku.get(c.nadruk.zasob);
  if (obrazNadruku) {
    const iw = obrazNadruku.naturalWidth || obrazNadruku.width;
    const ih = obrazNadruku.naturalHeight || obrazNadruku.height;
    el.push(new fabric.FabricImage(obrazNadruku, { ...wspolne, left: c.nadruk.x, top: c.nadruk.y, originX: 'left', originY: 'top', scaleX: c.nadruk.w / iw, scaleY: c.nadruk.h / ih, zasob: c.nadruk.zasob, nazwa: 'Nadruk', skladanka: 'nadruk' }));
  }
  for (const z of c.zgiecia) zgiecie(z.a, z.b, z.rodzaj, z.luk);
  // Miejsca klejenia: na wierzchu – jasne pole z numerem (drukowane) i płyta Glue; na spodzie – tylko płyta Glue.
  for (const pole of c.pola) {
    // Pole obrócone o kat (stopnie) wokół lewego górnego rogu (#272 – zgięcie V klei się pod kątem do grzbietu).
    const r = { left: pole.x, top: pole.y, width: pole.w, height: pole.h, angle: pole.kat || 0 };
    if (!pole.spod) {
      el.push(new fabric.Rect({ ...wspolne, ...r, fill: '#e6efe0', stroke: '#9bb58a', strokeWidth: 0.2, strokeDashArray: [1.2, 0.8], skladanka: 'pole' }));
      const [sx, sy] = srodekPola(pole);
      if (pole.para && c.pokaz_numery) numer(`${pole.para}`, sx, sy, Math.min(3.2, Math.min(pole.w, pole.h) * 0.45), '#5f7a50');
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
// Treść ścian (#284, plan składanek krok 15): elementy użytkownika (tekst, obraz, kształt, ozdobnik) w grupie części
// – pole na_czesci. Zwraca [{ obj, x, y }] – środek elementu w układzie części (mm), kąt elementu jest względem części.
export function trescCzesci(grupa) {
  if (!grupa?.getObjects) return [];
  const s = srodekUkladu(grupa);
  return grupa.getObjects().filter((o) => o.na_czesci).map((o) => { const p = o.getRelativeCenterPoint(); return { obj: o, x: p.x + s.x, y: p.y + s.y }; });
}

// tresc – elementy na ścianach (domyślnie: z dotychczasowej grupy) w układzie części; trafiają nad ścianę i nadruk,
// pod linie zgięć, cięcia i numery.
export function zbudujCzesc(def, { grupa = null, left = 0, top = 0, tresc = undefined } = {}) {
  for (const o of grupa?.getObjects?.() || []) if (o.zasob && typeof o.getElement === 'function' && !elementyNadruku.has(o.zasob)) elementyNadruku.set(o.zasob, o.getElement());
  const c = normalizujCzesc(def);
  const el = elementyCzesci(c);
  const naScianach = (tresc === undefined ? trescCzesci(grupa) : tresc).map(({ obj, x, y }) => {
    obj.group = undefined;
    obj.parent = undefined;
    obj.set({ na_czesci: true, selectable: false, evented: false });
    obj.setPositionByOrigin(new fabric.Point(x, y), 'center', 'center');
    return obj;
  });
  if (naScianach.length) {
    let i = 0;
    el.forEach((o, j) => { if (o.skladanka === 'sciana' || o.skladanka === 'nadruk') i = j + 1; });
    el.splice(i, 0, ...naScianach);
  }
  for (const o of el) { o.set({ left: o.left + left, top: o.top + top }); o.setCoords(); }
  const g = new fabric.Group(el, { nazwa: `Część ${c.nr}${c.opis ? ` – ${c.opis}` : ''}`, subTargetCheck: false, interactive: false, objectCaching: false });
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

// Rogi pola klejenia (z obrotem o kat wokół lewego górnego rogu) i jego środek.
export function rogiPola(p) {
  const k = ((p.kat || 0) * Math.PI) / 180;
  const c = Math.cos(k);
  const s = Math.sin(k);
  return [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]].map(([x, y]) => ({ x: p.x + x * c - y * s, y: p.y + x * s + y * c }));
}
const srodekPola = (p) => { const r = rogiPola(p); return [(r[0].x + r[2].x) / 2, (r[0].y + r[2].y) / 2]; };

// Punkty obrysu ścieżki (#266): odcinki wprost, łuki Béziera (C, Q) próbkowane co ~2 mm (od 4 do 32 punktów na łuk),
// żeby krzywe z pióra nie spłaszczały się do cięciw.
export function punktySciezki(sciezka) {
  const wynik = [];
  let cur = [0, 0];
  const dodaj = (p) => { const o = wynik[wynik.length - 1]; if (!o || Math.hypot(o[0] - p[0], o[1] - p[1]) > 0.05) wynik.push(p); };
  const ile = (dl) => Math.max(4, Math.min(32, Math.ceil(dl / 2)));
  for (const k of sciezka) {
    const c = String(k[0]).toUpperCase();
    const v = k.slice(1).map(Number);
    if (c === 'M' || c === 'L') { cur = [v[0], v[1]]; dodaj(cur); } else if (c === 'C') {
      const [x1, y1, x2, y2, x, y] = v;
      const n = ile(Math.hypot(x1 - cur[0], y1 - cur[1]) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2));
      for (let i = 1; i <= n; i += 1) {
        const t = i / n; const u = 1 - t;
        dodaj([u * u * u * cur[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cur[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]);
      }
      cur = [x, y];
    } else if (c === 'Q') {
      const [x1, y1, x, y] = v;
      const n = ile(Math.hypot(x1 - cur[0], y1 - cur[1]) + Math.hypot(x - x1, y - y1));
      for (let i = 1; i <= n; i += 1) {
        const t = i / n; const u = 1 - t;
        dodaj([u * u * cur[0] + 2 * u * t * x1 + t * t * x, u * u * cur[1] + 2 * u * t * y1 + t * t * y]);
      }
      cur = [x, y];
    } else if (v.length >= 2) { cur = [v[v.length - 2], v[v.length - 1]]; dodaj(cur); }
  }
  return wynik;
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
    lokalne = punktySciezki(o.path || []).map(([x, y]) => [x - o.pathOffset.x, y - o.pathOffset.y]);
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
        if (!z.naciecie && z.szer < a.grubosc) uwagi.push({ rodzaj: 'skladanka', ...gdzie, opis: `Szczelina na części ${c.nr} ma ${mmTxt(z.szer)} mm, a materiał ${mmTxt(a.grubosc)} mm – wypustka się nie zmieści. Ustaw szerokość co najmniej ${mmTxt(a.grubosc + 0.2)} mm.` });
      }
    }
  }
  for (const a of arkusze) {
    for (const [nrA, nrB, id] of nachodzaceCzesci(a.strona.obiekty)) uwagi.push({ rodzaj: 'skladanka', strony: a.nr ? [a.nr] : [], idStrony: a.strona.id, idObiektu: id, opis: `Części ${nrA} i ${nrB} nachodzą na siebie (razem z zakładkami) – nie da się ich wyciąć. Rozsuń je albo użyj „Rozłóż na arkusze”.` });
  }
  for (const [para, lista] of wpisy) {
    const g = lista[0].gdzie;
    if (lista.length === 1) { uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Numer ${para} (${lista[0].opis}) nie ma pary – nie wiadomo, do czego to przykleić. Połącz z krawędzią albo miejscem (narzędzie „Połącz”) albo usuń numer.` }); continue; }
    if (lista.length > 2) {
      // Szew po łuku (#261: walec, stożek): tyle samo krawędzi z tym numerem na dwóch częściach – razem tej samej długości.
      const wg = new Map();
      for (const w of lista) wg.set(w.gdzie.idObiektu, [...(wg.get(w.gdzie.idObiektu) || []), w]);
      const [s1, s2] = [...wg.values()];
      const szew = wg.size === 2 && s1.length === s2.length && lista.every((w) => ['zakladka', 'klej'].includes(w.rodzaj));
      if (!szew) { uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Numer ${para} jest użyty ${lista.length} razy (${lista.map((x) => x.opis).join(', ')}) – para to dwa miejsca; nadaj pozostałym inne numery.` }); continue; }
      const suma = (l) => l.reduce((x, w) => x + w.dl, 0);
      if (Math.abs(suma(s1) - suma(s2)) > 1) uwagi.push({ rodzaj: 'skladanka', ...g, opis: `Szew ${para}: strony mają różne długości (${mmTxt(suma(s1))} i ${mmTxt(suma(s2))} mm) – po sklejeniu jedna będzie wystawać.` });
      continue;
    }
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

// ---------- Połączenia (#235) ----------

// Pary w sekcji: Map para → [{ rodzaj, opis, czesc, arkusz, idStrony, idObiektu }] (kolejność: arkusz, część).
export function paryWSekcji(strony) {
  const pary = new Map();
  const dodaj = (para, w) => { if (!pary.has(para)) pary.set(para, []); pary.get(para).push(w); };
  strony.forEach((st, i) => {
    for (const o of czesciWObiektach(st.obiekty)) {
      const c = normalizujCzesc(o.czesc);
      const m = { czesc: c.nr, arkusz: i + 1, idStrony: st.id, idObiektu: o.id };
      c.krawedzie.forEach((k, j) => { if (k.para && k.typ !== 'ciecie') dodaj(k.para, { ...m, rodzaj: k.typ, opis: `${k.typ === 'zakladka' ? 'zakładka' : k.typ === 'wypustka' ? 'wypustka' : 'krawędź'} ${j + 1}` }); });
      c.pola.forEach((p) => { if (p.para) dodaj(p.para, { ...m, rodzaj: 'pole', opis: p.spod ? 'miejsce klejenia (spód)' : 'miejsce klejenia' }); });
      c.szczeliny.forEach((z) => { if (z.para) dodaj(z.para, { ...m, rodzaj: 'szczelina', opis: 'szczelina' }); });
    }
  });
  return new Map([...pary].sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0) || a[0].localeCompare(b[0])));
}

// Kształty par do podświetlenia w układzie części: [{ para, punkty: [{x,y}…], zamkniety }].
export function ksztaltyPar(def) {
  const c = normalizujCzesc(def);
  const w = [];
  c.krawedzie.forEach((k, i) => {
    if (!k.para || k.typ === 'ciecie') return;
    if (k.typ === 'zakladka') w.push({ para: k.para, punkty: zakladka(c.punkty, i, k.szer), zamkniety: true });
    else if (k.typ === 'wypustka') w.push({ para: k.para, punkty: wypustka(c.punkty, i, k.szer), zamkniety: true });
    else w.push({ para: k.para, punkty: [c.punkty[i], c.punkty[(i + 1) % c.punkty.length]], zamkniety: false });
  });
  for (const p of c.pola) if (p.para) w.push({ para: p.para, punkty: rogiPola(p), zamkniety: true });
  for (const z of c.szczeliny) if (z.para) w.push({ para: z.para, punkty: prostokatSzczeliny(z), zamkniety: true });
  return w;
}

// ---------- Arkusze (#236) ----------

// Punkt części (mm) → punkt strony dla ZAPISANEJ grupy (left/top – początek grupy, obrót wokół niego).
export function naStronieZapisanej(o, p) {
  const c = normalizujCzesc(o.czesc);
  const u = c.uklad || (() => { const r = ramkaCzesci(c); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; })();
  const w = (o.width || 0) * (o.scaleX || 1);
  const h = (o.height || 0) * (o.scaleY || 1);
  const ox = o.originX === 'center' ? 0 : o.originX === 'right' ? -w / 2 : w / 2;
  const oy = o.originY === 'center' ? 0 : o.originY === 'bottom' ? -h / 2 : h / 2;
  const k = ((o.angle || 0) * Math.PI) / 180;
  const obr = (x, y) => ({ x: x * Math.cos(k) - y * Math.sin(k), y: x * Math.sin(k) + y * Math.cos(k) });
  const s = obr(ox, oy);
  const d = obr(p.x - u.x, p.y - u.y);
  return { x: (o.left || 0) + s.x + d.x, y: (o.top || 0) + s.y + d.y };
}

// Czy dwa wielokąty się przecinają (krawędzie albo jeden w drugim).
function przecinajaSie(p, q) {
  const odc = (a, b, c, d) => {
    const k = (u, v, w) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
    return k(a, b, c) * k(a, b, d) < 0 && k(c, d, a) * k(c, d, b) < 0;
  };
  for (let i = 0; i < p.length; i += 1) for (let j = 0; j < q.length; j += 1) if (odc(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
  return wWielokacie(q, p[0]) || wWielokacie(p, q[0]);
}

// Części na arkuszu, które na siebie nachodzą (obrysy cięcia z zakładkami): [[nrA, nrB, idA], …].
export function nachodzaceCzesci(obiekty) {
  const czesci = czesciWObiektach(obiekty).map((o) => ({ o, nr: normalizujCzesc(o.czesc).nr, obrys: obrysCiecia(normalizujCzesc(o.czesc)).map((p) => naStronieZapisanej(o, p)) }));
  const wynik = [];
  for (let i = 0; i < czesci.length; i += 1) {
    for (let j = i + 1; j < czesci.length; j += 1) if (przecinajaSie(czesci[i].obrys, czesci[j].obrys)) wynik.push([czesci[i].nr, czesci[j].nr, czesci[i].o.id]);
  }
  return wynik;
}

// Rozkład części na arkusze (półki: rzędami od góry, najwyższe najpierw; część, która nie mieści się poziomo,
// obraca się o 90°). czesci: [{ id, w, h }] (ramka grupy w mm), pole: { x, y, w, h } (pole druku arkusza).
// Zwraca { arkusze: [[{ id, x, y, obrot }]], za_duze: [id…] } – x, y: lewy górny róg ramki na arkuszu.
export function rozlozNaArkusze(czesci, pole, odstep = 4) {
  const lista = czesci.map((c) => {
    let { w, h } = c;
    let obrot = 0;
    const miesci = (a, b) => a <= pole.w + 0.01 && b <= pole.h + 0.01;
    if (!miesci(w, h) && miesci(h, w)) { [w, h] = [h, w]; obrot = 90; } else if (w > h && miesci(h, w) && h > pole.h * 0.6) { [w, h] = [h, w]; obrot = 90; }
    return { id: c.id, w, h, obrot, za_duza: !miesci(w, h) };
  });
  const za_duze = lista.filter((c) => c.za_duza).map((c) => c.id);
  const kolej = lista.filter((c) => !c.za_duza).sort((a, b) => b.h - a.h || b.w - a.w);
  const arkusze = [];
  let ark = null;
  let x = 0;
  let y = 0;
  let wysPolki = 0;
  const nowy = () => { ark = []; arkusze.push(ark); x = 0; y = 0; wysPolki = 0; };
  for (const c of kolej) {
    if (!ark) nowy();
    if (x > 0 && x + c.w > pole.w + 0.01) { y += wysPolki + odstep; x = 0; wysPolki = 0; }
    if (y + c.h > pole.h + 0.01) nowy();
    ark.push({ id: c.id, x: pole.x + x, y: pole.y + y, obrot: c.obrot });
    x += c.w + odstep;
    wysPolki = Math.max(wysPolki, c.h);
  }
  return { arkusze, za_duze };
}

// ---------- Instrukcja montażu (#238) ----------

// Kroki montażu z części sekcji: wydruk i wycinanie, zginanie, klejenie par w kolejności numerów.
// strony – strony sekcji (arkusze), sp – ustawienia sekcji. Zwraca { kroki: [tekst…], czesci, par }.
export function instrukcjaMontazu(strony, sp = {}) {
  const kroki = [];
  const lista = strony.flatMap((st, i) => czesciWObiektach(st.obiekty).map((o) => ({ c: normalizujCzesc(o.czesc), arkusz: i + 1 })));
  if (!lista.length) return { kroki, czesci: 0, par: 0 };
  const nazwa = (x) => `${x.c.nr}${x.c.opis ? ` (${x.c.opis})` : ''}`;
  const ark = strony.length;
  kroki.push(`Wydrukuj ${ark === 1 ? 'arkusz' : `${ark} arkusze`}${sp.material ? ` na ${sp.material === 'karton' ? 'kartonie' : sp.material === 'tektura' ? 'tekturze' : 'papierze'}${sp.gramatura && ['papier', 'karton'].includes(sp.material) ? ` ${sp.gramatura} g/m²` : ''}` : ''}${sp.druga_strona === 'druk' ? ' dwustronnie' : ''}.`);
  kroki.push(sp.druk === 'drukarnia'
    ? `Części wycina ploter (linia cięcia „CutContour”); bigi („Crease”) ułatwią zginanie. Części: ${lista.map(nazwa).join(', ')}.`
    : `Wytnij części po ciągłej linii: ${lista.map((x) => `${nazwa(x)}${ark > 1 ? ` – arkusz ${x.arkusz}` : ''}`).join(', ')}. Szczeliny natnij nożykiem.`);
  const zgiecia = lista.map((x) => ({ x, g: x.c.zgiecia.filter((z) => z.rodzaj === 'gora').length, d: x.c.zgiecia.filter((z) => z.rodzaj === 'dolina').length, z: x.c.krawedzie.filter((k) => k.typ === 'zakladka').length })).filter((y) => y.g + y.d + y.z);
  if (zgiecia.length) {
    kroki.push('Zegnij wszystkie linie przed klejeniem – przyłóż linijkę i przeciągnij tępą stroną noża. Kreska–kropka („góra”) – zginaj od siebie, nadruk zostaje na zewnątrz; same kreski („dolina”) – do siebie. Zakładki zaginaj pod spód.');
    for (const y of zgiecia) kroki.push(`Część ${nazwa(y.x)}: ${[y.g ? `${y.g} ${y.g === 1 ? 'zgięcie od siebie' : 'zgięcia od siebie'}` : '', y.d ? `${y.d} do siebie` : '', y.z ? `${y.z} ${y.z === 1 ? 'zakładka' : 'zakładki'}` : ''].filter(Boolean).join(', ')}.`);
  }
  const pary = paryWSekcji(strony);
  const opis = (w) => `${w.opis} części ${w.czesc}`;
  for (const [para, w] of pary) {
    if (w.length !== 2) continue;
    const zak = w.find((x) => x.rodzaj === 'zakladka');
    const wyp = w.find((x) => x.rodzaj === 'wypustka');
    const szcz = w.find((x) => x.rodzaj === 'szczelina');
    if (wyp && szcz) kroki.push(`${para}. Wsuń wypustkę ${para} (część ${wyp.czesc}) w szczelinę ${para} (część ${szcz.czesc}).`);
    else if (zak) { const inna = w.find((x) => x !== zak); kroki.push(`${para}. Posmaruj klejem zakładkę ${para} (część ${zak.czesc}) i przyklej ${inna.rodzaj === 'pole' ? `w miejscu ${para} na części ${inna.czesc}` : `pod ${opis(inna)} z numerem ${para}`}.`); } else kroki.push(`${para}. Sklej ${opis(w[0])} z ${opis(w[1])}.`);
  }
  kroki.push('Dociśnij sklejone miejsca i odczekaj, aż klej wyschnie.');
  return { kroki, czesci: lista.length, par: pary.size };
}
