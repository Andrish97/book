// Import stron komiksu (#369, plan komiksu A10): wiele plików albo ZIP z obrazami. Numer w nazwie pliku mówi, gdzie
// trafia obraz: „01.png”, „strona 7.jpg” → cała strona na spad (rysunek z kadrami – kadry tej strony znikają, dymki
// zostają); „s03-k2.png”, „str3_kadr2.jpg” → obraz w kadrze 2 na stronie 3 (kadr jest ramką obrazu). Numer strony
// liczy się od pierwszej strony komiksu. Moduł bez zależności od edytora – działa na danych projektu.

const OBRAZ = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

// Nazwa pliku (bez katalogów) → { strona, kadr } albo null.
export function miejscePliku(nazwa) {
  const n = String(nazwa || '').split(/[\\/]/).pop();
  if (!OBRAZ.test(n)) return null;
  const rdzen = n.replace(OBRAZ, '');
  const sk = rdzen.match(/(?:^|[^a-z])(?:s|str|strona|page|p|стор)?\s*[-_ ]?(\d{1,4})\s*[-_ .]*(?:k|kadr|panel|кадр)\s*[-_ ]?(\d{1,2})(?!\d)/i);
  if (sk) return { strona: Number(sk[1]), kadr: Number(sk[2]) };
  // Sam numer strony – tylko gdy nazwa to numer (z „strona”, „page”…): „01”, „strona 7”, „page_3”. Nazwy z generatorów
  // („Gemini_Generated_Image_abc123”) nie są stronami – idą do pustych kadrów po kolei (uwaga G2).
  const s = rdzen.trim().match(/^(?:strona|str|page|p|s|стор(?:інка)?)?\s*[-_ .]?\s*(\d{1,3})$/i);
  return s && Number(s[1]) > 0 ? { strona: Number(s[1]), kadr: null } : null;
}

// Plan importu: { strony: [{ nazwa, strona }], kadry: [{ nazwa, strona, kadr }], bezNumeru: [nazwa], pominiete: [nazwa] }
// – w kolejności numerów; pliki obrazów bez numeru (bezNumeru) w kolejności nazw – do pustych kadrów po kolei.
export function planImportu(nazwy) {
  const plan = { strony: [], kadry: [], bezNumeru: [], pominiete: [] };
  for (const nazwa of nazwy) {
    const m = miejscePliku(nazwa);
    if (!m && OBRAZ.test(String(nazwa))) { plan.bezNumeru.push(nazwa); continue; }
    if (!m || m.strona < 1) { plan.pominiete.push(nazwa); continue; }
    if (m.kadr) plan.kadry.push({ nazwa, strona: m.strona, kadr: m.kadr });
    else plan.strony.push({ nazwa, strona: m.strona });
  }
  plan.strony.sort((a, b) => a.strona - b.strona);
  plan.kadry.sort((a, b) => a.strona - b.strona || a.kadr - b.kadr);
  plan.bezNumeru.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return plan;
}

const zaokr = (v) => Math.round(v * 1000) / 1000;

// Obraz na całą stronę ze spadem, przycięty jak „wypełnij” (środek zostaje). obraz: { id, nazwa, szer, wys } (px).
export function wstawStrone(strona, obraz, { w, h, spad = 0 }) {
  const W = w + 2 * spad; const H = h + 2 * spad;
  const nw = obraz.szer || W; const nh = obraz.wys || H;
  const skala = Math.max(W / nw, H / nh);
  const szer = Math.min(nw, W / skala); const wys = Math.min(nh, H / skala);
  // poprzedni obraz z tego samego pliku i kadry tej strony znikają; reszta (dymki, teksty) zostaje nad obrazem
  strona.obiekty = (strona.obiekty || []).filter((o) => o.kadr_nr == null && !(o.type === 'image' && o.nazwa === obraz.nazwa));
  strona.obiekty.unshift({
    type: 'image', id: obraz.idElementu, zasob: obraz.id, nazwa: obraz.nazwa, left: -spad, top: -spad,
    width: zaokr(szer), height: zaokr(wys), cropX: zaokr((nw - szer) / 2), cropY: zaokr((nh - wys) / 2), scaleX: zaokr(skala), scaleY: zaokr(skala),
  });
}

// Puste kadry (bez obrazu) stron od `od` (indeks w liście stron komiksu) w kolejności czytania: [{ strona: obiekt strony, kadr }].
export function pusteKadry(strony, od = 0) {
  const wynik = [];
  for (const st of strony.slice(od)) {
    for (const k of (st.obiekty || []).filter((o) => o.kadr_nr != null && !o.zasob).sort((a, b) => Number(a.kadr_nr) - Number(b.kadr_nr))) wynik.push({ strona: st, kadr: Number(k.kadr_nr) });
  }
  return wynik;
}

// Obraz w kadrze nr `kadr` (kadr staje się ramką obrazu, #123). Zwraca false, gdy na stronie nie ma takiego kadru.
export function wstawDoKadru(strona, kadr, obraz) {
  const k = (strona.obiekty || []).find((o) => Number(o.kadr_nr) === kadr);
  if (!k) return false;
  k.zasob = obraz.id;
  k.obraz_kadr = { x: 0, y: 0, skala: 1 };
  return true;
}
