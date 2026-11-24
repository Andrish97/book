// Kontrola przed drukiem – elementy stron i wzorców (#414): to, co zwykle sprawdza drukarnia, a czego kontrola
// nie widziała: rozdzielczość zdjęć w druku, za mały tekst, za cienkie linie, brakujące czcionki, tekst przy
// krawędzi cięcia, element do krawędzi bez spadu, element poza stroną. Działa na zapisanym projekcie (JSON),
// bez rysowania – położenie z left/top/width/height/scale (obrócone elementy pomija przy położeniu).

import { rozwin, wartosciPol } from './serie.js';
import { podstawWObiektach } from './pola.js';
import { obrazyZPol } from './obrazy-z-pol.js';
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
export const zwyklaSekcja = (sekcja) => !sekcja.okladka && !sekcja.wydruk?.okladka && !(sekcja.specjalna && sekcja.specjalna.rodzaj !== 'kalendarz') && !sekcja.wydruk?.specjalna;
// Rysunek wektorowy (SVG) nie ma rozdzielczości – drukuje się ostro w każdym rozmiarze (#421).
const wektorowy = (zasob, o) => /\.svgz?$/i.test(zasob?.nazwa || '') || /^data:image\/svg/i.test(zasob?.dataUrl || '')
  || /svg/i.test(zasob?.typ || zasob?.mime || '') || /\.svgz?$/i.test(o?.nazwa || '') || /^data:image\/svg/i.test(o?.src || '');
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

// Położenie ramki tekstu na stronie (jak niżej w uwagiElementow, dla tekstu): 'poza_strona' | 'poza_spadem' |
// 'przy_krawedzi' | 'w_marginesie' | null. Do kontroli złożonego tekstu (#431) – ramka rosnąca z tekstem.
export function polozenieTekstu({ x1, y1, x2, y2 }, { W, H, spad = 0, marginesy = [] }) {
  const tol = 0.05;
  if (x2 <= -spad || y2 <= -spad || x1 >= W + spad || y1 >= H + spad) return 'poza_strona';
  if (x1 < -spad - tol || y1 < -spad - tol || x2 > W + spad + tol || y2 > H + spad + tol) return 'poza_spadem';
  if ((x1 < BEZPIECZNA_MM || y1 < BEZPIECZNA_MM || x2 > W - BEZPIECZNA_MM || y2 > H - BEZPIECZNA_MM) && x1 > -spad && y1 > -spad && x2 < W + spad && y2 < H + spad) return 'przy_krawedzi';
  if (spad > 0 && (x1 <= -spad + tol || y1 <= -spad + tol || x2 >= W + spad - tol || y2 >= H + spad - tol)) return null;
  if (marginesy.some((m) => x1 < m.lewy - tol || y1 < m.gora - tol || x2 > W - m.prawy + tol || y2 > H - m.dol + tol)) return 'w_marginesie';
  return null;
}
export const KLUCZ_POLOZENIA = { poza_strona: 'kontrolaElementow.pozaStrona', poza_spadem: 'kontrolaElementow.pozaSpadem', przy_krawedzi: 'kontrolaElementow.przyKrawedzi', w_marginesie: 'kontrolaElementow.wMarginesie' };
export const listaStron = lista;

