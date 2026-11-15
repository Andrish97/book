// Komentarze na stronach – rozmowa z bazą (migracja 20261116200000_komentarze.sql, decyzja #131D).
// Komentarze leżą w osobnej tabeli, nie w projekcie: nie zmieniają wersji projektu i nie kolidują z zapisem.
// Zmiany przychodzą na żywo (Supabase Realtime, RLS – tylko osoby z dostępem do projektu).

import { supabase } from './chmura.js';

function sprawdz({ data, error }) {
  if (error) throw error;
  return data;
}
const rpc = async (nazwa, parametry = {}) => sprawdz(await (await supabase()).rpc(nazwa, parametry));
const zPowiadomieniem = async (nazwa, parametry) => {
  const wynik = await rpc(nazwa, parametry);
  // Nowy komentarz może mieć powiadomienie push (#113) – prosimy o wysyłkę od razu.
  import('./powiadomienia.js').then((m) => m.wyslijTeraz()).catch(() => {});
  return wynik;
};

export const komentarzeProjektu = async (projekt) => {
  const w = await rpc('komentarze_projektu', { p_projekt: projekt });
  return Array.isArray(w) ? w : [];
};

// Nowy wątek: strona + miejsce (mm od lewego górnego rogu strony) albo element. Odpowiedź: watek.
export const dodajKomentarz = ({ projekt, strona = null, element = null, x = null, y = null, tresc, watek = null }) =>
  zPowiadomieniem('dodaj_komentarz', { p_projekt: projekt, p_strona: strona, p_element: element, p_x: x, p_y: y, p_tresc: tresc, p_watek: watek });
export const zmienKomentarz = (id, tresc) => rpc('zmien_komentarz', { p_id: id, p_tresc: tresc });
export const usunKomentarz = (id) => rpc('usun_komentarz', { p_id: id });
export const rozwiazKomentarz = (id, rozwiazany = true) => rpc('rozwiaz_komentarz', { p_id: id, p_rozwiazany: rozwiazany });

// Zmiany komentarzy projektu na żywo: naZmiane() bez argumentów – odśwież listę.
let kanal = null;
export async function sluchajKomentarzy(projekt, naZmiane) {
  await przestanSluchacKomentarzy();
  const sb = await supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) await sb.realtime.setAuth(data.session.access_token);
  const filtr = { schema: 'public', table: 'komentarze', filter: `projekt_id=eq.${projekt}` };
  kanal = sb.channel(`komentarze-${projekt}`)
    .on('postgres_changes', { event: '*', ...filtr }, () => naZmiane())
    .subscribe();
}
export async function przestanSluchacKomentarzy() {
  if (!kanal) return;
  const stary = kanal;
  kanal = null;
  try { await (await supabase()).removeChannel(stary); } catch { /* już zamknięty */ }
}
