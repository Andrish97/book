// Kontrola przed drukiem – elementy stron i wzorców (#414): to, co zwykle sprawdza drukarnia, a czego kontrola
// nie widziała: rozdzielczość zdjęć w druku, za mały tekst, za cienkie linie, brakujące czcionki, tekst przy
// krawędzi cięcia, element do krawędzi bez spadu, element poza stroną. Działa na zapisanym projekcie (JSON),
// bez rysowania – położenie z left/top/width/height/scale (obrócone elementy pomija przy położeniu).

import { rozwin } from './serie.js';
import { rodzinyCzcionek } from './czcionki.js';
import { wzorceStrony, marginesyStrony } from './projekt.js';
import { t as tt } from './jezyk.js';

export const PROG_DPI = 200; // poniżej – zdjęcie w druku może wyjść nieostre (najlepiej 300 dpi)
export const PROG_PT = 6; // tekst mniejszy niż 6 pt – trudny do czytania, cienkie kreski liter mogą się nie wydrukować
export const PROG_LINII_MM = 0.1; // linia cieńsza niż 0,1 mm (ok. 0,28 pt) może się nie wydrukować
export const BEZPIECZNA_MM = 3; // tekst bliżej krawędzi cięcia może zostać przycięty

const pt = (mm) => (mm * 72) / 25.4;
const nazwaEl = (o) => {
  const t = String(o.nazwa || o.text || '').replace(/\s+/g, ' ').trim();
  return t.length > 30 ? `${t.slice(0, 30)}…` : t;
};
const lista = (numery) => {
  const n = [...new Set(numery)].sort((a, b) => a - b);
  return n.length > 8 ? `${n.slice(0, 8).join(', ')}…` : n.join(', ');
};
const zwyklaSekcja = (sekcja) => !sekcja.okladka && !sekcja.wydruk?.okladka && !(sekcja.specjalna && sekcja.specjalna.rodzaj !== 'kalendarz') && !sekcja.wydruk?.specjalna;
const maObrys = (o) => o.stroke && o.stroke !== 'transparent' && !/^rgba\([^)]*,\s*0\)$/.test(o.stroke) && (o.strokeWidth || 0) > 0;
const maWypelnienie = (o) => o.fill && o.fill !== 'transparent' && o.fill !== '' && !/^rgba\([^)]*,\s*0\)$/.test(String(o.fill));

function rozmiaryPisma(o) {
  const r = [o.fontSize || 0];
  for (const wiersz of Object.values(o.styles || {})) for (const z of Object.values(wiersz || {})) if (z?.fontSize) r.push(z.fontSize);
  return r;
}
function rodzinyWTekscie(o) {
  const r = new Set([o.fontFamily].filter(Boolean));
  for (const wiersz of Object.values(o.styles || {})) for (const z of Object.values(wiersz || {})) if (z?.fontFamily) r.add(z.fontFamily);
  return r;
}

