// Czat AI w Makietce (#217): rozmowa z wybranym modelem (własny klucz dostawcy, kilku dostawców, wybór modelu),
// który działa na otwartym projekcie tymi samymi narzędziami co łącznik MCP (js/ai-narzedzia-rdzen.js) – u siebie,
// w przeglądarce. Uprawnienia: jednodniowy klucz dostępu AI tylko do tego projektu (czytanie albo zmiany), widoczny
// i do odebrania w Ustawieniach konta → Sztuczna inteligencja. Zmiany AI wracają do edytora jak każda zmiana z konta.
// Klucze dostawców leżą tylko na tym urządzeniu (localStorage); rozmowa idzie prosto do dostawcy.

import { $, powiadom } from '../ui.js';
import * as chmura from '../chmura.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../konfiguracja.js';
import { DOSTAWCY, nowaRozmowa, zapytaj, modelAutomatyczny } from '../ai-dostawcy.js';
import { otwartySejf, sejfKonta, maKluczeDoPrzeniesienia } from './sejf-ai.js';
import { stan } from './kontekst.js';
import { zapiszTeraz, sprawdzKonto, synchronizuj } from './zapis.js';
import { wymagaZgody } from '../zgoda-ai.js';
import { NARZEDZIA_LOKALNE, nazwyLokalne, wykonajLokalne } from './czat-narzedzia-lokalne.js';
import { t as tt, biezacyJezyk } from '../jezyk.js';

const dlg = $('#dlg-czat-ai');
const lista = $('#czat-ai-wiadomosci');
const pole = $('#czat-ai-tekst');
const PAMIEC = 'makietka-czat-ai';
const PAMIEC_KLUCZY = 'makietka-czat-ai-dostep';

let rozmowa = null;
let narzedzia = null; // { serwer, stanSesji, lista, instrukcje, projekt, rola }
let przerwano = false;
let trwa = false;
let zawszePozwalaj = false; // „Zawsze pozwalaj w tej rozmowie” (#255) – do nowej rozmowy

