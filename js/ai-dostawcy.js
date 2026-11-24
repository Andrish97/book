// Dostawcy AI dla czatu w aplikacji (#217): własne klucze użytkownika, kilku dostawców, wybór modelu – bez
// przywiązania do jednego. Wywołania idą prosto z przeglądarki do dostawcy (klucz nie przechodzi przez serwery
// Makietki). Trzy rodzaje API: Anthropic (Messages), Google Gemini (generateContent) i API zgodne z OpenAI
// (Chat Completions: OpenAI, DeepSeek, Mistral, xAI, OpenRouter i dowolny zgodny adres). Narzędzia – te same co
// w łączniku MCP (js/ai-narzedzia-rdzen.js); każdy dostawca dostaje je w swoim formacie.
//
// Rozmowa trzyma historię w formacie swojego dostawcy (zmiana dostawcy zaczyna nową rozmowę).
import { t as tt } from './jezyk.js';

export const DOSTAWCY = {
  anthropic: { nazwa: 'Anthropic (Claude)', rodzaj: 'anthropic', adres: 'https://api.anthropic.com/v1', modele: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], kluczUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { nazwa: 'OpenAI (ChatGPT)', rodzaj: 'openai', adres: 'https://api.openai.com/v1', modele: [], kluczUrl: 'https://platform.openai.com/api-keys' },
  gemini: { nazwa: 'Google Gemini', rodzaj: 'gemini', adres: 'https://generativelanguage.googleapis.com/v1beta', modele: [], kluczUrl: 'https://aistudio.google.com/apikey', obrazy: true },
  deepseek: { nazwa: 'DeepSeek', rodzaj: 'openai', adres: 'https://api.deepseek.com/v1', modele: [], kluczUrl: 'https://platform.deepseek.com/api_keys' },
  mistral: { nazwa: 'Mistral', rodzaj: 'openai', adres: 'https://api.mistral.ai/v1', modele: [], kluczUrl: 'https://console.mistral.ai/api-keys' },
  xai: { nazwa: 'xAI (Grok)', rodzaj: 'openai', adres: 'https://api.x.ai/v1', modele: [], kluczUrl: 'https://console.x.ai' },
  openrouter: { nazwa: 'OpenRouter (wiele modeli, logowanie)', rodzaj: 'openai', adres: 'https://openrouter.ai/api/v1', modele: [], kluczUrl: 'https://openrouter.ai/keys', logowanie: true },
  zgodny: { nazwa: 'Inny – API zgodne z OpenAI', rodzaj: 'openai', adres: '', modele: [], wlasnyAdres: true },
  // Bez klucza API (#239): darmowy czat w przeglądarce – polecenie kopiuje się do niego, jego odpowiedź wkleja tutaj.
  schowek: { nazwa: 'Dowolny czat bez klucza – kopiuj i wklej (darmowy ChatGPT, Claude, Gemini…)', rodzaj: 'schowek', adres: '', modele: [], bezKlucza: true },
};

const MAKS = 16000;

// Co umie klucz dostawcy w Makietce (D7): każdy dostawca rozmawia i zmienia projekt narzędziami Makietki; obrazy
// rysuje tylko Gemini (modele obrazów Google).
export const opisMozliwosci = (id) => (DOSTAWCY[id]?.obrazy ? tt('aiDostawcy.tekstIObrazy') : tt('aiDostawcy.tylkoTekst'));
export const nazwaZMozliwosciami = (id) => `${DOSTAWCY[id].nazwa} – ${opisMozliwosci(id)}`;

