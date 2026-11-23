import { t as tt } from './jezyk.js';
// Tekst z AI (#373, plan AI B4): skróć, wydłuż, prościej, uroczyściej, popraw błędy, przetłumacz (pl/en/uk) – na
// zaznaczonej ramce tekstu; wypełnianie kolumny tabeli. Tani model tekstowy Gemini kluczem z sejfu, prosto
// z przeglądarki (jak obraz AI, #372). Moduł bez zależności od edytora.

export const CZYNNOSCI = {
  skroc: 'Shorten the text to about half its length. Keep the meaning and the most important information.',
  wydluz: 'Expand the text to about one and a half times its length, adding natural detail in the same tone. Do not invent facts, names or numbers.',
  prosciej: 'Rewrite the text in simpler, friendlier words that a child or beginner understands. Keep the meaning.',
  uroczysciej: 'Rewrite the text in a more formal, elegant, festive tone. Keep the meaning.',
  popraw: 'Correct spelling, grammar and punctuation only. Do not change the wording otherwise.',
  pl: 'Translate the text into Polish.',
  en: 'Translate the text into English.',
  uk: 'Translate the text into Ukrainian.',
};

// Zasady wspólne: tylko wynik, w języku tekstu (poza tłumaczeniem), te same podziały akapitów, pola {…} bez zmian.
const ZASADY = 'Return only the resulting text – no comments, quotes or markdown. Keep the language of the original unless asked to translate. Keep paragraph breaks. Keep placeholders in curly braces like {name} exactly as they are.';

export function zapytanieTekstu({ czynnosc, tekst, polecenie = '' }) {
  const co = CZYNNOSCI[czynnosc] || polecenie;
  return {
    systemInstruction: { parts: [{ text: `${co} ${ZASADY}` }] },
    contents: [{ role: 'user', parts: [{ text: tekst }] }],
    generationConfig: { temperature: 0.4 },
  };
}

export function tekstZOdpowiedzi(odp) {
  const t = (odp?.candidates?.[0]?.content?.parts || []).filter((c) => c.text && !c.thought).map((c) => c.text).join('').trim();
  if (!t) throw new Error(tt('kod.aiTekst.brakTekstu', { powod: odp?.promptFeedback?.blockReason ? ` (${odp.promptFeedback.blockReason})` : '' }));
  return { tekst: t.replace(/^```[a-z]*\n?|\n?```$/g, '').trim(), uzycie: odp.usageMetadata || null };
}

export async function przerobTekst({ klucz, model, adres = 'https://generativelanguage.googleapis.com/v1beta', fetchJson, ...reszta }) {
  const odp = await fetchJson(`${adres}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': klucz }, body: JSON.stringify(zapytanieTekstu(reszta)),
  });
  return tekstZOdpowiedzi(odp);
}

// Wypełnianie kolumny tabeli: jedno zapytanie na wszystkie wiersze (JSON: lista tekstów w kolejności wierszy).
export function zapytanieKolumny({ polecenie, kolumny, wiersze, kolumna }) {
  const dane = wiersze.map((w) => Object.fromEntries(kolumny.map((k, i) => [k, w[i] ?? ''])));
  return {
    systemInstruction: { parts: [{ text: `You fill one column of a table. For every row, write the value of the column "${kolumna}" following the user's instruction, using the other columns of that row. Answer with a JSON array of strings only – exactly one string per row, in the same order. Keep the language of the instruction. Keep placeholders in curly braces exactly.` }] },
    contents: [{ role: 'user', parts: [{ text: `Instruction: ${polecenie}\nRows (JSON): ${JSON.stringify(dane)}` }] }],
    generationConfig: { temperature: 0.6, responseMimeType: 'application/json' },
  };
}
export function kolumnaZOdpowiedzi(odp, ile) {
  const { tekst, uzycie } = tekstZOdpowiedzi(odp);
  let lista;
  try { lista = JSON.parse(tekst); } catch { throw new Error('Model zwrócił odpowiedź w złym formacie – spróbuj jeszcze raz.'); }
  if (!Array.isArray(lista)) throw new Error('Model zwrócił odpowiedź w złym formacie – spróbuj jeszcze raz.');
  return { wartosci: Array.from({ length: ile }, (_, i) => String(lista[i] ?? '')), uzycie };
}
export async function wypelnijKolumne({ klucz, model, adres = 'https://generativelanguage.googleapis.com/v1beta', fetchJson, ...reszta }) {
  const odp = await fetchJson(`${adres}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': klucz }, body: JSON.stringify(zapytanieKolumny(reszta)),
  });
  return kolumnaZOdpowiedzi(odp, reszta.wiersze.length);
}