// Uwagi: [{ rodzaj, opis, strony, idStrony, idObiektu }].
export function uwagiElementow(projekt, ciag = rozwin(projekt)) {
  const { wlasne, wbudowane } = rodzinyCzcionek(projekt);
  const znane = new Set([...wlasne, ...wbudowane, 'Arial', 'Helvetica', 'Times New Roman', 'serif', 'sans-serif']);
  // Każda strona wydruku osobno, po podstawieniu danych (#418): położenie, rozmiar i widoczność z danych, obraz
  // z kolumny, tekst z polami i wzorce na lewej albo prawej stronie. Ten sam element na wielu stronach – jedna
  // uwaga z numerami stron.
  const zebrane = new Map(); // klucz → { rodzaj, klucz tłumaczenia, zmienne, strony, idStrony, idObiektu, wzorzec }
  const naTejStronie = new Set(); // klucze uwag z bieżącej strony wydruku (numer strony dopisujemy raz)

  // marginesy – lista zestawów marginesów (strona lewa i prawa w rozkładówce), [] – bez sprawdzania marginesu
  // (okładka i sekcje specjalne mają własne strefy – te sprawdza edytor).
  const sprawdz = (obiekty, { wydruk, idStrony, nr, wzorzec = null, skala = 1, gora = true, marginesy = [] }) => {
    const W = wydruk.szerokosc_mm; const H = wydruk.wysokosc_mm; const spad = wydruk.spad_mm || 0;
    for (const o of obiekty || []) {
      if (!o || o.visible === false || o.bez_ostrzezen) continue; // wyciszony w edytorze („Wycisz”) – też tutaj (#417)
      const sx = (o.scaleX || 1) * skala; const sy = (o.scaleY || 1) * skala;
      const nazwa = nazwaEl(o);
      const u = (rodzaj, klucz, zm) => {
        const k = `${rodzaj}|${o.id}`;
        const w = zebrane.get(k) || { rodzaj, klucz, zm: { nazwa, ...zm }, strony: [], idStrony, idObiektu: o.id, wzorzec };
        if (!naTejStronie.has(k)) { w.strony.push(nr); naTejStronie.add(k); }
        zebrane.set(k, w);
      };
      const has = (rodzaj) => naTejStronie.has(`${rodzaj}|${o.id}`);
      // Zdjęcie: piksele oryginału na milimetr druku (width w pikselach, scaleX – mm na piksel).
      if (o.type === 'image' && o.zasob && !o.ramka_pola && !o.pole?.kolumna && sx > 0 && !wektorowy(projekt.zasoby?.[o.zasob], o)) { // obraz-wzór kolumny bez danych – osobna uwaga o brakującej kolumnie
        const dpi = Math.round(25.4 / sx);
        if (dpi < PROG_DPI) u('obraz_dpi', 'kontrolaElementow.obrazDpi', { dpi });
      }
      // Obraz z kolumny danych: plik tej strony wpisany w ramkę (wypełnij – na całą ramkę, inaczej – cały obraz).
      const plik = o.type === 'image' && o.ramka_pola && projekt.zasoby?.[o.zasob];
      if (plik?.szer > 0 && plik?.wys > 0 && !wektorowy(plik)) {
        const rw = o.ramka_pola.w * skala; const rh = o.ramka_pola.h * skala;
        const mmNaPx = o.pole?.tryb === 'wypelnij' ? Math.max(rw / plik.szer, rh / plik.wys) : Math.min(rw / plik.szer, rh / plik.wys);
        const dpi = Math.round(25.4 / mmNaPx);
        if (mmNaPx > 0 && dpi < PROG_DPI) u('obraz_dpi', 'kontrolaElementow.obrazDpi', { dpi });
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
      if (gora && !(o.angle % 360) && !o.kadr && o.kadr_nr == null) {
        const w = o.ramka_pola ? o.ramka_pola.w : (o.width || 0) * (o.scaleX || 1); const h = o.ramka_pola ? o.ramka_pola.h : (o.height || 0) * (o.scaleY || 1);
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
          if (!has('przy_krawedzi') && !has('bez_spadu') && !has('poza_strona') && !has('poza_spadem')
            && !(spad > 0 && (x1 <= -spad + tol || y1 <= -spad + tol || x2 >= W + spad - tol || y2 >= H + spad - tol)) // na spad – świadomie
            && marginesy.some((m) => x1 < m.lewy - tol || y1 < m.gora - tol || x2 > W - m.prawy + tol || y2 > H - m.dol + tol)) u('w_marginesie', 'kontrolaElementow.wMarginesie');
        }
      }
      if (Array.isArray(o.objects) && !o.tabela) sprawdz(o.objects, { wydruk, idStrony, nr, wzorzec, skala: skala * Math.min(o.scaleX || 1, o.scaleY || 1), gora: false });
    }
  };

  for (const egz of ciag.egzemplarze) {
    const sekcja = egz.sekcja;
    if (!sekcja?.wydruk || egz.strona.pusta) continue;
    naTejStronie.clear();
    const wartosc = wartosciPol(projekt, egz, ciag);
    const dane = (obiekty) => obrazyZPol(podstawWObiektach(obiekty || [], wartosc), wartosc, projekt.zasoby || {});
    const marginesy = zwyklaSekcja(sekcja) ? [marginesyStrony(projekt, egz.strona, egz.bok)] : [];
    const nr = egz.indeks + 1;
    sprawdz(dane(egz.strona.obiekty), { wydruk: sekcja.wydruk, idStrony: egz.strona.id, nr, marginesy });
    for (const w of wzorceStrony(projekt, egz.strona)) sprawdz(dane(w.obiekty), { wydruk: sekcja.wydruk, idStrony: null, nr, wzorzec: w.nazwa || '', marginesy });
  }
  return [...zebrane.values()].map(({ klucz, zm, wzorzec, ...u }) => {
    const naStronach = tt('kontrolaElementow.naStronach', { lista: lista(u.strony) });
    const gdzie = wzorzec === null ? naStronach : `${tt('kontrolaElementow.weWzorcu', { wzorzec })}, ${naStronach}`;
    return { ...u, ...(zm.dpi ? { dpi: zm.dpi } : {}), opis: tt(klucz, { ...zm, gdzie }) }; // dpi – próg poważnej uwagi (#420)
  });
}
