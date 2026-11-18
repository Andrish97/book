// Czat AI w Makietce (#217): rozmowa z wybranym modelem (własny klucz dostawcy, kilku dostawców, wybór modelu),
// który działa na otwartym projekcie tymi samymi narzędziami co łącznik MCP (js/ai-narzedzia-rdzen.js) – u siebie,
// w przeglądarce. Uprawnienia: jednodniowy klucz dostępu AI tylko do tego projektu (czytanie albo zmiany), widoczny
// i do odebrania w Ustawieniach konta → Dostęp dla AI. Zmiany AI wracają do edytora jak każda zmiana z konta.
// Klucze dostawców leżą tylko na tym urządzeniu (localStorage); rozmowa idzie prosto do dostawcy.

import { $, powiadom } from '../ui.js';
import * as chmura from '../chmura.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../konfiguracja.js';
import { DOSTAWCY, modeleDostawcy, nowaRozmowa, zapytaj, adresLogowaniaOpenRouter } from '../ai-dostawcy.js';
import { stan } from './kontekst.js';
import { zapiszTeraz, sprawdzKonto, synchronizuj } from './zapis.js';

const dlg = $('#dlg-czat-ai');
const f = $('#czat-ai-ustawienia');
const lista = $('#czat-ai-wiadomosci');
const pole = $('#czat-ai-tekst');
const PAMIEC = 'makietka-czat-ai';
const PAMIEC_KLUCZY = 'makietka-czat-ai-dostep';

let rozmowa = null;
let narzedzia = null; // { serwer, stanSesji, lista, instrukcje, projekt, rola }
let przerwano = false;
let trwa = false;

const czytaj = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const zapisz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bez pamięci – na tę sesję */ } };
const ustawienia = () => czytaj(PAMIEC, { dostawca: 'anthropic', rola: 'edycja', dostawcy: {} });
const ustDostawcy = (u = ustawienia(), id = u.dostawca) => ({ model: DOSTAWCY[id]?.modele[0] || '', ...(u.dostawcy[id] || {}) });

function dopisz(rodzaj, tekst) {
  const li = document.createElement('li');
  li.className = rodzaj;
  li.textContent = tekst;
  lista.append(li);
  lista.scrollTop = lista.scrollHeight;
  return li;
}

// ---------- Ustawienia ----------

function pokazUstawienia() {
  const u = ustawienia();
  f.elements.dostawca.replaceChildren(...Object.entries(DOSTAWCY).map(([id, d]) => new Option(d.nazwa, id)));
  f.elements.dostawca.value = u.dostawca;
  f.elements.rola.value = u.rola || 'edycja';
  wypelnijDostawce();
}
function wypelnijDostawce() {
  const u = ustawienia();
  const id = f.elements.dostawca.value;
  const d = DOSTAWCY[id];
  const ust = ustDostawcy(u, id);
  f.elements.klucz.value = ust.klucz || '';
  f.elements.model.value = ust.model || '';
  f.elements.adres.value = ust.adres || '';
  $('#czat-ai-adres-pole').hidden = !d.wlasnyAdres;
  $('#czat-ai-openrouter').hidden = !d.logowanie;
  const gdzie = $('#czat-ai-gdzie-klucz');
  gdzie.hidden = !d.kluczUrl;
  if (d.kluczUrl) gdzie.href = d.kluczUrl;
  $('#czat-ai-modele').replaceChildren(...d.modele.map((m) => new Option(m, m)));
  if (ust.klucz) odswiezModele(id, ust);
}
async function odswiezModele(id, ust) {
  try {
    const modele = await modeleDostawcy(id, ust);
    if (f.elements.dostawca.value !== id || !modele.length) return;
    $('#czat-ai-modele').replaceChildren(...modele.map((m) => new Option(m, m)));
    if (!f.elements.model.value) f.elements.model.value = DOSTAWCY[id].modele.find((m) => modele.includes(m)) || modele[0];
  } catch { /* lista modeli niedostępna – można wpisać nazwę */ }
}
function zapamietajPola() {
  const u = ustawienia();
  const id = f.elements.dostawca.value;
  const stary = u.dostawca;
  u.dostawca = id;
  u.rola = f.elements.rola.value;
  u.dostawcy[id] = { klucz: f.elements.klucz.value.trim(), model: f.elements.model.value.trim(), ...(DOSTAWCY[id].wlasnyAdres ? { adres: f.elements.adres.value.trim() } : {}) };
  zapisz(PAMIEC, u);
  if (stary !== id || (rozmowa && (rozmowa.model !== u.dostawcy[id].model || rozmowa.klucz !== u.dostawcy[id].klucz))) rozmowa = null; // nowy dostawca albo model – nowa rozmowa
  if (narzedzia && narzedzia.rola !== u.rola) narzedzia = null;
}
f.addEventListener('change', (e) => {
  if (e.target.name === 'dostawca') { zapamietajPola(); wypelnijDostawce(); return; }
  zapamietajPola();
  if (e.target.name === 'klucz') odswiezModele(f.elements.dostawca.value, ustDostawcy());
});
$('#czat-ai-ustawienia-przelacz').addEventListener('click', () => { f.hidden = !f.hidden; });