// Czytelny komunikat błędu dostawcy (#256, plan AI krok 5). status – kod HTTP (0 – brak połączenia), opis – tekst dostawcy.
export function komunikatBleduDostawcy(status, opis = '', wyjatek = null) {
  const o = String(opis || '');
  const szczegoly = o ? ` (dostawca: ${o.slice(0, 200)})` : '';
  if (status === 0) {
    // Zapytanie nie wyszło z przeglądarki (#428): brak internetu, klucz ze znakiem, którego nie da się wysłać
    // w nagłówku (spacja w środku, enter, polska litera – np. po wklejeniu), albo dostawca nie pozwala na zapytania
    // z przeglądarki (CORS). Wcześniej zawsze „sprawdź internet” – także przy złym kluczu.
    const w = String(wyjatek?.message || '');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return tt('aiDostawcy.brakInternetu');
    if (/header|ByteString|ISO-8859|code point|Invalid value/i.test(w)) return tt('aiDostawcy.kluczZNiedozwolonymiZnakami');
    return `${tt('aiDostawcy.brakPolaczeniaZDostawca')}${w ? ` (${w.slice(0, 160)})` : ''}`;
  }
  if (status === 401 || status === 403) return tt('aiDostawcy.dostawcaOdrzucilKluczSprawdz', { szczegoly });
  if (status === 402 || /insufficient|credit|balance|billing|quota|payment/i.test(o)) return tt('aiDostawcy.brakSrodkowAlboWyczerpany', { szczegoly });
  if (status === 429) return tt('aiDostawcy.zaDuzoZapytanNaraz', { szczegoly });
  if (/tool|function.?call/i.test(o) && status === 400) return tt('aiDostawcy.tenModelNieObsluguje', { szczegoly });
  if (status === 404 || (status === 400 && /model/i.test(o))) return tt('aiDostawcy.modelNiedostepnyUDostawcy', { szczegoly });
  if ([500, 502, 503, 504, 529].includes(status) || /overload/i.test(o)) return tt('aiDostawcy.dostawcaJestPrzeciazonyAlbo', { szczegoly });
  return tt('aiDostawcy.dostawcaOdpowiedzialBledem', { status, szczegoly });
}

// Przeciążenie i chwilowe awarie: dwie kolejne próby (po 1,5 s i 4 s; albo tyle, ile każe Retry-After, do 10 s).
const PONOW = [1500, 4000];
const PRZECIAZENIE = new Set([429, 500, 502, 503, 504, 529]);
export const czekanie = { ms: (t) => new Promise((r) => setTimeout(r, t)) };

