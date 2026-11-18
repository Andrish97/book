// Sejf kluczy AI (#241): klucze API dostawców (i jednodniowe klucze czatu) szyfrowane w przeglądarce hasłem do
// kluczy, które zna tylko użytkownik, i dopiero wtedy zapisywane na koncie. Z hasła PBKDF2-SHA256 (310 000
// powtórzeń, losowa sól konta) powstaje klucz AES-GCM 256, którego nie da się wyjąć z przeglądarki
// (extractable: false); urządzenie pamięta go w IndexedDB, więc hasło podaje się raz na urządzeniu. Baza ma tylko
// szyfrogram – bez hasła nie odczyta go nikt, także twórca Makietki. Zgubione hasło = klucze trzeba wkleić od nowa.

const POWTORZENIA = 310000;
const KONTROLA = 'makietka-sejf-kluczy-v1';
const BAZA = 'makietka-sejf';

const b64 = (bajty) => btoa(String.fromCharCode(...new Uint8Array(bajty)));
const zB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function kluczZHasla(haslo, solB64) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(haslo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: zB64(solB64), iterations: POWTORZENIA, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function zaszyfruj(klucz, tekst) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const szyfr = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, klucz, new TextEncoder().encode(tekst));
  return { iv: b64(iv), szyfr: b64(szyfr) };
}
export async function odszyfruj(klucz, { iv, szyfr }) {
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: zB64(iv) }, klucz, zB64(szyfr)));
}

// ---------- Pamięć urządzenia (CryptoKey bez możliwości wyjęcia) ----------

const otworz = () => new Promise((ok, zle) => {
  const r = indexedDB.open(BAZA, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('klucze');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => zle(r.error);
});
async function pamiec(tryb, fn) {
  const db = await otworz();
  return new Promise((ok, zle) => { const tx = db.transaction('klucze', tryb); const w = fn(tx.objectStore('klucze')); tx.oncomplete = () => ok(w?.result); tx.onerror = () => zle(tx.error); });
}
const zapamietaj = (konto, klucz) => pamiec('readwrite', (s) => s.put(klucz, konto)).catch(() => {});
const zUrzadzenia = (konto) => pamiec('readonly', (s) => s.get(konto)).catch(() => null);
const zapomnij = (konto) => pamiec('readwrite', (s) => s.delete(konto)).catch(() => {});

// ---------- Sejf ----------

// chmura: { sejfAiPobierz, sejfAiZapisz, sejfAiUsun } (js/chmura.js; w testach atrapa). konto – id użytkownika.
export function utworzSejf(chmura, konto) {
  let wiersz;
  let klucz = null;
  let jawne = null; // odszyfrowane klucze – tylko w pamięci tej karty
  const wczytaj = async () => { if (wiersz === undefined) wiersz = await chmura.sejfAiPobierz(); return wiersz; };
  const sejf = {
    // 'brak' – sejf jeszcze nie założony; 'zamkniety' – trzeba podać hasło na tym urządzeniu; 'otwarty'.
    async stan() {
      if (jawne) return 'otwarty';
      const w = await wczytaj();
      if (!w) return 'brak';
      const k = await zUrzadzenia(konto);
      if (k) { try { await odszyfruj(k, w.kontrolny); klucz = k; await sejf.odczytaj(); return 'otwarty'; } catch { await zapomnij(konto); } }
      return 'zamkniety';
    },
    async zaloz(haslo) {
      if (String(haslo).length < 8) throw new Error('Hasło do kluczy musi mieć co najmniej 8 znaków.');
      const sol = b64(crypto.getRandomValues(new Uint8Array(16)));
      klucz = await kluczZHasla(haslo, sol);
      wiersz = { sol, kontrolny: await zaszyfruj(klucz, KONTROLA), klucze: {} };
      await chmura.sejfAiZapisz(wiersz);
      jawne = {};
      await zapamietaj(konto, klucz);
    },
    async otworz(haslo) {
      const w = await wczytaj();
      if (!w) throw new Error('Sejf kluczy nie jest jeszcze założony.');
      const k = await kluczZHasla(haslo, w.sol);
      try { if (await odszyfruj(k, w.kontrolny) !== KONTROLA) throw new Error(); } catch { throw new Error('Nieprawidłowe hasło do kluczy.'); }
      klucz = k;
      await sejf.odczytaj();
      await zapamietaj(konto, klucz);
    },
    async odczytaj() {
      const w = await wczytaj();
      jawne = {};
      for (const [nazwa, s] of Object.entries(w?.klucze || {})) { try { jawne[nazwa] = await odszyfruj(klucz, s); } catch { /* uszkodzony wpis – pomijamy */ } }
      return jawne;
    },
    klucz: (nazwa) => jawne?.[nazwa] || '',
    async ustaw(nazwa, wartosc) {
      if (!klucz) throw new Error('Sejf kluczy jest zamknięty.');
      const w = await wczytaj();
      const klucze = { ...(w.klucze || {}) };
      if (wartosc) klucze[nazwa] = await zaszyfruj(klucz, wartosc); else delete klucze[nazwa];
      wiersz = { ...w, klucze };
      await chmura.sejfAiZapisz(wiersz);
      jawne = { ...jawne, [nazwa]: wartosc || undefined };
      if (!wartosc) delete jawne[nazwa];
    },
    // Zamyka sejf na tym urządzeniu (następnym razem trzeba podać hasło).
    async zamknij() { jawne = null; klucz = null; await zapomnij(konto); },
    // Usuwa sejf z konta (np. zapomniane hasło) – klucze trzeba wkleić od nowa.
    async usun() { await chmura.sejfAiUsun(); wiersz = null; jawne = null; klucz = null; await zapomnij(konto); },
  };
  return sejf;
}