// OpenRouter: logowanie i zgoda w oknie OpenRouter zamiast wklejania klucza.
$('#czat-ai-openrouter').addEventListener('click', async () => {
  const powrot = `${location.origin}${location.pathname}`;
  const { weryfikator, adres } = await adresLogowaniaOpenRouter(powrot);
  try { sessionStorage.setItem('makietka-openrouter', JSON.stringify({ weryfikator, hash: location.hash })); } catch { /* bez pamięci sesji */ }
  location.href = adres;
});
// ---------- Narzędzia projektu ----------

// Jednodniowy klucz dostępu AI do otwartego projektu (z wybraną rolą), zapamiętany na urządzeniu do wygaśnięcia.
async function kluczDostepu(projektId, rola) {
  const zapisane = czytaj(PAMIEC_KLUCZY, {});
  const k = zapisane[`${projektId}:${rola}`];
  if (k && new Date(k.wazny_do).getTime() > Date.now() + 10 * 60 * 1000) return k.klucz;
  const w = await chmura.utworzDostepAi(projektId, { opis: 'Czat w Makietce', rola, dni: 1 });
  zapisane[`${projektId}:${rola}`] = { klucz: w.klucz, wazny_do: w.wazny_do || new Date(Date.now() + 864e5).toISOString() };
  zapisz(PAMIEC_KLUCZY, zapisane);
  return w.klucz;
}

