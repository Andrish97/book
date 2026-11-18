// Czat AI w Makietce (#217): rozmowa z wybranym modelem (własny klucz dostawcy, kilku dostawców, wybór modelu),
// który działa na otwartym projekcie tymi samymi narzędziami co łącznik MCP (js/ai-narzedzia-rdzen.js) – u siebie,
// w przeglądarce. Uprawnienia: jednodniowy klucz dostępu AI tylko do tego projektu (czytanie albo zmiany), widoczny
// i do odebrania w Ustawieniach konta → Dostęp dla AI. Zmiany AI wracają do edytora jak każda zmiana z konta.
// Klucze dostawców leżą tylko na tym urządzeniu (localStorage); rozmowa idzie prosto do dostawcy.

import { $, powiadom } from '../ui.js';
import * as chmura from '../chmura.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../konfiguracja.js';
import { DOSTAWCY, modeleDostawcy, nowaRozmowa, zapytaj, adresLogowaniaOpenRouter } from '../ai-dostawcy.js';
import { utworzSejf } from '../sejf-kluczy.js';
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
// Klucz dostawcy – tylko z sejfu (#241); w pamięci przeglądarki zostają dostawca, model i adres.
const ustDostawcy = (u = ustawienia(), id = u.dostawca) => ({ model: DOSTAWCY[id]?.modele[0] || '', ...(u.dostawcy[id] || {}), klucz: sejf?.klucz(id) || '' });

// ---------- Sejf kluczy (#241) ----------

let sejf = null;
let sejfKonta = null;
function sejfKonta_() {
  const id = stan.uzytkownik?.id;
  if (!id) return null;
  if (!sejf || sejfKonta !== id) { sejf = utworzSejf(chmura, id); sejfKonta = id; }
  return sejf;
}

