// Formularz kontaktowy (decyzja #95) – jak w Familiadzie: wiadomość idzie do Workera api.makietka.app/kontakt
// (pułapka na boty, Cloudflare Turnstile, limity na IP i adres), trafia do skrzynki kontakt@makietka.app
// w panelu administratora, a nadawca dostaje potwierdzenie mailem. Działa też bez logowania (ekran logowania).

import { SUPABASE_URL } from '../konfiguracja.js';
import { supabase } from '../chmura.js';
import { $, powiadom } from '../ui.js';
import { stan } from './kontekst.js';

// Klucz witryny Cloudflare Turnstile (publiczny; sekret jest w Workerze jako TURNSTILE_SECRET). Pusty – bez Turnstile:
// formularz chronią wtedy pułapka i limity. Wpisz tu klucz po dodaniu witryny makietka.app w Cloudflare → Turnstile.
export const KLUCZ_TURNSTILE = '';

const dlg = $('#dlg-kontakt');
const form = $('#form-kontakt');
const kom = $('#kontakt-komunikat');
let widget = null;

function turnstile() {
  if (!KLUCZ_TURNSTILE) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((ok) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => ok(window.turnstile || null);
    s.onerror = () => ok(null);
    document.head.append(s);
  });
}

export async function otworzKontakt() {
  kom.textContent = '';
  kom.className = 'komunikat';
  if (stan.uzytkownik?.email && !form.email.value) form.email.value = stan.uzytkownik.email;
  if (!dlg.open) dlg.showModal();
  (form.email.value ? form.tresc : form.email).focus();
  const t = await turnstile();
  const miejsce = $('#kontakt-turnstile');
  miejsce.hidden = !t;
  if (t && widget === null) widget = t.render(miejsce, { sitekey: KLUCZ_TURNSTILE, language: 'pl', theme: 'auto' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const przycisk = $('#kontakt-wyslij');
  przycisk.disabled = true;
  kom.className = 'komunikat';
  kom.textContent = 'Wysyłam…';
  try {
    // Zwykłe zapytanie (text/plain) – bez osobnego zapytania wstępnego CORS; Worker i tak czyta treść jako JSON.
    const naglowki = { 'content-type': 'text/plain;charset=UTF-8' };
    if (stan.uzytkownik) {
      const token = (await (await supabase()).auth.getSession()).data.session?.access_token;
      if (token) naglowki.authorization = `Bearer ${token}`;
    }
    const odp = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/kontakt`, {
      method: 'POST',
      headers: naglowki,
      body: JSON.stringify({
        email: form.email.value.trim(), temat: form.temat.value.trim(), tresc: form.tresc.value.trim(), www: form.www.value,
        turnstile: widget !== null ? window.turnstile?.getResponse(widget) : undefined,
      }),
    });
    const w = await odp.json().catch(() => ({}));
    if (!odp.ok) throw new Error(w.blad || `Nie udało się wysłać (${odp.status}).`);
    form.temat.value = '';
    form.tresc.value = '';
    kom.textContent = '';
    dlg.close();
    powiadom('Dziękujemy! Wiadomość dotarła – potwierdzenie przyjdzie mailem.');
  } catch (err) {
    kom.textContent = err.message === 'Failed to fetch' ? 'Brak połączenia – spróbuj za chwilę.' : err.message;
    kom.className = 'komunikat blad';
    if (widget !== null) window.turnstile?.reset(widget);
  } finally {
    przycisk.disabled = false;
  }
});
