// Logowanie przez OpenRouter (#217, N6 – 23.11): zamiast wklejać klucz – logowanie i zgoda w OpenRouter, a klucz,
// który wydaje, trafia do sejfu kluczy jak każdy klucz dostawcy (zaszyfrowany hasłem do kluczy).
// Start: przycisk w okienku „Nowy klucz API dostawcy” (dostawca OpenRouter). Powrót: ?code=… – kod przejmowany
// zaraz po uruchomieniu aplikacji (js/aplikacja.js – adres bez kodu), klucz zapisany po zalogowaniu do Makietki.

import { powiadom } from '../ui.js';
import { adresLogowaniaOpenRouter, kluczZKoduOpenRouter } from '../ai-dostawcy.js';
import { t } from '../jezyk.js';

const SESJA = 'makietka-openrouter';
const PAMIEC = 'makietka-czat-ai';

export async function zalogujPrzezOpenRouter() {
  const powrot = `${location.origin}${location.pathname}`;
  const { weryfikator, adres } = await adresLogowaniaOpenRouter(powrot);
  try { sessionStorage.setItem(SESJA, JSON.stringify({ weryfikator, hash: '#/konto/ai' })); } catch { /* bez pamięci sesji */ }
  location.href = adres;
}

// Po zalogowaniu do Makietki: klucz z OpenRouter do sejfu; OpenRouter – dostawca asystenta.
export async function dokonczLogowanieOpenRouter(dane) {
  if (!dane) return false;
  try {
    const klucz = await kluczZKoduOpenRouter(dane.kod, dane.weryfikator);
    const { otwartySejf } = await import('./sejf-ai.js');
    const sejf = await otwartySejf();
    if (!sejf) throw new Error(t('czatAiLogowanie.bezSejfu'));
    await sejf.ustaw('openrouter', klucz);
    let u = { dostawca: 'openrouter', rola: 'edycja', dostawcy: {} };
    try { u = { ...u, ...(JSON.parse(localStorage.getItem(PAMIEC) || 'null') || {}), dostawca: 'openrouter' }; } catch { /* domyślne */ }
    try { localStorage.setItem(PAMIEC, JSON.stringify(u)); } catch { /* bez pamięci */ }
    powiadom(t('czatAiLogowanie.polaczonoZOpenrouterAsystent'));
    document.dispatchEvent(new CustomEvent('makietka:klucze-ai'));
    return true;
  } catch (e) {
    powiadom(t('czatAiLogowanie.logowaniePrzezOpenrouterNie', { message: e.message }), true);
    return false;
  }
}