// Uwagi: [{ rodzaj, opis, strony, idStrony, idObiektu }].
export function uwagiElementow(projekt, ciag = rozwin(projekt)) {
  const { wlasne, wbudowane } = rodzinyCzcionek(projekt);
  const znane = new Set([...wlasne, ...wbudowane, 'Arial', 'Helvetica', 'Times New Roman', 'serif', 'sans-serif']);
  const numery = new Map(); // id strony → numery stron wydruku
  for (const e of ciag.egzemplarze) { const l = numery.get(e.strona.id) || []; l.push(e.indeks + 1); numery.set(e.strona.id, l); }
  const zebrane = new Map(); // klucz → uwaga (ten sam element wzorca na wielu stronach – raz)
  const dodaj = (klucz, u) => { if (!zebrane.has(klucz)) zebrane.set(klucz, u); };

  // marginesy – lista zestawów marginesów (strona lewa i prawa w rozkładówce), [] – bez sprawdzania marginesu
  // (okładka i sekcje specjalne mają własne strefy – te sprawdza edytor).
  const sprawdz = (obiekty, { wydruk, idStrony, strony, gdzie, skala = 1, gora = true, marginesy = [] }) => {
    const W = wydruk.szerokosc_mm; const H = wydruk.wysokosc_mm; const spad = wydruk.spad_mm || 0;
    for (const o of obiekty || []) {
      if (!o || o.visible === false || o.bez_ostrzezen) continue; // wyciszony w edytorze („Wycisz”) – też tutaj (#417)
      const sx = (o.scaleX || 1) * skala; const sy = (o.scaleY || 1) * skala;
      const nazwa = nazwaEl(o);
      const opis = (klucz, zm) => tt(klucz, { nazwa, gdzie, ...zm });
      const u = (rodzaj, klucz, zm) => dodaj(`${rodzaj}|${o.id}`, { rodzaj, opis: opis(klucz, zm), strony, idStrony, idObiektu: o.id });
      // Zdjęcie: piksele oryginału na milimetr druku (width w pikselach, scaleX – mm na piksel). Obraz z danych pomijamy.
      if (o.type === 'image' && o.zasob && !o.z_danych && !o.pole?.kolumna && sx > 0) {
        const dpi = Math.round(25.4 / sx);
        if (dpi < PROG_DPI) u('obraz_dpi', 'kontrolaElementow.obrazDpi', { dpi });
      }
      if (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text') {
        const min = Math.min(...rozmiaryPisma(o).filter((x) => x > 0)) * sy;
        if (Number.isFinite(min) && pt(min) < PROG_PT - 0.05 && String(o.text || '').trim()) u('maly_tekst', 'kontrolaElementow.malyTekst', { pt: String(Math.floor(pt(min) * 10) / 10).replace('.', ',') });
        const brak = [...rodzinyWTekscie(o)].filter((r) => !znane.has(r));
        if (brak.length) u('brak_czcionki', 'kontrolaElementow.brakCzcionki', { czcionki: brak.map((r) => `„${r}”`).join(', ') });
      } else if (maObrys(o) && !Array.isArray(o.objects)) {
        const mm = o.strokeWidth * Math.min(sx, sy);
        if (mm < PROG_LINII_MM) u('cienka_linia', 'kontrolaElementow.cienkaLinia', { mm: String(Math.round(mm * 100) / 100).replace('.', ',') });
      }
      // Położenie – tylko elementy najwyższego poziomu, bez obrotu; wyciszone w edytorze („Wycisz”) i kadry komiksu
      // (obrys w połowie na zewnątrz, kadr na spad świadomie) – bez uwag o położeniu, jak w ostrzeżeniach edytora.
      if (gora && !(o.angle % 360) && !o.z_danych && !o.kadr && o.kadr_nr == null) { // położenie z danych – inne na każdej stronie
        const w = (o.width || 0) * (o.scaleX || 1); const h = (o.height || 0) * (o.scaleY || 1);
        const x1 = o.originX === 'center' ? o.left - w / 2 : o.left; const y1 = o.originY === 'center' ? o.top - h / 2 : o.top;
        const x2 = x1 + w; const y2 = y1 + h;
        const tekst = o.type === 'textbox' && String(o.text || '').trim();
        if (w > 0 && h > 0) {
          const tol = 0.05;
          if (x2 <= -spad || y2 <= -spad || x1 >= W + spad || y1 >= H + spad) u('poza_strona', 'kontrolaElementow.pozaStrona');
          // Wychodzi poza spad (#417, jak ostrzeżenie edytora) – ta część zostanie ucięta.
          else if (x1 < -spad - tol || y1 < -spad - tol || x2 > W + spad + tol || y2 > H + spad + tol) u('poza_spadem', 'kontrolaElementow.pozaSpadem');
          else if (tekst && (x1 < BEZPIECZNA_MM || y1 < BEZPIECZNA_MM || x2 > W - BEZPIECZNA_MM || y2 > H - BEZPIECZNA_MM) && x1 > -spad && y1 > -spad && x2 < W + spad && y2 < H + spad) {
            u('przy_krawedzi', 'kontrolaElementow.przyKrawedzi', { mm: BEZPIECZNA_MM });
          } else if (!tekst && spad > 0 && (maWypelnienie(o) || o.type === 'image')) {
            const tol = 0.3;
            const doKrawedzi = (Math.abs(x1) <= tol) || (Math.abs(y1) <= tol) || (Math.abs(x2 - W) <= tol) || (Math.abs(y2 - H) <= tol);
            if (doKrawedzi) u('bez_spadu', 'kontrolaElementow.bezSpadu', { spad: String(spad).replace('.', ',') });
          }
          // Wchodzi w margines (#417, jak ostrzeżenie edytora) – na lewej albo prawej stronie rozkładówki.
          if (!zebrane.has(`przy_krawedzi|${o.id}`) && !zebrane.has(`bez_spadu|${o.id}`) && !zebrane.has(`poza_strona|${o.id}`) && !zebrane.has(`poza_spadem|${o.id}`)
            && !(spad > 0 && (x1 <= -spad + tol || y1 <= -spad + tol || x2 >= W + spad - tol || y2 >= H + spad - tol)) // na spad – świadomie
            && marginesy.some((m) => x1 < m.lewy - tol || y1 < m.gora - tol || x2 > W - m.prawy + tol || y2 > H - m.dol + tol)) u('w_marginesie', 'kontrolaElementow.wMarginesie');
        }
      }
      if (Array.isArray(o.objects) && !o.tabela) sprawdz(o.objects, { wydruk, idStrony, strony, gdzie, skala: skala * Math.min(o.scaleX || 1, o.scaleY || 1), gora: false });
    }
  };

  for (const s of projekt.strony || []) {
    const sekcja = projekt.sekcje.find((x) => x.id === s.sekcja);
    if (!sekcja?.wydruk) continue;
    const strony = numery.get(s.id) || [];
    if (!strony.length) continue;
    const boki = [...new Set(ciag.egzemplarze.filter((e) => e.strona === s).map((e) => e.bok || null))];
    const marginesy = zwyklaSekcja(sekcja) ? boki.map((b) => marginesyStrony(projekt, s, b)) : [];
    sprawdz(s.obiekty, { wydruk: sekcja.wydruk, idStrony: s.id, strony, marginesy, gdzie: tt('kontrolaElementow.naStronach', { lista: lista(strony) }) });
  }
  for (const w of projekt.wzorce || []) {
    const uzyte = (projekt.strony || []).filter((s) => wzorceStrony(projekt, s).some((x) => x.id === w.id));
    if (!uzyte.length) continue;
    const sekcja = projekt.sekcje.find((x) => x.id === uzyte[0].sekcja);
    if (!sekcja?.wydruk) continue;
    const strony = uzyte.flatMap((s) => numery.get(s.id) || []);
    const m = w.wydruk?.marginesy || sekcja.wydruk.marginesy || {};
    const marginesy = zwyklaSekcja(sekcja) ? [{ lewy: m.wewnetrzny ?? 10, prawy: m.zewnetrzny ?? 10, gora: m.gora ?? 10, dol: m.dol ?? 10 }] : [];
    sprawdz(w.obiekty, { wydruk: sekcja.wydruk, idStrony: null, strony, marginesy, gdzie: tt('kontrolaElementow.weWzorcu', { wzorzec: w.nazwa || '' }) });
  }
  return [...zebrane.values()];
}
