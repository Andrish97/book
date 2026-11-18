// Dostawcy AI dla czatu w aplikacji (#217): własne klucze użytkownika, kilku dostawców, wybór modelu – bez
// przywiązania do jednego. Wywołania idą prosto z przeglądarki do dostawcy (klucz nie przechodzi przez serwery
// Makietki). Trzy rodzaje API: Anthropic (Messages), Google Gemini (generateContent) i API zgodne z OpenAI
// (Chat Completions: OpenAI, DeepSeek, Mistral, xAI, OpenRouter i dowolny zgodny adres). Narzędzia – te same co
// w łączniku MCP (js/ai-narzedzia-rdzen.js); każdy dostawca dostaje je w swoim formacie.
//
// Rozmowa trzyma historię w formacie swojego dostawcy (zmiana dostawcy zaczyna nową rozmowę).

export const DOSTAWCY = {
  anthropic: { nazwa: 'Anthropic (Claude)', rodzaj: 'anthropic', adres: 'https://api.anthropic.com/v1', modele: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], kluczUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { nazwa: 'OpenAI (ChatGPT)', rodzaj: 'openai', adres: 'https://api.openai.com/v1', modele: [], kluczUrl: 'https://platform.openai.com/api-keys' },
  gemini: { nazwa: 'Google Gemini', rodzaj: 'gemini', adres: 'https://generativelanguage.googleapis.com/v1beta', modele: [], kluczUrl: 'https://aistudio.google.com/apikey' },
  deepseek: { nazwa: 'DeepSeek', rodzaj: 'openai', adres: 'https://api.deepseek.com/v1', modele: [], kluczUrl: 'https://platform.deepseek.com/api_keys' },
  mistral: { nazwa: 'Mistral', rodzaj: 'openai', adres: 'https://api.mistral.ai/v1', modele: [], kluczUrl: 'https://console.mistral.ai/api-keys' },
  xai: { nazwa: 'xAI (Grok)', rodzaj: 'openai', adres: 'https://api.x.ai/v1', modele: [], kluczUrl: 'https://console.x.ai' },
  openrouter: { nazwa: 'OpenRouter (wiele modeli, logowanie)', rodzaj: 'openai', adres: 'https://openrouter.ai/api/v1', modele: [], kluczUrl: 'https://openrouter.ai/keys', logowanie: true },
  zgodny: { nazwa: 'Inny – API zgodne z OpenAI', rodzaj: 'openai', adres: '', modele: [], wlasnyAdres: true },
  // Bez klucza API (#239): darmowy czat w przeglądarce – polecenie kopiuje się do niego, jego odpowiedź wkleja tutaj.
  schowek: { nazwa: 'Dowolny czat bez klucza – kopiuj i wklej (darmowy ChatGPT, Claude, Gemini…)', rodzaj: 'schowek', adres: '', modele: [], bezKlucza: true },
};

const MAKS = 16000;

// Czytelny komunikat błędu dostawcy (#256, plan AI krok 5). status – kod HTTP (0 – brak połączenia), opis – tekst dostawcy.
export function komunikatBleduDostawcy(status, opis = '') {
  const o = String(opis || '');
  const szczegoly = o ? ` (dostawca: ${o.slice(0, 200)})` : '';
  if (status === 0) return 'Brak połączenia z dostawcą – sprawdź internet. Przy własnym adresie (np. Ollama) serwer musi pozwalać na zapytania z przeglądarki (CORS).';
  if (status === 401 || status === 403) return `Dostawca odrzucił klucz – sprawdź, czy klucz jest poprawny i aktywny (Ustawienia konta → Sztuczna inteligencja → Edytuj).${szczegoly}`;
  if (status === 402 || /insufficient|credit|balance|billing|quota|payment/i.test(o)) return `Brak środków albo wyczerpany limit na koncie dostawcy – doładuj konto u dostawcy.${szczegoly}`;
  if (status === 429) return `Za dużo zapytań naraz – odczekaj chwilę i spróbuj ponownie.${szczegoly}`;
  if (/tool|function.?call/i.test(o) && status === 400) return `Ten model nie obsługuje narzędzi – wybierz inny model.${szczegoly}`;
  if (status === 404 || (status === 400 && /model/i.test(o))) return `Model niedostępny u dostawcy albo zła nazwa modelu – wybierz inny model.${szczegoly}`;
  if ([500, 502, 503, 504, 529].includes(status) || /overload/i.test(o)) return `Dostawca jest przeciążony albo ma awarię – spróbuj za chwilę.${szczegoly}`;
  return `Dostawca odpowiedział błędem ${status}.${szczegoly}`;
}

// Przeciążenie i chwilowe awarie: dwie kolejne próby (po 1,5 s i 4 s; albo tyle, ile każe Retry-After, do 10 s).
const PONOW = [1500, 4000];
const PRZECIAZENIE = new Set([429, 500, 502, 503, 504, 529]);
export const czekanie = { ms: (t) => new Promise((r) => setTimeout(r, t)) };