// Odpowiedź OK (z ponawianiem przy przeciążeniu) albo czytelny błąd.
async function odpowiedz(url, opcje) {
  for (let proba = 0; ; proba += 1) {
    let odp;
    try { odp = await fetch(url, opcje); } catch (e) {
      // Chwilowa przerwa w sieci (telefon zmienia Wi-Fi na komórkową, uśpiona karta) – jeszcze jedna próba (#429).
      if (proba === 0 && !/header|ByteString|ISO-8859|code point|Invalid value/i.test(String(e?.message || ''))) {
        await czekanie.ms(PONOW[0]);
        continue;
      }
      const b = new Error(komunikatBleduDostawcy(0, '', e));
      b.status = 0;
      throw b;
    }
    if (odp.ok) return odp;
    const tekst = await odp.text();
    let dane = null;
    try { dane = tekst ? JSON.parse(tekst) : null; } catch { /* odpowiedź nie-JSON */ }
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

// JSON odpowiedzi dostawcy z ponawianiem i czytelnymi błędami – także dla generowania obrazów (js/ai-obrazy.js, #372).
export async function zadanie(url, opcje) {
  const tekst = await (await odpowiedz(url, opcje)).text();
  try { return tekst ? JSON.parse(tekst) : null; } catch { return null; }
}

// ---------- Streaming (#259): zdarzenia SSE → obiekty JSON ----------
export async function* zdarzeniaSSE(odp) {
  const czytnik = odp.body.getReader();
  const dekoder = new TextDecoder();
  let bufor = '';
  for (;;) {
    const { value, done } = await czytnik.read();
    bufor += done ? dekoder.decode() : dekoder.decode(value, { stream: true });
    const czesci = bufor.split(/\r?\n\r?\n/);
    bufor = done ? '' : czesci.pop();
    for (const c of czesci) {
      const dane = c.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      if (!dane || dane === '[DONE]') continue;
      try { yield JSON.parse(dane); } catch { /* niepełne albo obce zdarzenie */ }
    }
    if (done) return;
  }
}

const naglowkiAnthropic = (klucz) => ({
  'content-type': 'application/json', 'x-api-key': klucz, 'anthropic-version': '2023-06-01',
  // Wywołanie prosto z przeglądarki użytkownika, jego własnym kluczem.
  'anthropic-dangerous-direct-browser-access': 'true',
});
const adresDostawcy = (d, ust) => String((d.wlasnyAdres ? ust.adres : d.adres) || '').replace(/\/+$/, '');

// Lista modeli dostawcy (z jego API) – do wyboru; przy błędzie podpowiedź z listy wbudowanej.
// Klucz bez białych znaków na brzegach i w środku (#428) – wklejony z enterem albo spacją psuł każde zapytanie.
const czystyKlucz = (k) => String(k ?? '').replace(/\s+/g, '');
export async function modeleDostawcy(id, ust0) {
  const ust = ust0 ? { ...ust0, klucz: czystyKlucz(ust0.klucz) } : ust0;
  const d = DOSTAWCY[id];
  if (!d || !ust?.klucz) return d?.modele || [];
  const adres = adresDostawcy(d, ust);
  if (d.rodzaj === 'anthropic') {
    const w = await zadanie(`${adres}/models?limit=100`, { headers: naglowkiAnthropic(ust.klucz) });
    return (w?.data || []).map((m) => m.id);
  }
  if (d.rodzaj === 'gemini') {
    const w = await zadanie(`${adres}/models?pageSize=200&key=${encodeURIComponent(ust.klucz)}`, {});
    // do rozmowy tylko modele tekstowe (modele obrazów, mowy i muzyki rysują albo mówią, ale nie prowadzą rozmowy z narzędziami)
    return (w?.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
      .filter((m) => !/(image|imagen|tts|audio|live|lyria|banana|embedding|aqa)/i.test(m));
  }
  const w = await zadanie(`${adres}/models`, { headers: { authorization: `Bearer ${ust.klucz}` } });
  return (w?.data || []).map((m) => m.id).sort();
}

// Model bez zgadywania nazw (uwaga G1): z listy dostawcy wybieramy zalecany (szybki, rozsądny), najtańszy i najlepszy –
// po wzorcach nazw, najnowsza wersja, bez wersji próbnych i datowanych. Puste pole „Model” = zalecany.
const ZALECENIA = {
  anthropic: { zalecany: [/sonnet/], tani: [/haiku/], najlepszy: [/opus/] },
  gemini: { zalecany: [/flash(?!-lite)/], tani: [/flash-lite/], najlepszy: [/pro/] },
  openai: { zalecany: [/^gpt-[\d.]+-mini$/, /^gpt-.*mini/], tani: [/^gpt-.*nano/, /^gpt-.*mini/], najlepszy: [/^gpt-[\d.]+$/, /^gpt-/] },
  deepseek: { zalecany: [/deepseek-chat/], tani: [/deepseek-chat/], najlepszy: [/reasoner/, /deepseek-chat/] },
  mistral: { zalecany: [/mistral-medium-latest/, /medium/], tani: [/mistral-small-latest/, /small/], najlepszy: [/mistral-large-latest/, /large/] },
  xai: { zalecany: [/grok.*(fast|mini)/, /grok/], tani: [/grok.*(fast|mini)/], najlepszy: [/^grok-[\d.]+$/, /grok/] },
  openrouter: { zalecany: [/^google\/gemini-[\d.]+-flash$/, /gemini.*flash(?!-lite)/], tani: [/gemini.*flash-lite/, /mini/], najlepszy: [/anthropic\/claude.*sonnet/, /claude/] },
};
const wersja = (m) => { const w = String(m).match(/(\d+(?:\.\d+)?)/); return w ? parseFloat(w[1]) : 0; };
const probna = (m) => /preview|exp|latest-|\d{4}-?\d{2}-?\d{2}|\d{3,}$|-\d{2}-\d{2}|thinking|search|vision|audio|realtime|transcribe|codex|instruct/i.test(m) && !/-latest$/.test(m);
function najlepszyWg(modele, wzorce) {
  for (const w of wzorce) {
    const pasujace = modele.filter((m) => w.test(m));
    const stabilne = pasujace.filter((m) => !probna(m));
    const lista = (stabilne.length ? stabilne : pasujace).sort((a, b) => wersja(b) - wersja(a) || a.length - b.length);
    if (lista.length) return lista[0];
  }
  return '';
}
export function zalecaneModele(id, modele = []) {
  const z = ZALECENIA[id];
  if (!z || !modele.length) return { zalecany: DOSTAWCY[id]?.modele?.[0] || modele[0] || '', tani: '', najlepszy: '' };
  return { zalecany: najlepszyWg(modele, z.zalecany) || modele[0], tani: najlepszyWg(modele, z.tani), najlepszy: najlepszyWg(modele, z.najlepszy) };
}
const pamiecModeli = new Map();
export async function modeleZPamieci(id, ust) {
  const k = `${id}|${String(ust?.klucz || '').slice(-6)}|${ust?.adres || ''}`;
  if (!pamiecModeli.has(k)) pamiecModeli.set(k, modeleDostawcy(id, ust).catch((e) => { pamiecModeli.delete(k); throw e; }));
  return pamiecModeli.get(k);
}
// Model do rozmowy: wpisany albo zalecany z listy dostawcy.
export async function modelAutomatyczny(id, ust) {
  if (ust?.model) return ust.model;
  let modele = [];
  try { modele = await modeleZPamieci(id, ust); } catch { /* bez listy – wbudowane */ }
  return zalecaneModele(id, modele).zalecany;
}

// Schemat narzędzia dla Gemini: tylko pola, które Gemini przyjmuje.
export function schematGemini(s) {
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
  // Gemini przyjmuje „enum” tylko przy tekście: lista liczb (np. dpi 150/300/600) idzie do opisu – bez niej Gemini
  // odrzucał wszystkie narzędzia naraz („Invalid value at …enum[0] (TYPE_STRING)”; test czatu na żywo, #380).
  // …i bez pustego tekstu na liście („enum[0]: cannot be empty” – np. pdfx: '' = bez PDF/X)
  if (wynik.enum?.includes('')) { wynik.enum = wynik.enum.filter((x) => x !== ''); wynik.description = `${wynik.description ? `${wynik.description} ` : ''}(puste = brak)`; if (!wynik.enum.length) delete wynik.enum; }
  if (wynik.enum && (wynik.type !== 'string' || wynik.enum.some((x) => typeof x !== 'string'))) {
    wynik.description = `${wynik.description ? `${wynik.description} ` : ''}(${wynik.enum.join(' | ')})`;
    delete wynik.enum;
  }
  return wynik;
}

// Nowa rozmowa: { dostawca, model, ust, system, narzedzia: [{ name, description, inputSchema }] }.
export function nowaRozmowa({ dostawca, model, ust, system, narzedzia }) {
  const d = DOSTAWCY[dostawca];
  if (!d) throw new Error('Nieznany dostawca.');
  return { dostawca, rodzaj: d.rodzaj, adres: adresDostawcy(d, ust), klucz: czystyKlucz(ust.klucz), model, system, narzedzia, historia: [] };
}

// Jeden krok: wysyła historię, zwraca { tekst, wywolania: [{ id, nazwa, argumenty }] } i dopisuje odpowiedź do historii.
// Krok ze streamingiem: tekst trafia do naTekst(fragment) na bieżąco; wynik jak w kroku bez streamingu.
async function krokStrumien(r, naTekst) {
  if (r.rodzaj === 'anthropic') {
    const odp = await odpowiedz(`${r.adres}/messages`, {
      method: 'POST', headers: naglowkiAnthropic(r.klucz),
      body: JSON.stringify({
        model: r.model, max_tokens: MAKS, system: r.system, messages: r.historia, stream: true,
        tools: r.narzedzia.map((n) => ({ name: n.name, description: n.description, input_schema: n.inputSchema })),
      }),
    });
    const bloki = [];
    const json = [];
    let stop = '';
    for await (const z of zdarzeniaSSE(odp)) {
      if (z.type === 'error') throw new Error(komunikatBleduDostawcy(/overload/i.test(z.error?.type || '') ? 529 : 500, z.error?.message));
      if (z.type === 'content_block_start') { bloki[z.index] = { ...z.content_block }; if (z.content_block.type === 'tool_use') json[z.index] = ''; }
      if (z.type === 'content_block_delta') {
        const b = bloki[z.index];
        const d = z.delta || {};
        if (d.type === 'text_delta') { b.text = (b.text || '') + d.text; naTekst(d.text); }
        if (d.type === 'input_json_delta') json[z.index] += d.partial_json;
        if (d.type === 'thinking_delta') b.thinking = (b.thinking || '') + d.thinking;
        if (d.type === 'signature_delta') b.signature = (b.signature || '') + d.signature;
      }
      if (z.type === 'content_block_stop' && bloki[z.index]?.type === 'tool_use') {
        try { bloki[z.index].input = json[z.index] ? JSON.parse(json[z.index]) : {}; } catch { bloki[z.index].input = {}; }
      }
      if (z.type === 'message_delta' && z.delta?.stop_reason) stop = z.delta.stop_reason;
    }
    if (stop === 'refusal') throw new Error('Model odmówił odpowiedzi na tę prośbę.');
    const content = bloki.filter(Boolean);
    r.historia.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: '…' }] });
    return {
      tekst: content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
      wywolania: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, nazwa: b.name, argumenty: b.input || {} })),
    };
  }
  if (r.rodzaj === 'gemini') {
    const odp = await odpowiedz(`${r.adres}/models/${encodeURIComponent(r.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(r.klucz)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: r.system }] }, contents: r.historia,
        tools: [{ functionDeclarations: r.narzedzia.map((n) => ({ name: n.name, description: n.description, parameters: schematGemini(n.inputSchema) })) }],
      }),
    });
    const czesci = [];
    for await (const z of zdarzeniaSSE(odp)) {
      for (const p of z?.candidates?.[0]?.content?.parts || []) {
        if (p.text && czesci.at(-1)?.text !== undefined && !p.thought) { czesci.at(-1).text += p.text; naTekst(p.text); }
        else { czesci.push({ ...p }); if (p.text && !p.thought) naTekst(p.text); }
      }
    }
    r.historia.push({ role: 'model', parts: czesci.length ? czesci : [{ text: '…' }] });
    return {
      tekst: czesci.filter((p) => p.text && !p.thought).map((p) => p.text).join('\n'),
      wywolania: czesci.filter((p) => p.functionCall).map((p, i) => ({ id: `g${i}`, nazwa: p.functionCall.name, argumenty: p.functionCall.args || {} })),
    };
  }
  const odp = await odpowiedz(`${r.adres}/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${r.klucz}` },
    body: JSON.stringify({
      model: r.model, messages: [{ role: 'system', content: r.system }, ...r.historia], stream: true,
      tools: r.narzedzia.map((n) => ({ type: 'function', function: { name: n.name, description: n.description, parameters: n.inputSchema } })),
    }),
  });
  let tekst = '';
  const wolania = [];
  for await (const z of zdarzeniaSSE(odp)) {
    if (z.error) throw new Error(komunikatBleduDostawcy(z.error.code === 429 ? 429 : 500, z.error.message));
    const d = z?.choices?.[0]?.delta || {};
    if (typeof d.content === 'string' && d.content) { tekst += d.content; naTekst(d.content); }
    for (const t of d.tool_calls || []) {
      const w = wolania[t.index ?? wolania.length] ||= { id: '', type: 'function', function: { name: '', arguments: '' } };
      if (t.id) w.id = t.id;
      if (t.function?.name) w.function.name += t.function.name;
      if (t.function?.arguments) w.function.arguments += t.function.arguments;
    }
  }
  const tool = wolania.filter(Boolean);
  r.historia.push({ role: 'assistant', content: tekst, ...(tool.length ? { tool_calls: tool } : {}) });
  return {
    tekst,
    wywolania: tool.map((t) => {
      let argumenty = {};
      try { argumenty = t.function.arguments ? JSON.parse(t.function.arguments) : {}; } catch { argumenty = {}; }
      return { id: t.id, nazwa: t.function.name, argumenty };
    }),
  };
}

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
    r.historia.push({ role: 'assistant', content: w.content?.length ? w.content : [{ type: 'text', text: '…' }] });
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
    r.historia.push({ role: 'model', parts: tresc.parts?.length ? tresc.parts : [{ text: '…' }] });
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
// naTekst(fragment) – gdy podane, odpowiedź przychodzi strumieniem (#259) i tekst pojawia się na bieżąco.
// obrazy – [{ typ: 'image/jpeg', dane: base64 }] dołączone do wiadomości (#260): model je widzi.
export function wiadomoscUzytkownika(rodzaj, tekst, obrazy = []) {
  if (rodzaj === 'gemini') return { role: 'user', parts: [...obrazy.map((o) => ({ inline_data: { mime_type: o.typ, data: o.dane } })), { text: tekst }] };
  if (!obrazy.length) return { role: 'user', content: tekst };
  if (rodzaj === 'anthropic') return { role: 'user', content: [...obrazy.map((o) => ({ type: 'image', source: { type: 'base64', media_type: o.typ, data: o.dane } })), { type: 'text', text: tekst }] };
  return { role: 'user', content: [{ type: 'text', text: tekst }, ...obrazy.map((o) => ({ type: 'image_url', image_url: { url: `data:${o.typ};base64,${o.dane}` } }))] };
}

// Rozmowa nie rośnie bez końca (#429): wyniki narzędzi (np. cały odczyt projektu) i obrazy zostają w historii
// i każde kolejne pytanie wysyłało je znowu – po kilkunastu wiadomościach zapytanie miało megabajty i dostawca
// zrywał połączenie („brak połączenia”). Powyżej LIMIT_HISTORII starsze wyniki narzędzi są skracane, starsze obrazy
// pomijane, a gdy to nie wystarczy – najstarsze wymiany znikają (historia zaczyna się zawsze od zwykłej wiadomości).
export const LIMIT_HISTORII = 400 * 1024;
const SKROT = 1500;
const skrocone = (t) => (typeof t === 'string' && t.length > SKROT ? `${t.slice(0, SKROT)}… (skrócone – wywołaj narzędzie jeszcze raz, jeśli potrzebujesz całości)` : t);
const zwyklaWiadomosc = (rodzaj, m) => {
  if (m.role !== 'user') return false;
  if (rodzaj === 'gemini') return (m.parts || []).every((p) => !p.functionResponse);
  if (rodzaj === 'anthropic') return typeof m.content === 'string' || !m.content.some((c) => c.type === 'tool_result');
  return true;
};
function odchudzWiadomosc(rodzaj, m) {
  if (rodzaj === 'gemini') {
    m.parts = (m.parts || []).map((p) => {
      if (p.inline_data) return { text: '(obraz pominięty)' };
      if (p.functionResponse?.response?.wynik) return { functionResponse: { ...p.functionResponse, response: { ...p.functionResponse.response, wynik: skrocone(p.functionResponse.response.wynik) } } };
      return p;
    });
  } else if (rodzaj === 'anthropic') {
    if (Array.isArray(m.content)) {
      m.content = m.content.map((c) => {
        if (c.type === 'image') return { type: 'text', text: '(obraz pominięty)' };
        if (c.type === 'tool_result') return { ...c, content: skrocone(c.content) };
        return c;
      });
    }
  } else if (m.role === 'tool') m.content = skrocone(m.content);
  else if (Array.isArray(m.content)) m.content = m.content.map((c) => (c.type === 'image_url' ? { type: 'text', text: '(obraz pominięty)' } : c));
}
export function przytnijHistorie(r, limit = LIMIT_HISTORII) {
  const rozmiar = () => JSON.stringify(r.historia).length;
  if (rozmiar() <= limit) return;
  // Od końca szukamy ostatniej zwykłej wiadomości – ona i to, co po niej (bieżące pytanie), zostaje w całości.
  let biezace = r.historia.length - 1;
  while (biezace > 0 && !zwyklaWiadomosc(r.rodzaj, r.historia[biezace])) biezace -= 1;
  for (let i = 0; i < biezace; i += 1) odchudzWiadomosc(r.rodzaj, r.historia[i]);
  while (rozmiar() > limit) {
    let nast = 1;
    while (nast < biezace && !zwyklaWiadomosc(r.rodzaj, r.historia[nast])) nast += 1;
    if (nast >= biezace) break;
    r.historia.splice(0, nast);
    biezace -= nast;
  }
}

export async function zapytaj(r, tekst, { wykonaj, naKrok = () => {}, naTekst = null, obrazy = [], maksKrokow = 25, przerwij = () => false } = {}) {
  const poczatek = r.historia.length;
  r.historia.push(wiadomoscUzytkownika(r.rodzaj, tekst, obrazy));
  try {
    return await petla(r, { wykonaj, naKrok, naTekst, maksKrokow, przerwij });
  } catch (e) {
    // Nieudane pytanie nie zostaje w rozmowie (#429): wcześniej w historii zostawało pytanie bez odpowiedzi
    // (albo wywołanie narzędzia bez wyniku) i każde następne pytanie dostawca odrzucał – czat „przestawał działać”
    // aż do zamknięcia. Teraz rozmowa wraca do stanu sprzed pytania i można spróbować jeszcze raz.
    if (r.historia.length >= poczatek) r.historia.length = poczatek;
    throw e;
  }
}

async function petla(r, { wykonaj, naKrok, naTekst, maksKrokow, przerwij }) {
  let ostatni = '';
  for (let i = 0; i < maksKrokow; i += 1) {
    if (przerwij()) return { tekst: ostatni, przerwano: true };
    przytnijHistorie(r);
    const k = naTekst ? await krokStrumien(r, naTekst) : await krok(r);
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