async function przygotujNarzedzia() {
  const projekt = stan.projekt.id;
  const rola = ustawienia().rola || 'edycja';
  if (narzedzia?.projekt === projekt && narzedzia.rola === rola) return narzedzia;
  const { utworzSerwer } = await import('../ai-narzedzia-rdzen.js');
  const serwer = utworzSerwer({ adres: SUPABASE_URL, kluczPubliczny: SUPABASE_ANON_KEY, klucz: await kluczDostepu(projekt, rola), projekt });
  const stanSesji = {};
  let nr = 0;
  const wolaj = async (method, params = {}) => {
    const w = await serwer.obsluz({ jsonrpc: '2.0', id: (nr += 1), method, params }, stanSesji);
    if (w?.error) throw new Error(w.error.message);
    return w?.result;
  };
  const init = await wolaj('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'makietka-czat', version: '1' } });
  // Czat działa na otwartym projekcie – bez narzędzi do innych projektów.
  const POZA = new Set(['projekty', 'nowy_projekt', 'usun_projekt']);
  const { tools } = await wolaj('tools/list');
  const lista = tools.filter((t) => !POZA.has(t.name)).map((t) => {
    const { projekt: _p, ...reszta } = t.inputSchema.properties || {};
    return { name: t.name, description: t.description, inputSchema: { ...t.inputSchema, properties: reszta, required: (t.inputSchema.required || []).filter((r) => r !== 'projekt') } };
  });
  narzedzia = { projekt, rola, lista, instrukcje: init?.instructions || '', wolaj };
  return narzedzia;
}

function systemDla(n) {
  return [
    `Jesteś asystentem w Makietce – edytorze publikacji do druku. Pracujesz na otwartym projekcie „${stan.projekt.nazwa}” (id ${stan.projekt.id}); inne projekty są poza zasięgiem.`,
    n.rola === 'odczyt' ? 'Masz dostęp tylko do czytania: niczego nie zmieniaj, doradzaj i opisuj.' : 'Możesz czytać i zmieniać ten projekt – zmiany widać od razu w edytorze użytkownika.',
    'Odpowiadaj po polsku, krótko i konkretnie. Przed zmianami zajrzyj do projektu narzędziem przeglad_projektu; zmieniaj małymi krokami i na końcu powiedz, co zrobiłeś.',
    n.instrukcje,
  ].join('\n\n');
}

// ---------- Rozmowa ----------

async function wyslij(tekst) {
  if (trwa || !tekst.trim()) return;
  zapamietajPola();
  const u = ustawienia();
  const ust = ustDostawcy(u);
  if (!ust.klucz) { f.hidden = false; powiadom('Podaj klucz API wybranego dostawcy (albo zaloguj się przez OpenRouter).', true); f.elements.klucz.focus(); return; }
  if (!ust.model) { f.hidden = false; powiadom('Wybierz model.', true); f.elements.model.focus(); return; }
  if (!stan.uzytkownik) { powiadom('Asystent AI działa na projekcie na koncie – zaloguj się.', true); return; }
  trwa = true;
  przerwano = false;
  $('#czat-ai-wyslij').disabled = true;
  $('#czat-ai-przerwij').hidden = false;
  dopisz('ja', tekst);
  pole.value = '';
  const czeka = dopisz('narzedzie', 'Myślę…');
  try {
    await zapiszTeraz(); // AI ma widzieć to, co teraz na ekranie – także projekt, którego jeszcze nie ma na koncie
    await synchronizuj({ wymus: true }).catch(() => {});
    const n = await przygotujNarzedzia();
    if (!rozmowa || rozmowa.projekt !== n.projekt) rozmowa = { ...nowaRozmowa({ dostawca: u.dostawca, model: ust.model, ust, system: systemDla(n), narzedzia: n.lista }), projekt: n.projekt };
    let zmiany = false;
    const wynik = await zapytaj(rozmowa, tekst, {
      przerwij: () => przerwano,
      naKrok: (k) => { if (k.tekst && k.wywolania.length) dopisz('ai', k.tekst); },
      wykonaj: async (nazwa, argumenty) => {
        czeka.textContent = `Narzędzie: ${nazwa}…`;
        dopisz('narzedzie', `🔧 ${nazwa}`);
        const r = await n.wolaj('tools/call', { name: nazwa, arguments: argumenty });
        if (!/^(czytaj|przeglad|projekty|obrazy_projektu|komentarze|stan_eksportu|opis_formatu|kontrola)/.test(nazwa)) zmiany = true;
        return { tekst: (r?.content || []).map((c) => c.text || '').join('\n') || '(brak treści)', blad: Boolean(r?.isError) };
      },
    });
    czeka.remove();
    dopisz('ai', wynik.tekst || (wynik.przerwano ? 'Przerwano.' : 'Gotowe.'));
    if (zmiany) sprawdzKonto(); // zmiany AI – od razu w edytorze
  } catch (e) {
    czeka.remove();
    dopisz('blad', e.message);
  } finally {
    trwa = false;
    $('#czat-ai-wyslij').disabled = false;
    $('#czat-ai-przerwij').hidden = true;
  }
}

$('#czat-ai-pisz').addEventListener('submit', (e) => { e.preventDefault(); wyslij(pole.value); });
pole.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); wyslij(pole.value); } });
$('#czat-ai-przerwij').addEventListener('click', () => { przerwano = true; });
$('#czat-ai-zamknij').addEventListener('click', () => dlg.close());

export function otworzCzatAi() {
  if (!stan.projekt) return;
  pokazUstawienia();
  f.hidden = Boolean(ustDostawcy().klucz);
  dlg.classList.toggle('obok-strony', window.matchMedia('(min-width: 901px)').matches);
  if (!dlg.open) dlg.show();
  if (!lista.childElementCount) dopisz('ai', 'Cześć! Napisz, co zrobić w tym projekcie – np. „dodaj stronę z podziękowaniami” albo „popraw literówki na stronie 3”.');
  pole.focus();
}
