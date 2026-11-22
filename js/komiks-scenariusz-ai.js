// Scenariusz z AI (#375, plan komiksu C4 i C6): z pomysłu (kilka zdań) albo z dokumentu (TXT, DOCX, Markdown – tekst
// czyta js/import-tekstu.js) AI rozpisuje komiks na strony, kadry i dialogi (kto, tekst, rodzaj dymka, opis sceny,
// miejsce) oraz listę postaci i miejsc. Wynik (JSON) najpierw w podglądzie; zapis – do tabeli scenariusza i kart
// (js/postacie.js). Moduł bez zależności od edytora.

import { zapiszKarte, karty } from './postacie.js';

const RODZAJE = ['mowa', 'mysl', 'krzyk', 'szept', 'narracja'];

export function zapytanieScenariusza({ zrodlo, tekst, stron = 3, kadrow = 3, jezyk = 'pl' }) {
  const jak = zrodlo === 'dokument'
    ? `The user gives a document (a script, story or outline). Recognise its structure (pages/scenes, panels, who says what, captions) and turn it into a comic script. Keep the dialogue text exactly as in the document when it is given; split long scenes into panels. Use at most ${kadrow + 1} panels per page.`
    : `The user gives an idea in a few sentences. Write a short comic script: exactly ${stron} pages, ${kadrow} panels per page, a clear beginning, middle and ending, short natural dialogue (max 15 words per bubble).`;
  return {
    systemInstruction: { parts: [{ text: `${jak} Write all dialogue, captions, descriptions and names in the language with code "${jezyk}" (unless the document is in another language – then keep the document's language for dialogue). Answer with JSON only:
{"tytul": string, "postacie": [{"imie": string, "wyglad": string (age, hair, clothes – for drawing), "znak": string (one distinctive feature), "charakter": string}], "miejsca": [{"nazwa": string, "opis": string, "pora": string}], "sceny": [{"strona": number, "kadr": number, "postac": string ("" for a caption), "tekst": string, "rodzaj": "mowa"|"mysl"|"krzyk"|"szept"|"narracja", "opis_sceny": string (what the panel shows, for the artist), "miejsce": string (name from "miejsca" or "")}]}
Every panel needs at least one row in "sceny" (a caption or a line). Pages and panels are numbered from 1.` }] },
    contents: [{ role: 'user', parts: [{ text: tekst }] }],
    generationConfig: { temperature: zrodlo === 'dokument' ? 0.2 : 0.8, responseMimeType: 'application/json' },
  };
}

// JSON odpowiedzi → uporządkowany scenariusz (błędne pola poprawione, puste wiersze odrzucone).
export function scenariuszZOdpowiedzi(tekst) {
  let d;
  try { d = JSON.parse(String(tekst).replace(/^```[a-z]*\n?|\n?```$/g, '')); } catch { throw new Error('Model zwrócił scenariusz w złym formacie – spróbuj jeszcze raz.'); }
  const s = (v) => String(v ?? '').trim();
  const sceny = (Array.isArray(d?.sceny) ? d.sceny : []).map((w) => ({
    strona: Math.max(1, parseInt(w.strona, 10) || 1), kadr: Math.max(1, parseInt(w.kadr, 10) || 1), postac: s(w.postac), tekst: s(w.tekst),
    rodzaj: RODZAJE.includes(s(w.rodzaj)) ? s(w.rodzaj) : (s(w.postac) ? 'mowa' : 'narracja'), opis_sceny: s(w.opis_sceny), miejsce: s(w.miejsce),
  })).filter((w) => w.tekst || w.opis_sceny).sort((a, b) => a.strona - b.strona || a.kadr - b.kadr);
  if (!sceny.length) throw new Error('Model nie rozpisał żadnej sceny – dopisz więcej szczegółów i spróbuj jeszcze raz.');
  return {
    tytul: s(d.tytul),
    postacie: (Array.isArray(d.postacie) ? d.postacie : []).map((p) => ({ imie: s(p.imie), wyglad: s(p.wyglad), znak: s(p.znak), charakter: s(p.charakter) })).filter((p) => p.imie),
    miejsca: (Array.isArray(d.miejsca) ? d.miejsca : []).map((m) => ({ nazwa: s(m.nazwa), opis: s(m.opis), pora: s(m.pora) })).filter((m) => m.nazwa),
    sceny,
  };
}

export const KOLUMNY_Z_MIEJSCEM = ['strona', 'kadr', 'postać', 'tekst', 'rodzaj', 'opis sceny', 'miejsce'];

// Zapis: tabela scenariusza (zastępuje wiersze; brakująca kolumna „miejsce” dochodzi) i karty (istniejące po imieniu/
// nazwie – uzupełnione tylko puste pola, nowe – dopisane).
export function zapiszScenariusz(projekt, tabela, sc, opcje = {}) {
  if (!tabela.kolumny.includes('miejsce')) { tabela.kolumny.push('miejsce'); tabela.wiersze.forEach((w) => w.push('')); }
  const i = (n) => tabela.kolumny.indexOf(n);
  tabela.wiersze = sc.sceny.map((w) => {
    const r = tabela.kolumny.map(() => '');
    r[i('strona')] = String(w.strona); r[i('kadr')] = String(w.kadr); r[i('postać')] = w.postac; r[i('tekst')] = w.tekst; r[i('rodzaj')] = w.rodzaj;
    if (i('opis sceny') >= 0) r[i('opis sceny')] = w.opis_sceny;
    r[i('miejsce')] = w.miejsce;
    return r;
  });
  const bez = (x) => x.toLowerCase().trim();
  for (const [rodzaj, lista, klucz] of [['postacie', sc.postacie, 'imie'], ['miejsca', sc.miejsca, 'nazwa']]) {
    const jest = karty(projekt, rodzaj);
    for (const k of lista) {
      const stara = jest.find((x) => bez(x[klucz]) === bez(k[klucz]));
      const pelna = stara ? { ...k, ...Object.fromEntries(Object.entries(stara).filter(([, v]) => v !== '' && v != null)) } : k;
      zapiszKarte(projekt, rodzaj, { ...pelna, wiersz: stara ? stara.wiersz : null }, opcje[rodzaj] || {});
    }
  }
  return { wierszy: tabela.wiersze.length, stron: Math.max(...sc.sceny.map((w) => w.strona)) };
}