async function zadanie(url, opcje) {
  for (let proba = 0; ; proba += 1) {
    let odp;
    try { odp = await fetch(url, opcje); } catch {
      const b = new Error(komunikatBleduDostawcy(0));
      b.status = 0;
      throw b;
    }
    const tekst = await odp.text();
    let dane = null;
    try { dane = tekst ? JSON.parse(tekst) : null; } catch { /* odpowiedź nie-JSON */ }
    if (odp.ok) return dane;
    const opis = dane?.error?.message || dane?.message || tekst.slice(0, 300) || odp.statusText;
    const brakSrodkow = odp.status === 402 || /insufficient|credit|balance|billing|quota/i.test(opis);
    if (PRZECIAZENIE.has(odp.status) && !brakSrodkow && proba < PONOW.length) {
      const poSek = Number(odp.headers?.get?.('retry-after'));
      await czekanie.ms(Number.isFinite(poSek) && poSek > 0 ? Math.min(poSek * 1000, 10000) : PONOW[proba]);
      continue;
    }
    const blad = new Error(komunikatBleduDostawcy(odp.status, opis));
    blad.status = odp.status;
    throw blad;
  }
}

const naglowkiAnthropic = (klucz) => ({
  'content-type': 'application/json', 'x-api-key': klucz, 'anthropic-version': '2023-06-01',
  // Wywołanie prosto z przeglądarki użytkownika, jego własnym kluczem.
  'anthropic-dangerous-direct-browser-access': 'true',
});
const adresDostawcy = (d, ust) => String((d.wlasnyAdres ? ust.adres : d.adres) || '').replace(/\/+$/, '');

// Lista modeli dostawcy (z jego API) – do wyboru; przy błędzie podpowiedź z listy wbudowanej.
export async function modeleDostawcy(id, ust) {
  const d = DOSTAWCY[id];
  if (!d || !ust?.klucz) return d?.modele || [];
  const adres = adresDostawcy(d, ust);
  if (d.rodzaj === 'anthropic') {
    const w = await zadanie(`${adres}/models?limit=100`, { headers: naglowkiAnthropic(ust.klucz) });
    return (w?.data || []).map((m) => m.id);
  }
  if (d.rodzaj === 'gemini') {
    const w = await zadanie(`${adres}/models?pageSize=200&key=${encodeURIComponent(ust.klucz)}`, {});
    return (w?.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  }
  const w = await zadanie(`${adres}/models`, { headers: { authorization: `Bearer ${ust.klucz}` } });
  return (w?.data || []).map((m) => m.id).sort();
}

// Schemat narzędzia dla Gemini: tylko pola, które Gemini przyjmuje.
function schematGemini(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s)) return s.map(schematGemini);
  const wynik = {};
  for (const [k, v] of Object.entries(s)) {
    if (['type', 'description', 'enum', 'required', 'nullable', 'format'].includes(k)) wynik[k] = v;
    else if (k === 'properties') wynik.properties = Object.fromEntries(Object.entries(v || {}).map(([n, x]) => [n, schematGemini(x)]));
    else if (k === 'items') wynik.items = schematGemini(v);
  }
  if (Array.isArray(wynik.type)) wynik.type = wynik.type.find((t) => t !== 'null') || 'string';
  if (wynik.format && !['enum', 'date-time'].includes(wynik.format)) delete wynik.format;
  if (wynik.type === 'object' && !wynik.properties) wynik.properties = {};
  return wynik;
}

// Nowa rozmowa: { dostawca, model, ust, system, narzedzia: [{ name, description, inputSchema }] }.
export function nowaRozmowa({ dostawca, model, ust, system, narzedzia }) {
  const d = DOSTAWCY[dostawca];
  if (!d) throw new Error('Nieznany dostawca.');
  return { dostawca, rodzaj: d.rodzaj, adres: adresDostawcy(d, ust), klucz: ust.klucz, model, system, narzedzia, historia: [] };
}