// Zgoda na groźną zmianę (#255): pytanie w rozmowie z przyciskami. Zwraca true – wolno, false – nie.
function zapytajOZgode(opis) {
  if (zawszePozwalaj) return Promise.resolve(true);
  return new Promise((gotowe) => {
    const li = dopisz('zgoda', tt('kod.czatAi.aiChce', { opis }));
    const rzad = Object.assign(document.createElement('div'), { className: 'rzad-przyciskow' });
    const koniec = (wolno, zawsze = false) => {
      if (zawsze) zawszePozwalaj = true;
      rzad.remove();
      li.append(Object.assign(document.createElement('span'), { className: 'zgoda-wynik', textContent: wolno ? (zawsze ? tt('czatAi.pozwolonoDoKoncaRozmowy') : tt('czatAi.pozwolono')) : tt('czatAi.niePozwolono') }));
      gotowe(wolno);
    };
    const przycisk = (tekst, klasa, fn) => { const b = Object.assign(document.createElement('button'), { type: 'button', className: `przycisk maly ${klasa}`, textContent: tekst }); b.addEventListener('click', fn); return b; };
    rzad.append(przycisk(tt('czatAi.pozwol'), 'glowny', () => koniec(true)), przycisk(tt('czatAi.zawszePozwalajWTej'), '', () => koniec(true, true)), przycisk(tt('czatAi.niePozwalaj'), 'niebezpieczny', () => koniec(false)));
    li.append(rzad);
    lista.scrollTop = lista.scrollHeight;
    rzad.querySelector('button').focus();
  });
}
// ---------- Zdjęcia w rozmowie (#260) ----------
// Dołączone zdjęcia: AI widzi je w wiadomości (pomniejszone do 1568 px – tyle i tak biorą modele), a oryginał
// Makietka wgrywa do projektu (okno „Obrazy projektu”), żeby AI mogło go wstawić na stronę.
let zalaczniki = []; // [{ plik, url }]
const MAKS_ZALACZNIK = 5 * 1024 * 1024;
function rysujZalaczniki() {
  const ul = $('#czat-ai-zalaczniki');
  ul.hidden = !zalaczniki.length;
  ul.replaceChildren(...zalaczniki.map((z, i) => {
    const li = document.createElement('li');
    const img = Object.assign(document.createElement('img'), { src: z.url, alt: '' });
    const usun = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk-ikona maly', textContent: '×', title: tt('czatAi.usun') });
    usun.setAttribute('aria-label', tt('czatAi.usun2', { name: z.plik.name }));
    usun.addEventListener('click', () => { URL.revokeObjectURL(z.url); zalaczniki.splice(i, 1); rysujZalaczniki(); });
    li.append(img, Object.assign(document.createElement('span'), { textContent: z.plik.name }), usun);
    return li;
  }));
}
$('#czat-ai-zalacz').addEventListener('click', () => $('#czat-ai-plik').click());
$('#czat-ai-plik').addEventListener('change', (e) => {
  for (const plik of e.target.files) {
    if (plik.size > MAKS_ZALACZNIK) { powiadom(tt('czatAi.maPonad5Mb', { name: plik.name }), true); continue; }
    zalaczniki.push({ plik, url: URL.createObjectURL(plik) });
  }
  e.target.value = '';
  rysujZalaczniki();
});
const base64Pliku = (plik) => new Promise((ok, zle) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, '')); r.onerror = () => zle(r.error); r.readAsDataURL(plik); });
async function podgladDlaAi(z) {
  const img = await new Promise((ok, zle) => { const i = new Image(); i.onload = () => ok(i); i.onerror = zle; i.src = z.url; });
  const skala = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
  if (skala === 1 && z.plik.size < 1.5 * 1024 * 1024 && z.plik.type !== 'image/gif') return { typ: z.plik.type, dane: await base64Pliku(z.plik) };
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * skala), height: Math.round(img.naturalHeight * skala) });
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return { typ: 'image/jpeg', dane: c.toDataURL('image/jpeg', 0.85).replace(/^data:[^,]*,/, '') };
}
// Wgrywa dołączone zdjęcia do projektu; zwraca { opis dla AI, podglady dla modelu }.
async function przygotujZalaczniki(n, { podglad = true } = {}) {
  const linie = [];
  const podglady = [];
  for (const z of zalaczniki) {
    dopisz('narzedzie', `🔧 wgraj_obraz (${z.plik.name})`);
    try {
      const r = await n.wolaj('tools/call', { name: 'wgraj_obraz', arguments: { nazwa: z.plik.name, dane_base64: await base64Pliku(z.plik) } });
      const t = (r?.content || []).map((c) => c.text || '').join(' ').replace(/\s+/g, ' ').slice(0, 300);
      linie.push(r?.isError ? tt('czatAi.nieUdaloSieWgrac', { name: z.plik.name, t }) : tt('czatAi.wgranyDoProjektu', { name: z.plik.name, t }));
    } catch (e) { linie.push(tt('czatAi.nieUdaloSieWgrac2', { name: z.plik.name, message: e.message })); }
    if (podglad) podglady.push(await podgladDlaAi(z).catch(() => null));
    URL.revokeObjectURL(z.url);
  }
  zalaczniki = [];
  rysujZalaczniki();
  return { opis: linie.length ? tt('czatAi.dolaczoneZdjeciaMakietkaWgrala', { join: linie.join('\n') }) : '', podglady: podglady.filter(Boolean) };
}

// Wynik narzędzia, gdy użytkownik nie pozwolił – AI dostaje go jak błąd i ma zapytać, co dalej.
const ODMOWA = 'Użytkownik nie pozwolił na tę zmianę – niczego nie zmieniono. Nie ponawiaj jej; zapytaj, co zrobić zamiast tego.';

const czytaj = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const zapisz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bez pamięci – na tę sesję */ } };
const ustawienia = () => czytaj(PAMIEC, { dostawca: 'anthropic', rola: 'edycja', dostawcy: {} });
// Klucz dostawcy – tylko z sejfu (#241); w pamięci przeglądarki zostają dostawca, model i adres.
const ustDostawcy = (u = ustawienia(), id = u.dostawca) => ({ model: DOSTAWCY[id]?.modele[0] || '', ...(u.dostawcy[id] || {}), klucz: sejfKonta()?.klucz(id) || '' });


