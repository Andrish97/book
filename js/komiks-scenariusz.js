// Scenariusz komiksu jako struktura (#378, uwagi D6 i D10): strony → kadry (ujęcie, miejsce, kto jest w kadrze, co
// widać, emocje i działania postaci) → kwestie (postać, rodzaj dymka, tekst). Zapis w tej samej tabeli „Scenariusz” (jeden wiersz na kwestię;
// cechy kadru powtórzone w każdym wierszu kadru, kadr bez kwestii – wiersz bez tekstu), więc dymki (js/dialogi.js),
// rysowanie kadrów (js/komiks-ai.js), okno Dane i AI działają na tych samych danych. Moduł bez zależności od edytora.

export const KOLUMNY_SCENARIUSZA = ['strona', 'kadr', 'ujęcie', 'miejsce', 'w kadrze', 'emocje i działania', 'rekwizyty', 'opis sceny', 'postać', 'tekst', 'rodzaj'];
const WARIANTY = {
  strona: ['strona', 'page', 'str', 'сторінка'], kadr: ['kadr', 'panel', 'кадр'], ujecie: ['ujecie', 'shot', 'plan', 'план', 'кадрування'],
  miejsce: ['miejsce', 'place', 'location', 'місце'], wKadrze: ['w kadrze', 'in panel', 'present', 'у кадрі'], gra: ['emocje i dzialania', 'emocje', 'emotions and actions', 'emotions', 'емоції та дії', 'емоції'], rekwizyty: ['rekwizyty', 'props', 'реквізит'], opis: ['opis sceny', 'scena', 'scene', 'opis', 'сцена'],
  postac: ['postac', 'character', 'kto', 'персонаж'], tekst: ['tekst', 'text', 'dialog', 'kwestia', 'текст'], rodzaj: ['rodzaj', 'typ', 'dymek', 'type', 'kind', 'balloon', 'bubble', 'тип', 'вид'],
};
const bez = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase().trim();

// Ujęcia (D6): id → nazwa w języku interfejsu i opis dla modelu.
export const UJECIA = {
  ogolny: { pl: 'widok ogólny', en: 'wide shot', uk: 'загальний план', model: 'wide establishing shot showing the whole scene' },
  pelny: { pl: 'plan pełny', en: 'full shot', uk: 'повний план', model: 'full shot, characters seen from head to toe' },
  sredni: { pl: 'plan średni', en: 'medium shot', uk: 'середній план', model: 'medium shot, characters from the waist up' },
  zblizenie: { pl: 'zbliżenie', en: 'close-up', uk: 'великий план', model: 'close-up on the face of the main character in the panel' },
  detal: { pl: 'detal', en: 'detail', uk: 'деталь', model: 'extreme close-up on an important object or detail' },
  zGory: { pl: 'z góry', en: 'from above', uk: 'згори', model: 'high-angle shot from above' },
  zDolu: { pl: 'z dołu', en: 'from below', uk: 'знизу', model: 'low-angle shot from below' },
  zaPlecami: { pl: 'zza pleców', en: 'over the shoulder', uk: 'з-за плеча', model: 'over-the-shoulder shot' },
};
// Emocje postaci w kadrze (uwaga E3): id → nazwa w języku interfejsu.
export const EMOCJE = {
  radosc: { pl: 'radość', en: 'joy', uk: 'радість' },
  smutek: { pl: 'smutek', en: 'sadness', uk: 'смуток' },
  zlosc: { pl: 'złość', en: 'anger', uk: 'злість' },
  strach: { pl: 'strach', en: 'fear', uk: 'страх' },
  zaskoczenie: { pl: 'zaskoczenie', en: 'surprise', uk: 'здивування' },
  ciekawosc: { pl: 'ciekawość', en: 'curiosity', uk: 'цікавість' },
  spokoj: { pl: 'spokój', en: 'calm', uk: 'спокій' },
  zmeczenie: { pl: 'zmęczenie', en: 'tiredness', uk: 'втома' },
};
export const nazwyEmocji = (j = 'pl') => Object.values(EMOCJE).map((e) => e[j] || e.pl);
// „Ala (radość): biegnie; Ola: patrzy” ↔ [{ imie, emocja, robi }]
export function graZTekstu(t) {
  return String(t || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^([^():]+?)\s*(?:\(([^)]*)\))?\s*(?::\s*([\s\S]*))?$/.exec(x);
    return m ? { imie: m[1].trim(), emocja: (m[2] || '').trim(), robi: (m[3] || '').trim() } : null;
  }).filter((g) => g && g.imie && (g.emocja || g.robi));
}
export const graDoTekstu = (gra) => (gra || []).filter((g) => g.imie && (g.emocja || g.robi)).map((g) => `${g.imie}${g.emocja ? ` (${g.emocja})` : ''}${g.robi ? `: ${g.robi}` : ''}`).join('; ');

export const nazwyUjec = (j = 'pl') => Object.values(UJECIA).map((u) => u[j] || u.pl);
// Wartość z tabeli (w dowolnym języku) → id ujęcia albo null (wtedy wartość idzie do opisu jak jest).
export function idUjecia(v) {
  const b = bez(v);
  if (!b) return null;
  return Object.keys(UJECIA).find((id) => ['pl', 'en', 'uk'].some((j) => bez(UJECIA[id][j]) === b)) || null;
}