// Jeden krok: wysyła historię, zwraca { tekst, wywolania: [{ id, nazwa, argumenty }] } i dopisuje odpowiedź do historii.
async function krok(r) {
  if (r.rodzaj === 'anthropic') {
    const w = await zadanie(`${r.adres}/messages`, {
      method: 'POST', headers: naglowkiAnthropic(r.klucz),
      body: JSON.stringify({
        model: r.model, max_tokens: MAKS, system: r.system, messages: r.historia,
        tools: r.narzedzia.map((n) => ({ name: n.name, description: n.description, input_schema: n.inputSchema })),
      }),
    });
    if (w.stop_reason === 'refusal') throw new Error('Model odmówił odpowiedzi na tę prośbę.');
    // Cała treść odpowiedzi wraca do historii (także bloki myślenia – model ich potrzebuje w kolejnym kroku).
    r.historia.push({ role: 'assistant', content: w.content });
    return {
      tekst: w.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
      wywolania: w.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, nazwa: b.name, argumenty: b.input || {} })),
    };
  }
  if (r.rodzaj === 'gemini') {
    const w = await zadanie(`${r.adres}/models/${encodeURIComponent(r.model)}:generateContent?key=${encodeURIComponent(r.klucz)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: r.system }] }, contents: r.historia,
        tools: [{ functionDeclarations: r.narzedzia.map((n) => ({ name: n.name, description: n.description, parameters: schematGemini(n.inputSchema) })) }],
      }),
    });
    const tresc = w?.candidates?.[0]?.content || { role: 'model', parts: [] };
    r.historia.push({ role: 'model', parts: tresc.parts || [] });
    const czesci = tresc.parts || [];
    return {
      tekst: czesci.filter((p) => p.text).map((p) => p.text).join('\n'),
      wywolania: czesci.filter((p) => p.functionCall).map((p, i) => ({ id: `g${i}`, nazwa: p.functionCall.name, argumenty: p.functionCall.args || {} })),
    };
  }
  const w = await zadanie(`${r.adres}/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${r.klucz}` },
    body: JSON.stringify({
      model: r.model, messages: [{ role: 'system', content: r.system }, ...r.historia],
      tools: r.narzedzia.map((n) => ({ type: 'function', function: { name: n.name, description: n.description, parameters: n.inputSchema } })),
    }),
  });
  const m = w?.choices?.[0]?.message || { role: 'assistant', content: '' };
  r.historia.push({ role: 'assistant', content: m.content ?? '', ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) });
  return {
    tekst: typeof m.content === 'string' ? m.content : '',
    wywolania: (m.tool_calls || []).map((t) => {
      let argumenty = {};
      try { argumenty = t.function?.arguments ? JSON.parse(t.function.arguments) : {}; } catch { argumenty = {}; }
      return { id: t.id, nazwa: t.function?.name, argumenty };
    }),
  };
}

// Wyniki narzędzi do historii – wszystkie razem, w formacie dostawcy.
function dopiszWyniki(r, wyniki) {
  if (r.rodzaj === 'anthropic') {
    r.historia.push({ role: 'user', content: wyniki.map((w) => ({ type: 'tool_result', tool_use_id: w.id, content: w.tekst, ...(w.blad ? { is_error: true } : {}) })) });
  } else if (r.rodzaj === 'gemini') {
    r.historia.push({ role: 'user', parts: wyniki.map((w) => ({ functionResponse: { name: w.nazwa, response: { wynik: w.tekst, ...(w.blad ? { blad: true } : {}) } } })) });
  } else {
    for (const w of wyniki) r.historia.push({ role: 'tool', tool_call_id: w.id, content: w.tekst });
  }
}

// Wiadomość użytkownika i cała pętla narzędzi aż do odpowiedzi. wykonaj(nazwa, argumenty) → { tekst, blad? }.
// naKrok({ tekst, wywolania }) – postęp do pokazania w czacie. Najwyżej maksKrokow wywołań modelu.
export async function zapytaj(r, tekst, { wykonaj, naKrok = () => {}, maksKrokow = 25, przerwij = () => false } = {}) {
  if (r.rodzaj === 'gemini') r.historia.push({ role: 'user', parts: [{ text: tekst }] });
  else r.historia.push({ role: 'user', content: tekst });
  let ostatni = '';
  for (let i = 0; i < maksKrokow; i += 1) {
    if (przerwij()) return { tekst: ostatni, przerwano: true };
    const k = await krok(r);
    naKrok(k);
    if (k.tekst) ostatni = k.tekst;
    if (!k.wywolania.length) return { tekst: ostatni };
    const wyniki = [];
    for (const w of k.wywolania) {
      let wynik;
      try { wynik = await wykonaj(w.nazwa, w.argumenty); } catch (e) { wynik = { tekst: `Błąd: ${e.message}`, blad: true }; }
      wyniki.push({ id: w.id, nazwa: w.nazwa, ...wynik });
    }
    dopiszWyniki(r, wyniki);
  }
  return { tekst: ostatni || 'Przerwano po wielu krokach – napisz, co dalej.', przerwano: true };
}

// ---------- OpenRouter: logowanie zamiast wklejania klucza (OAuth PKCE) ----------

const base64url = (bajty) => btoa(String.fromCharCode(...new Uint8Array(bajty))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function adresLogowaniaOpenRouter(powrot) {
  const weryfikator = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const wyzwanie = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(weryfikator)));
  return { weryfikator, adres: `https://openrouter.ai/auth?callback_url=${encodeURIComponent(powrot)}&code_challenge=${wyzwanie}&code_challenge_method=S256` };
}
export async function kluczZKoduOpenRouter(kod, weryfikator) {
  const w = await zadanie('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: kod, code_verifier: weryfikator, code_challenge_method: 'S256' }),
  });
  if (!w?.key) throw new Error('OpenRouter nie wydał klucza.');
  return w.key;
}