function dopisz(rodzaj, tekst) {
  const li = document.createElement('li');
  li.className = rodzaj;
  li.textContent = tekst;
  lista.append(li);
  lista.scrollTop = lista.scrollHeight;
  return li;
}

// ---------- Ustawienia (N1, 23.11) ----------
// Dostawca, model i uprawnienia ustawia się w Ustawieniach konta → Sztuczna inteligencja; czat tylko je pokazuje.

const otworzUstawieniaAi = async () => { dlg.close(); (await import('./dostep-ai.js')).otworzDostepAi(); };
$('#czat-ai-ustawienia').addEventListener('click', otworzUstawieniaAi);

// Krótko nad rozmową: czym rozmawiasz („Claude (Anthropic) · claude-… · czyta i zmienia”).
function pokazKto() {
  const u = ustawienia();
  const d = DOSTAWCY[u.dostawca];
  const ust = ustDostawcy(u);
  const czesci = [d ? (d.bezKlucza ? tt('czatAi.kopiujIWklej') : d.nazwa) : tt('czatAi.brakDostawcy')];
  if (d && !d.bezKlucza) czesci.push(ust.model || tt('czatAi.modelZalecanyKrotko'));
  czesci.push(tt(u.rola === 'odczyt' ? 'czatAi.tylkoCzyta' : 'czatAi.czytaIZmienia'));
  $('#czat-ai-kto').textContent = czesci.join(' · ');
}

// Brak klucza wybranego dostawcy: wiadomość w rozmowie z przyciskiem do ustawień zamiast pól w oknie czatu.
function brakKlucza() {
  const li = dopisz('blad', tt('czatAi.brakKluczaDostawcy'));
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk maly glowny', textContent: tt('czatAi.ustawieniaAi') });
  b.addEventListener('click', otworzUstawieniaAi);
  li.append(' ', b);
}

// OpenRouter: po powrocie z logowania (sessionStorage) – obsługa w ustawieniach konta.
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
  const w = await chmura.utworzDostepAi(projektId, { opis: tt('czatAi.czatWMakietce'), rola, dni: 1 });
  k = { klucz: w.klucz, wazny_do: w.wazny_do || new Date(Date.now() + 864e5).toISOString() };
  kluczeKarty.set(nazwa, k);
  if (s) await s.ustaw(nazwa, JSON.stringify(k)).catch(() => {});
  return w.klucz;
}

