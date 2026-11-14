// Jednorazowe przeniesienie plików konta z Supabase Storage do Cloudflare R2 (decyzja #92).
//
// Przy zalogowaniu aplikacja sprawdza stary magazyn (buckety „zasoby” i „podglady”, folder konta): każdy plik
// pobiera, wysyła do R2 pod tą samą ścieżką, sprawdza rozmiar i dopiero wtedy usuwa ze starego magazynu.
// Na tym urządzeniu robi to raz (znacznik w localStorage); na innym urządzeniu – jedno pytanie o pusty folder.
// Pobieranie plików w aplikacji czeka na koniec przeniesienia (chmura.czekajNaPrzeniesienie).
// DO USUNIĘCIA w kolejnej wersji, gdy stary magazyn będzie pusty (razem z regułami Storage w bazie).

import * as chmura from './chmura.js';
import { postep } from './postep.js';

const ZNACZNIK = (uid) => `pliki-r2:${uid}`;

// Wszystkie pliki folderu w starym magazynie (z podfolderami): [{ bucket, klucz }].
async function plikiStare(sb, bucket, folder) {
  const wynik = [];
  for (let od = 0; ; od += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(folder, { limit: 1000, offset: od });
    if (error) throw new Error(error.message || String(error));
    for (const p of data || []) {
      const sciezka = `${folder}/${p.name}`;
      // Folder: bez identyfikatora i opisu pliku.
      if (!p.id && !p.metadata) wynik.push(...await plikiStare(sb, bucket, sciezka));
      else wynik.push({ bucket, klucz: sciezka });
    }
    if ((data || []).length < 1000) return wynik;
  }
}

async function przenies(uid) {
  const sb = await chmura.supabase();
  const pliki = [...await plikiStare(sb, 'zasoby', uid), ...await plikiStare(sb, 'podglady', uid)];
  if (!pliki.length) return 0;
  const karta = postep('Przenoszenie plików do nowego magazynu', { razem: pliki.length });
  const przeniesione = { zasoby: [], podglady: [] };
  try {
    for (const [i, p] of pliki.entries()) {
      const { data: blob, error } = await sb.storage.from(p.bucket).download(p.klucz);
      if (error) throw new Error(error.message || String(error));
      const naRok = p.bucket === 'zasoby' && !p.klucz.includes('/_czcionki/');
      const w = await chmura.r2.wyslij(p.bucket, p.klucz, blob, {
        cache: naRok ? 'private, max-age=31536000, immutable' : (p.klucz.endsWith('.json') ? 'no-cache' : 'public, max-age=3600'),
      });
      if (Number(w?.rozmiar) !== blob.size) throw new Error(`Plik „${p.klucz}” przeniósł się niepełny.`);
      przeniesione[p.bucket].push(p.klucz);
      karta.krok(i + 1);
    }
  } finally {
    // To, co już jest w R2, znika ze starego magazynu nawet wtedy, gdy przeniesienie przerwał błąd.
    for (const [bucket, klucze] of Object.entries(przeniesione)) {
      for (let i = 0; i < klucze.length; i += 100) {
        await sb.storage.from(bucket).remove(klucze.slice(i, i + 100));
      }
    }
    karta.koniec();
  }
  return pliki.length;
}

// Wołane po zalogowaniu. Zwraca obietnicę liczby przeniesionych plików (0 – nic do przeniesienia).
export function przeniesPliki(uzytkownik) {
  if (!uzytkownik?.id) return Promise.resolve(0);
  try { if (localStorage.getItem(ZNACZNIK(uzytkownik.id))) return Promise.resolve(0); } catch { /* bez localStorage – sprawdzamy */ }
  const obietnica = przenies(uzytkownik.id).then((ile) => {
    try { localStorage.setItem(ZNACZNIK(uzytkownik.id), String(Date.now())); } catch { /* następnym razem znów jedno pytanie */ }
    return ile;
  });
  chmura.czekajNaPrzeniesienie(obietnica);
  return obietnica;
}