// Okno hasła do kluczy: założenie sejfu albo otwarcie go na tym urządzeniu. Zwraca true, gdy sejf jest otwarty.
function oknoSejfu(tryb) {
  let dlg = $('#dlg-sejf-ai');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-sejf-ai';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2></h2>
      <p class="ciche">Klucze API szyfruje Twoja przeglądarka tym hasłem, zanim trafią na konto. Na serwerze leży tylko zaszyfrowany zapis – bez hasła nie odczyta go nikt, także twórca Makietki. Hasło znasz tylko Ty: zgubione – klucze trzeba będzie wkleić od nowa.</p>
      <label class="pole"><span>Hasło do kluczy AI</span><input name="haslo" type="password" autocomplete="new-password" minlength="8"></label>
      <label class="pole" data-rola="powtorz"><span>Powtórz hasło</span><input name="powtorz" type="password" autocomplete="new-password"></label>
      <p class="blad-sejfu" role="alert" hidden></p>
      <div class="przyciski-dialogu"><button class="przycisk" type="button" data-rola="usun" hidden>Nie pamiętam – usuń zapisane klucze</button><button class="przycisk" value="nie">Anuluj</button><button class="przycisk glowny" value="tak"></button></div></form>`;
    document.body.append(dlg);
  }
  const fo = dlg.querySelector('form');
  const zakladanie = tryb === 'brak';
  dlg.querySelector('h2').textContent = zakladanie ? 'Hasło do kluczy AI' : 'Otwórz klucze AI na tym urządzeniu';
  dlg.querySelector('[data-rola="powtorz"]').hidden = !zakladanie;
  dlg.querySelector('[data-rola="usun"]').hidden = zakladanie;
  dlg.querySelector('button[value="tak"]').textContent = zakladanie ? 'Zapisz hasło' : 'Otwórz';
  const blad = dlg.querySelector('.blad-sejfu');
  blad.hidden = true;
  fo.reset();
  return new Promise((ok) => {
    const s = sejfKonta_();
    const naSubmit = async (e) => {
      if (e.submitter?.value !== 'tak') return;
      e.preventDefault();
      const haslo = fo.elements.haslo.value;
      const przycisk = e.submitter;
      przycisk.disabled = true;
      przycisk.textContent = 'Szyfruję…';
      try {
        if (zakladanie) {
          if (haslo !== fo.elements.powtorz.value) throw new Error('Hasła się różnią.');
          await s.zaloz(haslo);
        } else await s.otworz(haslo);
        fo.removeEventListener('submit', naSubmit);
        dlg.close('tak');
        ok(true);
      } catch (er) { blad.textContent = er.message; blad.hidden = false; } finally { przycisk.disabled = false; przycisk.textContent = zakladanie ? 'Zapisz hasło' : 'Otwórz'; }
    };
    fo.addEventListener('submit', naSubmit);
    dlg.querySelector('[data-rola="usun"]').onclick = async () => {
      await s.usun();
      fo.removeEventListener('submit', naSubmit);
      dlg.close('nie');
      powiadom('Zapisane klucze usunięte – wklej je od nowa, a sejf założy się z nowym hasłem.');
      ok(false);
    };
    dlg.addEventListener('close', () => { fo.removeEventListener('submit', naSubmit); if (dlg.returnValue !== 'tak') ok(false); }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Sejf gotowy do użycia (otwarty); pyta o hasło, gdy trzeba. Klucze sprzed sejfu (w pamięci przeglądarki) przenosi.
let otwieranie = null; // jedno otwieranie naraz (zmiana pola klucza potrafi przyjść dwa razy)
function otwartySejf(opcje = {}) {
  if (!otwieranie) otwieranie = otworzSejfRaz(opcje).finally(() => { otwieranie = null; });
  return otwieranie;
}
async function otworzSejfRaz({ pytaj = true } = {}) {
  const s = sejfKonta_();
  if (!s) return null;
  let st = await s.stan();
  if (st !== 'otwarty') {
    if (!pytaj) return null;
    if (!(await oknoSejfu(st))) return null;
    st = 'otwarty';
  }
  const u = ustawienia();
  let przeniesiono = false;
  for (const [id, d] of Object.entries(u.dostawcy || {})) {
    if (!d?.klucz) continue;
    await s.ustaw(id, d.klucz);
    delete d.klucz;
    przeniesiono = true;
  }
  if (przeniesiono) zapisz(PAMIEC, u);
  return s;
}
const maKluczeDoPrzeniesienia = () => Object.values(ustawienia().dostawcy || {}).some((d) => d?.klucz);

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
  f.elements.klucz.placeholder = ust.klucz ? '' : 'Klucz od dostawcy (zaszyfrowany Twoim hasłem do kluczy)';
  f.elements.model.value = ust.model || '';
  f.elements.adres.value = ust.adres || '';
  $('#czat-ai-adres-pole').hidden = !d.wlasnyAdres;
  for (const el of f.querySelectorAll('[data-z-kluczem]')) el.hidden = Boolean(d.bezKlucza);
  $('#czat-ai-schowek-opis').hidden = !d.bezKlucza;
  $('#czat-ai-openrouter').hidden = !d.logowanie;
  const gdzie = $('#czat-ai-gdzie-klucz');
  gdzie.hidden = !d.kluczUrl;
  if (d.kluczUrl) gdzie.href = d.kluczUrl;
  $('#czat-ai-modele').replaceChildren(...d.modele.map((m) => new Option(m, m)));
  if (ust.klucz && !d.bezKlucza) odswiezModele(id, ust);
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
  u.dostawcy[id] = { model: f.elements.model.value.trim(), ...(DOSTAWCY[id].wlasnyAdres ? { adres: f.elements.adres.value.trim() } : {}) };
  zapisz(PAMIEC, u);
  if (stary !== id || (rozmowa && (rozmowa.model !== u.dostawcy[id].model || rozmowa.klucz !== ustDostawcy(u, id).klucz))) rozmowa = null; // nowy dostawca albo model – nowa rozmowa
  if (narzedzia && narzedzia.rola !== u.rola) narzedzia = null;
}
f.addEventListener('change', async (e) => {
  if (e.target.name === 'dostawca') { zapamietajPola(); wypelnijDostawce(); return; }
  if (e.target.name === 'klucz') {
    // Klucz – prosto do sejfu (zaszyfrowany hasłem do kluczy), nigdy do pamięci przeglądarki.
    const id = f.elements.dostawca.value;
    const wartosc = f.elements.klucz.value.trim();
    const s = await otwartySejf();
    if (!s) { f.elements.klucz.value = ''; powiadom('Klucz nie został zapisany – bez hasła do kluczy nie da się go zaszyfrować.', true); return; }
    await s.ustaw(id, wartosc);
    rozmowa = null;
    zapamietajPola();
    odswiezModele(id, ustDostawcy());
    return;
  }
  zapamietajPola();
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
// Pamiętany w sejfie (gdy otwarty) albo tylko w pamięci tej karty – nigdy jawnie w pamięci przeglądarki (#241).
const kluczeKarty = new Map();
async function kluczDostepu(projektId, rola) {
  try { localStorage.removeItem(PAMIEC_KLUCZY); } catch { /* starsza wersja trzymała je jawnie */ }
  const nazwa = `czat:${projektId}:${rola}`;
  const s = await otwartySejf({ pytaj: false });
  let k = kluczeKarty.get(nazwa);
  if (!k && s?.klucz(nazwa)) { try { k = JSON.parse(s.klucz(nazwa)); } catch { k = null; } }
  if (k && new Date(k.wazny_do).getTime() > Date.now() + 10 * 60 * 1000) return k.klucz;
  const w = await chmura.utworzDostepAi(projektId, { opis: 'Czat w Makietce', rola, dni: 1 });
  k = { klucz: w.klucz, wazny_do: w.wazny_do || new Date(Date.now() + 864e5).toISOString() };
  kluczeKarty.set(nazwa, k);
  if (s) await s.ustaw(nazwa, JSON.stringify(k)).catch(() => {});
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

// ---------- Kopiuj i wklej (#239): czat bez klucza API ----------

// Wiadomość z przyciskiem „Kopiuj” (schowek z przycisku działa zawsze; samoczynne kopiowanie – gdy przeglądarka pozwoli).
function dopiszDoSkopiowania(rodzaj, opis, tresc) {
  const li = dopisz(rodzaj, opis);
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk maly', textContent: 'Kopiuj' });
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(tresc); b.textContent = 'Skopiowano'; } catch { powiadom('Przeglądarka nie pozwoliła skopiować – zaznacz tekst ręcznie.', true); }
  });
  const pre = Object.assign(document.createElement('pre'), { className: 'czat-ai-do-skopiowania', textContent: tresc });
  li.append(b, pre);
  navigator.clipboard?.writeText(tresc).then(() => { b.textContent = 'Skopiowano'; }, () => {});
  return li;
}

// Wywołania narzędzi z odpowiedzi czatu: bloki ```makietka / ```json z [{ narzedzie, parametry }] (albo jednym obiektem).
export function wywolaniaZOdpowiedzi(tekst) {
  const bloki = [...String(tekst).matchAll(/```(?:makietka|json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  if (!bloki.length && /^\s*[[{]/.test(tekst)) bloki.push(tekst);
  const wynik = [];
  for (const b of bloki) {
    let d;
    try { d = JSON.parse(b.trim()); } catch { continue; }
    for (const w of Array.isArray(d) ? d : [d]) {
      const nazwa = w?.narzedzie || w?.name || w?.tool;
      if (typeof nazwa === 'string') wynik.push({ nazwa, argumenty: w.parametry || w.arguments || w.args || {} });
    }
  }
  return wynik;
}

function opisNarzedzi(lista) {
  return lista.map((t) => {
    const p = Object.entries(t.inputSchema?.properties || {}).map(([n, d]) => `${n}${(t.inputSchema.required || []).includes(n) ? '*' : ''}: ${d.type || 'dowolny'}${d.enum ? ` (${d.enum.join('|')})` : ''}`).join(', ');
    return `- ${t.name}(${p}) – ${String(t.description || '').replace(/\s+/g, ' ')}`;
  }).join('\n');
}

async function wyslijPrzezSchowek(tekst) {
  if (!stan.uzytkownik) { powiadom('Asystent AI działa na projekcie na koncie – zaloguj się.', true); return; }
  trwa = true;
  $('#czat-ai-wyslij').disabled = true;
  pole.value = '';
  try {
    await zapiszTeraz();
    await synchronizuj({ wymus: true }).catch(() => {});
    const n = await przygotujNarzedzia();
    const wywolania = wywolaniaZOdpowiedzi(tekst);
    if (wywolania.length) {
      // Odpowiedź czatu wklejona: wykonujemy jego narzędzia i oddajemy wyniki do skopiowania.
      dopisz('ja', `Odpowiedź AI wklejona – ${wywolania.length} ${wywolania.length === 1 ? 'polecenie' : 'polecenia'}.`);
      const wyniki = [];
      let zmiany = false;
      for (const w of wywolania) {
        dopisz('narzedzie', `🔧 ${w.nazwa}`);
        try {
          const r = await n.wolaj('tools/call', { name: w.nazwa, arguments: w.argumenty });
          const t = (r?.content || []).map((c) => c.text || '').join('\n') || '(brak treści)';
          wyniki.push(`${r?.isError ? 'BŁĄD' : 'WYNIK'} ${w.nazwa}:\n${t}`);
          if (!r?.isError && !/^(czytaj|przeglad|projekty|obrazy_projektu|komentarze|stan_eksportu|opis_formatu|kontrola)/.test(w.nazwa)) zmiany = true;
        } catch (e) { wyniki.push(`BŁĄD ${w.nazwa}:\n${e.message}`); }
      }
      if (zmiany) sprawdzKonto();
      dopiszDoSkopiowania('ai', 'Wykonane. Wyniki są w schowku – wklej je czatowi AI, żeby wiedział, co się udało (i ewentualnie zrobił resztę).', `Wyniki z Makietki:\n\n${wyniki.join('\n\n')}`);
      return;
    }
    // Polecenie użytkownika: składamy pełne polecenie dla czatu – zasady, narzędzia, stan projektu, zadanie.
    dopisz('ja', tekst);
    const przeglad = await n.wolaj('tools/call', { name: 'przeglad_projektu', arguments: {} }).then((r) => (r?.content || []).map((c) => c.text || '').join('\n')).catch(() => '');
    const polecenie = `${systemDla(n)}

JAK ODPOWIADAĆ: nie masz bezpośredniego dostępu do Makietki – użytkownik przenosi wiadomości. Napisz krótko po polsku, co zrobisz, a potem JEDEN blok kodu z poleceniami:
\`\`\`makietka
[{"narzedzie": "nazwa_narzedzia", "parametry": { … }}]
\`\`\`
Użytkownik wklei go do Makietki; ona wykona polecenia po kolei i odda Ci wyniki. Gdy najpierw musisz coś przeczytać (czytaj, opis_formatu…), wyślij tylko te polecenia i poczekaj na wyniki. Parametry podawaj dokładnie według listy (* – wymagany).

NARZĘDZIA:
${opisNarzedzi(n.lista)}

STAN PROJEKTU (przeglad_projektu):
${przeglad}

ZADANIE UŻYTKOWNIKA:
${tekst}`;
    dopiszDoSkopiowania('ai', 'Polecenie dla czatu jest w schowku. Wklej je w darmowym czacie (np. chatgpt.com, claude.ai, gemini.google.com), a jego odpowiedź z blokiem „makietka” wklej tutaj i wyślij.', polecenie);
  } catch (e) {
    dopisz('blad', e.message);
  } finally {
    trwa = false;
    $('#czat-ai-wyslij').disabled = false;
  }
}

async function wyslij(tekst) {
  if (trwa || !tekst.trim()) return;
  zapamietajPola();
  const u = ustawienia();
  const ust = ustDostawcy(u);
  if (DOSTAWCY[u.dostawca]?.bezKlucza) { await wyslijPrzezSchowek(tekst); return; }
  if (!ust.klucz && stan.uzytkownik) { await otwartySejf(); Object.assign(ust, ustDostawcy(u)); }
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

export async function otworzCzatAi() {
  if (!stan.projekt) return;
  if (stan.uzytkownik) await otwartySejf({ pytaj: maKluczeDoPrzeniesienia() }).catch(() => null);
  pokazUstawienia();
  f.hidden = Boolean(ustDostawcy().klucz) || Boolean(DOSTAWCY[ustawienia().dostawca]?.bezKlucza);
  dlg.classList.toggle('obok-strony', window.matchMedia('(min-width: 901px)').matches);
  if (!dlg.open) dlg.show();
  if (!lista.childElementCount) dopisz('ai', 'Cześć! Napisz, co zrobić w tym projekcie – np. „dodaj stronę z podziękowaniami” albo „popraw literówki na stronie 3”.');
  pole.focus();
}
