// Koszty AI (#372, plan AI B2): ceny modeli w jednym miejscu, szacunek przed wywołaniem, koszt z rzeczywistego
// zużycia (tokeny z odpowiedzi) i licznik wydatków (miesiąc – w pamięci przeglądarki, projekt – w projekcie).
// Ceny: cennik Gemini API (Standard), stan 22.11.2026 – https://aistudio.google.com/docs/pricing. USD za 1 mln tokenów.

export const KURS_USD_PLN = 4.0; // zaokrąglony w górę – koszty w zł podajemy jako „ok.”, raczej za dużo niż za mało

export const CENY = {
  'gemini-3.1-flash-lite-image': { wejscie: 0.25, tekst: 1.5, obraz: 30, tokenyObrazu: { '1K': 1120, '2K': 1680 } },
  'gemini-3.1-flash-image': { wejscie: 0.5, tekst: 3, obraz: 60, tokenyObrazu: { '512': 747, '1K': 1120, '2K': 1680, '4K': 2520 } },
  'gemini-3-pro-image': { wejscie: 2, tekst: 12, obraz: 120, tokenyObrazu: { '1K': 1120, '2K': 1120, '4K': 2000 } },
  'gemini-3.1-flash-lite': { wejscie: 0.25, tekst: 1.5 },
  'gemini-3.5-flash-lite': { wejscie: 0.3, tekst: 2.5 },
};

// Jakości generowania obrazu dla laika: nazwa, model, rozdzielczość.
export const JAKOSCI_OBRAZU = {
  szkic: { model: 'gemini-3.1-flash-lite-image', rozdzielczosc: '1K' },
  dokladny: { model: 'gemini-3.1-flash-image', rozdzielczosc: '2K' },
  pro: { model: 'gemini-3-pro-image', rozdzielczosc: '2K' },
};
export const MODEL_TEKSTU = 'gemini-3.1-flash-lite';

const usd = (tokeny, cenaZaMln) => ((tokeny || 0) * (cenaZaMln || 0)) / 1e6;
export const naZl = (dolary) => dolary * KURS_USD_PLN;

// Szacunek kosztu w zł przed wywołaniem: obraz (wyjście) + opis i obrazy wzorcowe (wejście, ok. 560 tokenów obrazu).
export function szacujObraz({ model, rozdzielczosc = '1K', ile = 1, znakiOpisu = 300, wzorce = 0 }) {
  const c = CENY[model];
  if (!c) return null;
  const tokWy = c.tokenyObrazu?.[rozdzielczosc] ?? c.tokenyObrazu?.['1K'] ?? 1300;
  const tokWe = Math.ceil(znakiOpisu / 3) + wzorce * 560;
  return naZl(usd(tokWy, c.obraz) + usd(tokWe, c.wejscie)) * ile;
}
export function szacujTekst({ model = MODEL_TEKSTU, znakiWe = 1000, znakiWy = 1000 }) {
  const c = CENY[model];
  return c ? naZl(usd(Math.ceil(znakiWe / 3), c.wejscie) + usd(Math.ceil(znakiWy / 3), c.tekst)) : null;
}

// Koszt z usageMetadata odpowiedzi Gemini (w zł): tokeny wejścia, tekstu (z myśleniem) i obrazu wyjścia.
export function kosztZUzycia(model, u) {
  const c = CENY[model];
  if (!c || !u) return null;
  const szczeg = u.candidatesTokensDetails || [];
  const tokObraz = szczeg.filter((d) => d.modality === 'IMAGE').reduce((a, d) => a + (d.tokenCount || 0), 0);
  const tokWy = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
  return naZl(usd(u.promptTokenCount, c.wejscie) + usd(tokObraz, c.obraz || c.tekst) + usd(Math.max(0, tokWy - tokObraz), c.tekst));
}

// „ok. 0,14 zł” – zaokrąglenie w górę do grosza (koszt większy od zera – co najmniej 0,01 zł).
export function opisKosztu(zl, jezyk = 'pl') {
  const v = zl > 0 ? Math.max(0.01, Math.ceil(zl * 100) / 100) : 0;
  return `${v.toLocaleString(jezyk === 'uk' ? 'uk-UA' : jezyk === 'en' ? 'en-GB' : 'pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

// ---------- Licznik wydatków ----------
const PAMIEC = 'makietka-ai-wydatki';
const miesiac = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function czytaj(magazyn) { try { return JSON.parse(magazyn?.getItem(PAMIEC) || 'null'); } catch { return null; } }
// { miesiac, zl, limit } – limit miesięczny w zł (0 = bez limitu); nowy miesiąc zeruje sumę.
export function wydatki(magazyn = globalThis.localStorage) {
  const w = czytaj(magazyn) || {};
  const m = miesiac();
  return { miesiac: m, zl: w.miesiac === m ? Number(w.zl) || 0 : 0, limit: Number(w.limit) || 0 };
}
export function ustawLimit(zl, magazyn = globalThis.localStorage) {
  const w = wydatki(magazyn);
  try { magazyn?.setItem(PAMIEC, JSON.stringify({ ...w, limit: Math.max(0, Number(zl) || 0) })); } catch { /* bez pamięci */ }
}
// Zapis wydatku: miesiąc (urządzenie) i projekt (pole projekt.ai_wydatki – suma i ostatnie wpisy).
export function zapiszWydatek(zl, { projekt = null, model, rodzaj, magazyn = globalThis.localStorage } = {}) {
  const w = wydatki(magazyn);
  try { magazyn?.setItem(PAMIEC, JSON.stringify({ ...w, zl: Math.round((w.zl + zl) * 10000) / 10000 })); } catch { /* bez pamięci */ }
  if (projekt) {
    const p = projekt.ai_wydatki || { zl: 0, wpisy: [] };
    p.zl = Math.round(((p.zl || 0) + zl) * 10000) / 10000;
    p.wpisy = [...(p.wpisy || []), { data: new Date().toISOString(), model, rodzaj, zl: Math.round(zl * 10000) / 10000 }].slice(-200);
    projekt.ai_wydatki = p;
  }
}
// Czy wydatek zmieści się w limicie miesiąca.
export const wLimicie = (zl, w = wydatki()) => !w.limit || w.zl + zl <= w.limit + 1e-9;