// Narzędzia łącznika dla projektu (zadania od AI z kolejki – js/app/zadania-ai.js): klucz czatu z prawem zmian.
export async function wolajDlaProjektu(projektId) {
  const { utworzSerwer } = await import('../ai-narzedzia-rdzen.js');
  const serwer = utworzSerwer({ adres: SUPABASE_URL, kluczPubliczny: SUPABASE_ANON_KEY, klucz: await kluczDostepu(projektId, 'edycja'), projekt: projektId });
  const stanSesji = {};
  let nr = 0;
  const wolaj = async (method, params = {}) => {
    const w = await serwer.obsluz({ jsonrpc: '2.0', id: (nr += 1), method, params }, stanSesji);
    if (w?.error) throw new Error(w.error.message);
    return w?.result;
  };
  await wolaj('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'makietka-zadania', version: '1' } });
  return wolaj;
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
  // generuj_obraz, rysuj_kadry, ustaw_dymki – wersje aplikacji (NARZEDZIA_LOKALNE) zamiast kolejki łącznika.
  const POZA = new Set(['projekty', 'nowy_projekt', 'kopiuj_projekt', 'usun_projekt', ...NARZEDZIA_LOKALNE.map((x) => x.name)]);
  const { tools } = await wolaj('tools/list');
  const lista = tools.filter((t) => !POZA.has(t.name)).map((t) => {
    const { projekt: _p, ...reszta } = t.inputSchema.properties || {};
    return { name: t.name, description: t.description, inputSchema: { ...t.inputSchema, properties: reszta, required: (t.inputSchema.required || []).filter((r) => r !== 'projekt') } };
  });
  // Narzędzia aplikacji (#376): obraz z AI, kadry komiksu, dymki, koszt – tylko gdy AI może zmieniać projekt.
  if (rola === 'edycja') lista.push(...NARZEDZIA_LOKALNE);
  narzedzia = { projekt, rola, lista, instrukcje: init?.instructions || '', wolaj };
  return narzedzia;
}

function systemDla(n) {
  return [
    `Jesteś asystentem w Makietce – edytorze publikacji do druku. Pracujesz na otwartym projekcie „${stan.projekt.nazwa}” (id ${stan.projekt.id}); inne projekty są poza zasięgiem.`,
    n.rola === 'odczyt' ? 'Masz dostęp tylko do czytania: niczego nie zmieniaj, doradzaj i opisuj.' : 'Możesz czytać i zmieniać ten projekt – zmiany widać od razu w edytorze użytkownika.',
    `${({ en: 'Answer in English', uk: 'Відповідай українською' })[biezacyJezyk()] || 'Odpowiadaj po polsku'} (albo w języku, w którym pisze użytkownik), krótko i konkretnie. Przed zmianami zajrzyj do projektu narzędziem przeglad_projektu; zmieniaj małymi krokami i na końcu powiedz, co zrobiłeś.`,
    n.instrukcje,
  ].join('\n\n');
}

// ---------- Rozmowa ----------

// ---------- Kopiuj i wklej (#239): czat bez klucza API ----------

// Wiadomość z przyciskiem „Kopiuj” (schowek z przycisku działa zawsze; samoczynne kopiowanie – gdy przeglądarka pozwoli).
function dopiszDoSkopiowania(rodzaj, opis, tresc) {
  const li = dopisz(rodzaj, opis);
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk maly', textContent: tt('czatAi.kopiuj') });
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(tresc); b.textContent = tt('czatAi.skopiowano'); } catch { powiadom(tt('czatAi.przegladarkaNiePozwolilaSkopiowac'), true); }
  });
  const pre = Object.assign(document.createElement('pre'), { className: 'czat-ai-do-skopiowania', textContent: tresc });
  li.append(b, pre);
  navigator.clipboard?.writeText(tresc).then(() => { b.textContent = tt('czatAi.skopiowano'); }, () => {});
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
  if (!stan.uzytkownik) { powiadom(tt('czatAi.asystentAiDzialaNa'), true); return; }
  trwa = true;
  $('#czat-ai-wyslij').disabled = true;
  pole.value = '';
  dopasujPole();
  try {
    await zapiszTeraz();
    await synchronizuj({ wymus: true }).catch(() => {});
    const n = await przygotujNarzedzia();
    const wywolania = wywolaniaZOdpowiedzi(tekst);
    if (wywolania.length) {
      // Odpowiedź czatu wklejona: wykonujemy jego narzędzia i oddajemy wyniki do skopiowania.
      dopisz('ja', tt('kod.czatAi.wklejona', { n: wywolania.length }));
      const wyniki = [];
      let zmiany = false;
      for (const w of wywolania) {
        dopisz('narzedzie', `🔧 ${w.nazwa}`);
        const opisZgody = wymagaZgody(w.nazwa, w.argumenty);
        if (opisZgody && !await zapytajOZgode(opisZgody)) { wyniki.push(tt('czatAi.blad', { nazwa: w.nazwa, ODMOWA })); continue; }
        try {
          const r = await n.wolaj('tools/call', { name: w.nazwa, arguments: w.argumenty });
          const t = (r?.content || []).map((c) => c.text || '').join('\n') || '(brak treści)';
          wyniki.push(`${r?.isError ? 'BŁĄD' : 'WYNIK'} ${w.nazwa}:\n${t}`);
          if (!r?.isError && !/^(czytaj|przeglad|projekty|obrazy_projektu|komentarze|stan_eksportu|opis_formatu|kontrola)/.test(w.nazwa)) zmiany = true;
        } catch (e) { wyniki.push(tt('czatAi.blad2', { nazwa: w.nazwa, message: e.message })); }
      }
      if (zmiany) sprawdzKonto();
      dopiszDoSkopiowania('ai', 'Wykonane. Wyniki są w schowku – wklej je czatowi AI, żeby wiedział, co się udało (i ewentualnie zrobił resztę).', `Wyniki z Makietki:\n\n${wyniki.join('\n\n')}`);
      return;
    }
    // Polecenie użytkownika: składamy pełne polecenie dla czatu – zasady, narzędzia, stan projektu, zadanie.
    dopisz('ja', tekst);
    // Zdjęcia (#260): czat w przeglądarce ich nie zobaczy, ale są już w projekcie i może je wstawić.
    if (zalaczniki.length) tekst += (await przygotujZalaczniki(n, { podglad: false })).opis;
    const przeglad = await n.wolaj('tools/call', { name: 'przeglad_projektu', arguments: {} }).then((r) => (r?.content || []).map((c) => c.text || '').join('\n')).catch(() => '');
    const polecenie = `${systemDla(n)}

JAK ODPOWIADAĆ: nie masz bezpośredniego dostępu do Makietki – użytkownik przenosi wiadomości. Napisz krótko (w języku użytkownika), co zrobisz, a potem JEDEN blok kodu z poleceniami:
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
  const u = ustawienia();
  const ust = ustDostawcy(u);
  pokazKto();
  if (DOSTAWCY[u.dostawca]?.bezKlucza) { await wyslijPrzezSchowek(tekst); return; }
  // Hasło do kluczy tylko wtedy, gdy klucze są zapisane, a sejf zamknięty; bez kluczy – od razu wskazówka (N1).
  if (!ust.klucz && stan.uzytkownik && await sejfKonta()?.stan().catch(() => null) === 'zamkniety') { await otwartySejf(); Object.assign(ust, ustDostawcy(u)); }
  if (!DOSTAWCY[u.dostawca] || !ust.klucz) { brakKlucza(); return; }
  const wybranyModel = ust.model;
  if (!ust.model) ust.model = await modelAutomatyczny(u.dostawca, ust); // G1: puste pole – zalecany model dostawcy
  if (!ust.model) { brakKlucza(); return; }
  // Zmiana dostawcy albo modelu w ustawieniach – nowa rozmowa (model ma pasować do dostawcy, N2).
  if (rozmowa && (rozmowa.dostawcaCzatu !== u.dostawca || rozmowa.wybrany !== wybranyModel || rozmowa.klucz !== ust.klucz)) { rozmowa = null; zawszePozwalaj = false; }
  if (!stan.uzytkownik) { powiadom(tt('czatAi.asystentAiDzialaNa'), true); return; }
  trwa = true;
  przerwano = false;
  $('#czat-ai-wyslij').disabled = true;
  $('#czat-ai-przerwij').hidden = false;
  dopisz('ja', tekst);
  pole.value = '';
  dopasujPole();
  const czeka = dopisz('narzedzie', tt('czatAi.mysle'));
  try {
    await zapiszTeraz(); // AI ma widzieć to, co teraz na ekranie – także projekt, którego jeszcze nie ma na koncie
    await synchronizuj({ wymus: true }).catch(() => {});
    const n = await przygotujNarzedzia();
    const zal = zalaczniki.length ? await przygotujZalaczniki(n) : { opis: '', podglady: [] };
    if (!rozmowa || rozmowa.projekt !== n.projekt) { rozmowa = { ...nowaRozmowa({ dostawca: u.dostawca, model: ust.model, ust, system: systemDla(n), narzedzia: n.lista }), projekt: n.projekt, wybrany: wybranyModel, dostawcaCzatu: u.dostawca }; zawszePozwalaj = false; }
    let zmiany = false;
    // Streaming (#259): dymek odpowiedzi rośnie na bieżąco; każdy krok AI (przed narzędziami) – osobny dymek.
    let dymek = null;
    let strumien = false;
    const wynik = await zapytaj(rozmowa, tekst + zal.opis, {
      obrazy: zal.podglady,
      przerwij: () => przerwano,
      naTekst: (fragment) => {
        if (!dymek) { czeka.remove(); dymek = dopisz('ai', ''); }
        dymek.textContent += fragment;
        strumien = true;
        lista.scrollTop = lista.scrollHeight;
      },
      naKrok: (k) => {
        if (k.tekst && k.wywolania.length && !dymek) dopisz('ai', k.tekst);
        if (k.wywolania.length) { dymek = null; if (!czeka.isConnected) lista.append(czeka); }
      },
      wykonaj: async (nazwa, argumenty) => {
        czeka.textContent = tt('czatAi.narzedzie', { nazwa });
        dopisz('narzedzie', `🔧 ${nazwa}`);
        const opisZgody = wymagaZgody(nazwa, argumenty);
        if (opisZgody) {
          czeka.textContent = tt('czatAi.czekamNaTwojaZgode');
          if (!await zapytajOZgode(opisZgody)) return { tekst: ODMOWA, blad: true };
        }
        if (nazwyLokalne.has(nazwa)) {
          // Narzędzie w aplikacji (#376) działa na projekcie w edytorze: najpierw zmiany AI z konta (np. ramka dodana
          // przed chwilą przez dodaj_elementy), potem wysyłka tego, co zrobiło – kolejne narzędzia AI je widzą (#380).
          if (zmiany && (nazwa !== 'generuj_obraz' || argumenty?.popraw)) { await sprawdzKonto(); await synchronizuj().catch(() => {}); zmiany = false; }
          try {
            const tekst = await wykonajLokalne(nazwa, argumenty || {}, { wolaj: n.wolaj, informuj: (tekst) => dopisz('narzedzie', tekst) });
            if (tekst === null) return { tekst: ODMOWA, blad: true };
            if (nazwa === 'generuj_obraz') zmiany = true; else { await zapiszTeraz(); await synchronizuj().catch(() => {}); }
            return { tekst, blad: false };
          } catch (er) { return { tekst: er.message, blad: true }; }
        }
        const r = await n.wolaj('tools/call', { name: nazwa, arguments: argumenty });
        if (!/^(czytaj|przeglad|projekty|obrazy_projektu|komentarze|stan_eksportu|opis_formatu|kontrola)/.test(nazwa)) zmiany = true;
        return { tekst: (r?.content || []).map((c) => c.text || '').join('\n') || '(brak treści)', blad: Boolean(r?.isError) };
      },
    });
    czeka.remove();
    if (!dymek || wynik.przerwano) dopisz('ai', wynik.przerwano ? (wynik.tekst && !strumien ? wynik.tekst : 'Przerwano.') : (wynik.tekst || 'Gotowe.'));
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
// Pole pisania rośnie z tekstem (do max-height z CSS) i wraca do jednej linijki po wysłaniu.
const dopasujPole = () => { pole.style.height = 'auto'; pole.style.height = `${pole.scrollHeight}px`; };
pole.addEventListener('input', dopasujPole);
pole.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); wyslij(pole.value); } });
$('#czat-ai-przerwij').addEventListener('click', () => { przerwano = true; });
$('#czat-ai-zamknij').addEventListener('click', () => dlg.close());

// dostawca – od razu ten dostawca (np. 'schowek' – „kopiuj i wklej” z ustawień konta, #254).
export async function otworzCzatAi({ dostawca = null } = {}) {
  if (!stan.projekt) return;
  if (dostawca && DOSTAWCY[dostawca]) { const u = ustawienia(); if (u.dostawca !== dostawca) { u.dostawca = dostawca; zapisz(PAMIEC, u); } }
  if (stan.uzytkownik) await otwartySejf({ pytaj: maKluczeDoPrzeniesienia() }).catch(() => null);
  pokazKto();
  dlg.classList.toggle('obok-strony', window.matchMedia('(min-width: 901px)').matches);
  // Na komputerze panel obok strony (można pracować w edytorze); na telefonie i tablecie – okno na wierzchu wszystkiego
  // (N5: pasek narzędzi, zoom i dolne zakładki edytora nie zasłaniają rozmowy ani pola pisania).
  if (dlg.open && dlg.classList.contains('obok-strony') === dlg.matches(':modal')) dlg.close(); // zmiana szerokości okna – inny tryb
  if (!dlg.open) { if (dlg.classList.contains('obok-strony')) dlg.show(); else dlg.showModal(); }
  if (!lista.childElementCount) dopisz('ai', tt('czatAi.powitanie'));
  pole.focus();
}
