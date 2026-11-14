// Formularz kontaktowy (decyzja #95) – jak w Familiadzie: wiadomość idzie do Workera api.makietka.app/kontakt
// (pułapka na boty, Cloudflare Turnstile, limity na IP i adres), trafia do skrzynki kontakt@makietka.app
// w panelu administratora (bez maila do nadawcy, decyzja #95h). Działa też bez logowania (ekran logowania).

import { SUPABASE_URL } from '../konfiguracja.js';
import { supabase } from '../chmura.js';
import { $, powiadom } from '../ui.js';
import { wstawIkony } from '../ikony.js';
import { stan } from './kontekst.js';

// Klucz witryny Cloudflare Turnstile (publiczny; sekret jest w Workerze jako TURNSTILE_SECRET). Pusty – bez Turnstile:
// formularz chronią wtedy pułapka i limity. Wpisz tu klucz po dodaniu witryny makietka.app w Cloudflare → Turnstile.
export const KLUCZ_TURNSTILE = '';

const dlg = $('#dlg-kontakt');
const form = $('#form-kontakt');
const kom = $('#kontakt-komunikat');
let widget = null;

// Załączniki (#116): do 5 plików, razem do 10 MB – tak samo pilnuje Worker.
const MAKS_PLIKOW = 5;
const MAKS_RAZEM = 10 * 1024 * 1024;
let pliki = [];
const rozmiar = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
function pokazPliki() {
  const ul = $('#kontakt-lista-plikow');
  ul.replaceChildren(...pliki.map((f, i) => {
    const li = document.createElement('li');
    li.className = 'zalacznik';
    li.innerHTML = '<span data-ikona="spinacz" data-rozmiar="16"></span><span class="nazwa"></span><span class="ciche"></span>'
      + '<button type="button" class="przycisk-ikona maly" data-ikona="zamknij" data-rozmiar="14" title="Usuń załącznik"></button>';
    li.querySelector('.nazwa').textContent = f.name;
    li.querySelector('.ciche').textContent = rozmiar(f.size);
    li.querySelector('button').setAttribute('aria-label', `Usuń załącznik ${f.name}`);
    li.querySelector('button').addEventListener('click', () => { pliki.splice(i, 1); pokazPliki(); });
    return li;
  }));
  ul.hidden = !pliki.length;
  wstawIkony(ul);
}
$('#kontakt-pliki').addEventListener('change', (e) => {
  for (const f of e.target.files) {
    if (pliki.length >= MAKS_PLIKOW) { powiadom(`Najwyżej ${MAKS_PLIKOW} załączników.`, true); break; }
    if (pliki.reduce((n, x) => n + x.size, 0) + f.size > MAKS_RAZEM) { powiadom(`„${f.name}” się nie zmieści – załączniki razem mogą mieć najwyżej 10 MB.`, true); continue; }
    pliki.push(f);
  }
  e.target.value = '';
  pokazPliki();
});

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
    // Zwykłe zapytanie (text/plain albo multipart z plikami) – bez osobnego zapytania wstępnego CORS.
    const naglowki = pliki.length ? {} : { 'content-type': 'text/plain;charset=UTF-8' };
    if (stan.uzytkownik) {
      const token = (await (await supabase()).auth.getSession()).data.session?.access_token;
      if (token) naglowki.authorization = `Bearer ${token}`;
    }
    const odp = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/kontakt`, {
      method: 'POST',
      headers: naglowki,
      body: (() => {
        const dane = JSON.stringify({
          email: form.email.value.trim(), temat: form.temat.value.trim(), tresc: form.tresc.value.trim(), www: form.www.value,
          turnstile: widget !== null ? window.turnstile?.getResponse(widget) : undefined,
        });
        if (!pliki.length) return dane;
        const fd = new window.FormData();
        fd.append('dane', dane);
        for (const f of pliki) fd.append('pliki', f, f.name);
        return fd;
      })(),
    });
    const w = await odp.json().catch(() => ({}));
    if (!odp.ok) throw new Error(w.blad || `Nie udało się wysłać (${odp.status}).`);
    form.temat.value = '';
    form.tresc.value = '';
    pliki = [];
    pokazPliki();
    kom.textContent = '';
    dlg.close();
    powiadom('Dziękujemy! Zgłoszenie dotarło – odpowiemy na podany adres.');
  } catch (err) {
    kom.textContent = err.message === 'Failed to fetch' ? 'Brak połączenia – spróbuj za chwilę.' : err.message;
    kom.className = 'komunikat blad';
    if (widget !== null) window.turnstile?.reset(widget);
  } finally {
    przycisk.disabled = false;
  }
});