export function indeksyKolumn(tabela) {
  const nazwy = (tabela?.kolumny || []).map(bez);
  return Object.fromEntries(Object.entries(WARIANTY).map(([pole, w]) => [pole, nazwy.findIndex((n) => w.includes(n))]));
}

// Tabela → [{ nr, kadry: [{ nr, ujecie, miejsce, wKadrze: [imię], opis, kwestie: [{ postac, tekst, rodzaj }] }] }]
export function scenariuszZTabeli(tabela) {
  const k = indeksyKolumn(tabela);
  const v = (w, pole) => (k[pole] >= 0 ? String(w[k[pole]] ?? '').trim() : '');
  const strony = new Map();
  for (const w of tabela?.wiersze || []) {
    const nrS = parseInt(v(w, 'strona'), 10);
    if (!(nrS > 0)) continue;
    const nrK = Math.max(1, parseInt(v(w, 'kadr'), 10) || 1);
    if (!strony.has(nrS)) strony.set(nrS, new Map());
    const kadry = strony.get(nrS);
    if (!kadry.has(nrK)) kadry.set(nrK, { nr: nrK, ujecie: '', miejsce: '', wKadrze: [], gra: [], rekwizyty: [], opis: '', kwestie: [] });
    const kd = kadry.get(nrK);
    // cechy kadru – pierwsza niepusta wartość
    kd.ujecie ||= v(w, 'ujecie'); kd.miejsce ||= v(w, 'miejsce'); kd.opis ||= v(w, 'opis');
    for (const imie of v(w, 'wKadrze').split(/[,;]/).map((x) => x.trim()).filter(Boolean)) if (!kd.wKadrze.some((x) => bez(x) === bez(imie))) kd.wKadrze.push(imie);
    for (const r of v(w, 'rekwizyty').split(/[,;]/).map((x) => x.trim()).filter(Boolean)) if (!kd.rekwizyty.some((x) => bez(x) === bez(r))) kd.rekwizyty.push(r);
    for (const g of graZTekstu(v(w, 'gra'))) if (!kd.gra.some((x) => bez(x.imie) === bez(g.imie))) kd.gra.push(g);
    if (v(w, 'tekst') || v(w, 'postac')) kd.kwestie.push({ postac: v(w, 'postac'), tekst: v(w, 'tekst'), rodzaj: v(w, 'rodzaj') || (v(w, 'postac') ? 'mowa' : 'narracja') });
  }
  return [...strony.entries()].sort((a, b) => a[0] - b[0]).map(([nr, kadry]) => ({ nr, kadry: [...kadry.values()].sort((a, b) => a.nr - b.nr) }));
}

// Struktura → wiersze tabeli (brakujące kolumny dochodzą; inne kolumny tabeli, np. tekst_en, zostają w wierszach kwestii
// o tym samym miejscu – po kolejności kwestii w kadrze).
export function scenariuszDoTabeli(tabela, strony) {
  for (const n of KOLUMNY_SCENARIUSZA) {
    const k = indeksyKolumn(tabela);
    const pole = Object.keys(WARIANTY).find((p) => WARIANTY[p].includes(bez(n)));
    if (k[pole] < 0) { tabela.kolumny.push(n); tabela.wiersze.forEach((w) => w.push('')); }
  }
  const k = indeksyKolumn(tabela);
  // stare wiersze kwestii (do zachowania pozostałych kolumn): strona|kadr|która kwestia
  const stare = new Map();
  const licz = new Map();
  for (const w of tabela.wiersze) {
    const kk = `${parseInt(w[k.strona], 10)}|${Math.max(1, parseInt(w[k.kadr], 10) || 1)}`;
    const i = licz.get(kk) || 0; licz.set(kk, i + 1);
    stare.set(`${kk}|${i}`, w);
  }
  const wiersze = [];
  for (const s of strony) {
    for (const kd of s.kadry) {
      const kwestie = kd.kwestie.length ? kd.kwestie : [{ postac: '', tekst: '', rodzaj: '' }];
      kwestie.forEach((q, i) => {
        const r = [...(stare.get(`${s.nr}|${kd.nr}|${i}`) || tabela.kolumny.map(() => ''))];
        while (r.length < tabela.kolumny.length) r.push('');
        r[k.strona] = String(s.nr); r[k.kadr] = String(kd.nr); r[k.ujecie] = kd.ujecie || ''; r[k.miejsce] = kd.miejsce || '';
        r[k.wKadrze] = (kd.wKadrze || []).join(', '); r[k.gra] = graDoTekstu(kd.gra); r[k.rekwizyty] = (kd.rekwizyty || []).join(', '); r[k.opis] = kd.opis || '';
        r[k.postac] = q.postac || ''; r[k.tekst] = q.tekst || ''; r[k.rodzaj] = q.tekst || q.postac ? (q.rodzaj || 'mowa') : '';
        wiersze.push(r);
      });
    }
  }
  tabela.wiersze = wiersze;
  return tabela;
}
