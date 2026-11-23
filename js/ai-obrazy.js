import { t } from './jezyk.js';
// Generowanie obrazów (#372, plan AI B3): opis po polsku → obraz z modelu obrazkowego Gemini, prosto z przeglądarki
// kluczem użytkownika z sejfu (jak czat AI, #241 – klucz nie przechodzi przez serwery Makietki). Proporcje z ramki
// (najbliższe obsługiwane), obrazy wzorcowe (np. karta postaci) jako odniesienie, rozdzielczość 1K (szkic) albo 2K.
// Wynik: plik obrazu + zużycie (tokeny) do policzenia kosztu (js/ai-koszty.js). Moduł bez zależności od edytora.

// Proporcje obsługiwane przez modele obrazkowe Gemini.
export const PROPORCJE = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

// Najbliższa obsługiwana proporcja dla ramki w × h (po logarytmie stosunku – tak samo „daleko” w pion i w poziom).
export function proporcjaRamki(w, h) {
  if (!(w > 0 && h > 0)) return '1:1';
  const cel = Math.log(w / h);
  let naj = '1:1'; let roznica = Infinity;
  for (const p of PROPORCJE) {
    const [a, b] = p.split(':').map(Number);
    const r = Math.abs(Math.log(a / b) - cel);
    if (r < roznica) { roznica = r; naj = p; }
  }
  return naj;
}

// Treść zapytania generateContent: opis + obrazy wzorcowe ({ typ, dane: base64 }) + ustawienia obrazu.
export function zapytanieObrazu({ opis, proporcja = '1:1', rozdzielczosc = '1K', wzorce = [] }) {
  return {
    contents: [{ role: 'user', parts: [...wzorce.map((o) => ({ inline_data: { mime_type: o.typ, data: o.dane } })), { text: opis }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: proporcja, imageSize: rozdzielczosc } },
  };
}

// Odpowiedź → { typ, dane (base64), uzycie, tekst } albo błąd z czytelnym opisem (np. odmowa z powodu treści).
export function obrazZOdpowiedzi(odp) {
  const kandydat = odp?.candidates?.[0];
  const czesci = kandydat?.content?.parts || [];
  const obraz = czesci.find((c) => c.inlineData || c.inline_data);
  const tekst = czesci.filter((c) => c.text).map((c) => c.text).join('\n').trim();
  if (!obraz) {
    const powod = odp?.promptFeedback?.blockReason || kandydat?.finishReason || '';
    const b = new Error(powod && powod !== 'STOP' ? t('kod.aiObrazy.brakObrazuPowod', { powod }) : `${t('kod.aiObrazy.brakObrazu')}${tekst ? t('kod.aiObrazy.odpowiedz', { tekst: tekst.slice(0, 200) }) : ''}`);
    b.uzycie = odp?.usageMetadata || null;
    throw b;
  }
  const d = obraz.inlineData || obraz.inline_data;
  return { typ: d.mimeType || d.mime_type || 'image/png', dane: d.data, uzycie: odp.usageMetadata || null, tekst };
}

// Wywołanie: fetchJson(url, opcje) → JSON odpowiedzi (z ponawianiem i czytelnymi błędami – js/ai-dostawcy.js).
export async function generujObraz({ klucz, model, adres = 'https://generativelanguage.googleapis.com/v1beta', fetchJson, ...reszta }) {
  const odp = await fetchJson(`${adres}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': klucz },
    body: JSON.stringify(zapytanieObrazu(reszta)),
  });
  return obrazZOdpowiedzi(odp);
}

// base64 → Blob (w przeglądarce).
export function blobZBase64(dane, typ) {
  const bin = atob(dane);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) b[i] = bin.charCodeAt(i);
  return new Blob([b], { type: typ });
}
