// Powrót z logowania OpenRouter do czatu AI (#217) – bez edytora: działa zaraz po uruchomieniu aplikacji.

import { powiadom } from '../ui.js';
import { kluczZKoduOpenRouter } from '../ai-dostawcy.js';
import { t } from '../jezyk.js';

const PAMIEC = 'makietka-czat-ai';

// Powrót z OpenRouter: ?code=… – klucz zapisany przy dostawcy OpenRouter, adres bez kodu.
export async function dokonczLogowanieOpenRouter() {
  const kod = new URLSearchParams(location.search).get('code');
  let zapis = null;
  try { zapis = JSON.parse(sessionStorage.getItem('makietka-openrouter') || 'null'); } catch { zapis = null; }
  if (!kod || !zapis) return false;
  try { sessionStorage.removeItem('makietka-openrouter'); } catch { /* jw. */ }
  history.replaceState(null, '', `${location.pathname}${zapis.hash || ''}`);
  try {
    const klucz = await kluczZKoduOpenRouter(kod, zapis.weryfikator);
    let u = { dostawca: 'anthropic', rola: 'edycja', dostawcy: {} };
    try { u = JSON.parse(localStorage.getItem(PAMIEC) || 'null') || u; } catch { /* domyślne */ }
    u.dostawca = 'openrouter';
    u.dostawcy.openrouter = { ...(u.dostawcy.openrouter || {}), klucz };
    try { localStorage.setItem(PAMIEC, JSON.stringify(u)); } catch { /* bez pamięci */ }
    powiadom(t('czatAiLogowanie.polaczonoZOpenrouterAsystent'));
    return true;
  } catch (e) {
    powiadom(`Logowanie przez OpenRouter nie powiodło się: ${e.message}`, true);
    return false;
  }
}

