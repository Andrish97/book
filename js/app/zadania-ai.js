// Zadania zlecone przez łącznik AI otwartej Makietce (plan H1, H2, H4; migracja 20261122180000_zadania_aplikacji_ai.sql):
// link do podglądu, obraz z opisu (klucz Gemini z sejfu), kadry komiksu i dymki. Ta sama kolejka co eksport PDF
// (js/app/eksport-ai.js – przyjęcie przez jedną kartę); tu samo wykonanie i wynik dla łącznika (zakoncz_zadanie).
// Obraz, kadry i dymki robi edytor z otwartym projektem – karta bez otwartego projektu go otwiera.

import { postep } from '../postep.js';
import { powiadom } from '../ui.js';
import { stan } from './kontekst.js';
import { czekajNaEdytor } from './doczytaj.js';
import { wpisyProjektow, wczytajProjektZWpisu } from './projekty.js';
import { t } from '../jezyk.js';

export const RODZAJE_ZADAN = ['link', 'obraz', 'kadry', 'dymki'];
// Te rodzaje potrzebują projektu otwartego w edytorze.
export const W_EDYTORZE = ['obraz', 'kadry', 'dymki'];

const czekaj = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

// Otwiera projekt zadania w edytorze (karta bez otwartego projektu albo link z odpowiedzi AI).
async function otworzProjekt(id) {
  if (stan.projekt?.id !== id) location.hash = `#/p/${id}`;
  const koniec = Date.now() + 60000;
  while (!(stan.projekt?.id === id && window.seriodruk?.edytor?.canvas)) {
    if (Date.now() > koniec) throw new Error(t('zadaniaAi.nieOtwarto'));
    await czekaj(200);
  }
  return czekajNaEdytor();
}

async function kluczGemini() {
  const { otwartySejf } = await import('./sejf-ai.js');
  const s = await otwartySejf({ pytaj: document.visibilityState === 'visible' });
  if (!s?.klucz('gemini')) throw new Error(t('zadaniaAi.brakKluczaGemini'));
}

async function linkProjektu(z) {
  await czekajNaEdytor();
  const { linkDlaAi } = await import('./podglad-ekran.js');
  let p = stan.projekt?.id === z.projekt_id ? stan.projekt : null;
  if (!p) {
    const wpis = (await wpisyProjektow()).find((w) => w.id === z.projekt_id);
    if (!wpis) throw new Error(t('zadaniaAi.brakProjektu'));
    p = await wczytajProjektZWpisu(wpis);
  }
  const w = await linkDlaAi(p, z.ustawienia || {});
  powiadom(t('zadaniaAi.linkGotowy', { nazwa: p.nazwa }));
  return w;
}

async function wEdytorze(z, pasek) {
  await otworzProjekt(z.projekt_id);
  const { wykonajLokalne } = await import('./czat-narzedzia-lokalne.js');
  const u = z.ustawienia || {};
  if (z.rodzaj === 'dymki') return { opis: await wykonajLokalne('ustaw_dymki', { kolumna: u.kolumna }, {}) };
  await kluczGemini();
  const informuj = (tekst) => pasek.opis(tekst);
  if (z.rodzaj === 'kadry') return { opis: await wykonajLokalne('rysuj_kadry', u, { informuj }) };
  const { wolajDlaProjektu } = await import('./czat-ai.js');
  return { opis: await wykonajLokalne('generuj_obraz', u, { informuj, wolaj: await wolajDlaProjektu(z.projekt_id) }) };
}

// Wykonuje przyjęte zadanie i oddaje wynik łącznikowi. rpc – funkcja bazy, karta – ta karta (przyjmij_eksport).
export async function wykonajZadanie(z, { rpc, karta }) {
  const pasek = postep(t('zadaniaAi.wykonuje', { co: t(`zadaniaAi.rodzaj.${z.rodzaj}`) }), { opoznienie: 0 });
  try {
    const wynik = z.rodzaj === 'link' ? await linkProjektu(z) : await wEdytorze(z, pasek);
    await rpc('zakoncz_zadanie', { p_id: z.id, p_karta: karta, p_wynik: wynik, p_blad: null });
    if (z.rodzaj !== 'link') powiadom(t('zadaniaAi.gotowe', { co: t(`zadaniaAi.rodzaj.${z.rodzaj}`) }));
  } catch (e) {
    const opis = e?.message || String(e);
    try { await rpc('zakoncz_zadanie', { p_id: z.id, p_karta: karta, p_wynik: {}, p_blad: opis }); } catch { /* inna karta przejmie po 5 min */ }
    powiadom(t('zadaniaAi.nieUdalo', { co: t(`zadaniaAi.rodzaj.${z.rodzaj}`), opis }), true);
  } finally {
    pasek.koniec();
  }
}
