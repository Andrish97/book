// Współpraca między kontami – rozmowa z bazą (migracja 20261114120000_wspolpraca.sql, decyzja #86).
//
// Właściciel zaprasza osobę adresem e-mail z rolą „edycja” albo „odczyt”. Zaproszenie czeka w aplikacji
// zaproszonej osoby (skrzynka „Zaproszenia”, po adresie konta) i ma jednorazowy link #/zaproszenie/<kod>.
// Po przyjęciu projekt pojawia się na liście tej osoby, a zmiany łączą się na żywo tak samo jak zmiany
// z drugiego urządzenia albo od AI. Kto jest akurat w projekcie, pokazuje obecność (Supabase Realtime).

import { supabase } from './chmura.js';

function sprawdz({ data, error }) {
  if (error) throw error;
  return data;
}

const rpc = async (nazwa, parametry = {}) => sprawdz(await (await supabase()).rpc(nazwa, parametry));
const lista = (x) => (Array.isArray(x) ? x : []);

export const ROLE = { wlasciciel: 'właściciel', edycja: 'może edytować', odczyt: 'może oglądać' };

// Link do przyjęcia zaproszenia – adres aplikacji z kodem.
export const linkZaproszenia = (kod) => `${location.origin}${location.pathname}#/zaproszenie/${encodeURIComponent(kod)}`;

export const zaprosDoProjektu = (projekt, email, rola) => rpc('zapros_do_projektu', { p_projekt: projekt, p_email: email, p_rola: rola });
export const osobyProjektu = async (projekt) => lista(await rpc('osoby_projektu', { p_projekt: projekt }));
export const cofnijZaproszenie = (id) => rpc('cofnij_zaproszenie', { p_id: id });
export const zmienRole = (projekt, uzytkownik, rola) => rpc('zmien_role_wspolpracownika', { p_projekt: projekt, p_uzytkownik: uzytkownik, p_rola: rola });
export const usunZProjektu = (projekt, uzytkownik) => rpc('usun_z_projektu', { p_projekt: projekt, p_uzytkownik: uzytkownik });
export const mojeZaproszenia = async () => lista(await rpc('moje_zaproszenia'));
export const zaproszenieZKodu = (kod) => rpc('zaproszenie_z_kodu', { p_kod: kod });
export const przyjmijZaproszenie = (kod) => rpc('przyjmij_zaproszenie', { p_kod: kod });
export const odrzucZaproszenie = (kod) => rpc('odrzuc_zaproszenie', { p_kod: kod });

// Projekty innych osób, do których mam dostęp: Map(id projektu → { rola, wlasciciel, wlasciciel_email }).
// Bez wdrożonej migracji (stara baza) – pusta mapa, lista działa jak dawniej.
export async function udostepnioneMi() {
  try {
    return new Map(lista(await rpc('udostepnione_mi')).map((w) => [w.projekt_id, w]));
  } catch {
    return new Map();
  }
}

// ---------- Na żywo: nowe zaproszenia i zmiany dostępu ----------
// Zaproszenia i wiersze współpracy rozchodzą się kanałem Realtime; RLS wysyła każdemu tylko jego wiersze
// (zaproszenia na jego adres, jego dostępy i dostępy w jego projektach).
let kanalZaproszen = null;

export async function sluchajZaproszen(uzytkownik, { naZaproszenie = () => {}, naDostep = () => {} } = {}) {
  await przestanSluchacZaproszen();
  if (!uzytkownik) return;
  const sb = await supabase();
  kanalZaproszen = sb.channel(`wspolpraca-${uzytkownik.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'zaproszenia' }, (z) => naZaproszenie(z?.new || {}))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zaproszenia' }, (z) => naZaproszenie(z?.new || {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wspolpracownicy' }, (z) => naDostep(z?.new || z?.old || {}))
    .subscribe();
}

export async function przestanSluchacZaproszen() {
  if (!kanalZaproszen) return;
  const stary = kanalZaproszen;
  kanalZaproszen = null;
  try { await (await supabase()).removeChannel(stary); } catch { /* już zamknięty */ }
}

// ---------- Obecność w projekcie ----------
// Kanał „obecnosc-<projekt>”: każda osoba (klucz – id konta, więc dwa urządzenia tej samej osoby to jedna
// osoba) zgłasza, na której stronie jest i co ma zaznaczone. naZmiane(lista) – wszyscy obecni poza mną:
// [{ id, nazwa, kolor, strona, zaznaczone, oglada }].
const KOLORY = ['#e5484d', '#0d74ce', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f', '#12a594', '#ab6400'];
export function kolorOsoby(id) {
  let h = 0;
  for (const z of String(id)) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  return KOLORY[h % KOLORY.length];
}

export async function dolaczDoProjektu(projektId, ja, naZmiane) {
  const sb = await supabase();
  // Kanał prywatny: dołączyć może tylko osoba z dostępem do projektu (reguła na realtime.messages w migracji).
  const kanal = sb.channel(`obecnosc-${projektId}`, { config: { private: true, presence: { key: ja.id } } });
  let biezacy = { ...ja };
  const obecniTeraz = () => {
    const stan = kanal.presenceState();
    return Object.entries(stan)
      .filter(([klucz]) => klucz !== ja.id)
      .map(([klucz, metas]) => ({ id: klucz, ...(metas.at(-1) || {}) }))
      .map(({ presence_ref: _p, ...reszta }) => reszta);
  };
  kanal.on('presence', { event: 'sync' }, () => naZmiane(obecniTeraz()));
  await new Promise((ok) => {
    kanal.subscribe((stanKanalu) => {
      if (stanKanalu === 'SUBSCRIBED') { kanal.track(biezacy).catch(() => {}); ok(); }
      if (stanKanalu === 'CHANNEL_ERROR' || stanKanalu === 'TIMED_OUT' || stanKanalu === 'CLOSED') ok();
    });
  });
  return {
    zglos(zmiany) {
      const nowy = { ...biezacy, ...zmiany };
      if (JSON.stringify(nowy) === JSON.stringify(biezacy)) return;
      biezacy = nowy;
      kanal.track(biezacy).catch(() => {});
    },
    async zamknij() {
      try { await kanal.untrack(); } catch { /* bez znaczenia */ }
      try { await sb.removeChannel(kanal); } catch { /* już zamknięty */ }
    },
  };
}
