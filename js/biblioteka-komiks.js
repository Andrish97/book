// Biblioteka – kategoria „Komiks” (uwaga właściciela E2: „jak mieć dostęp do innych rzeczy? może biblioteka”):
// dymki każdego rodzaju, efekt dźwiękowy, gotowe układy kadrów (zastępują kadry na tej stronie), raster i linie
// ruchu oraz – na stronie komiksu – okna komiksu (krok po kroku, scenariusz, postacie, wgrywanie stron, webtoon).
// Wstawianie przez te same funkcje co pasek (js/app/komiks-narzedzia.js) – bez osobnej logiki.

import { zarejestrujKategorie } from './biblioteka.js';
import { UKLADY_KADROW, siatkaKadrow } from './kadry.js';
import { elementZeSkladu } from './biblioteka-sklad.js';
import { TLA } from './wzory-tla.js';
import { ikona } from './ikony.js';
import { t } from './jezyk.js';

const komiks = () => import('./app/komiks-narzedzia.js');
const wKomiksie = () => globalThis.document?.body?.classList.contains('w-komiksie');
const obrazIkony = (n) => ikona(n, { rozmiar: 44, klasa: 'ikona-biblioteki-komiksu' });

function podgladUkladu(u) {
  const kadry = siatkaKadrow({ x: 2, y: 2, w: 36, h: 52 }, u.wiersze, 2);
  return `<svg viewBox="0 0 40 56" width="40" height="56" aria-hidden="true"><rect x=".5" y=".5" width="39" height="55" fill="#fff" stroke="#bbb"/>${kadry.map((q) => `<polygon points="${q.map((p) => `${p.x},${p.y}`).join(' ')}" fill="#fff" stroke="#1a1a1a" stroke-width="1"/>`).join('')}</svg>`;
}

const DYMKI = ['mowa', 'mysl', 'krzyk', 'szept', 'narracja'];
const TLA_KOMIKSU = TLA.filter((e) => /raster|linie-ruchu/.test(e.id));

zarejestrujKategorie({
  id: 'komiks', nazwa: t('bibliotekaKomiks.komiks'), ikona: 'komiks', kolejnosc: 22,
  elementy: () => [
    ...DYMKI.map((r) => ({
      id: `dymek-${r}`, nazwa: t(`komiks.rodzaj_${r}`), grupa: t('bibliotekaKomiks.dymki'), slowa: `komiks dymek ${r}`,
      podglad: obrazIkony(r),
      wstaw: async (edytor) => { const k = await komiks(); return k.wStyluKomiksu(edytor.dodajDymek(r), 'dialog'); },
    })),
    { id: 'efekt', nazwa: t('komiks.stylEfekt'), grupa: t('bibliotekaKomiks.dymki'), slowa: 'komiks efekt bum dzwiek', podglad: obrazIkony('efekt'), wstaw: async () => { (await komiks()).efektDzwiekowy(); return null; } },
    ...UKLADY_KADROW.map((u) => ({
      id: `kadry-${u.id}`, nazwa: t(`bibliotekaKomiks.uklad_${u.id}`), grupa: t('bibliotekaKomiks.kadry'), slowa: 'komiks kadry uklad strona',
      podglad: podgladUkladu(u),
      wstaw: async () => { const k = await komiks(); k.ulozKadry(u.id); return null; },
    })),
    ...TLA_KOMIKSU.map((el) => elementZeSkladu({ ...el, kontekstPodgladu: { w: 54, h: 76, spad: 0, szer: 46, wysTresci: 66, akcent: '#2f5d8a', akcent2: '#c08a2e' } }, t('bibliotekaKomiks.raster'))),
    ...(wKomiksie() ? [
      ['okno', 'komiks', 'bibliotekaKomiks.krokPoKroku', async () => (await import('./app/komiks-okno.js')).oknoKomiksu()],
      ['scenariusz', 'tabela', 'bibliotekaKomiks.scenariusz', async () => (await import('./app/komiks-scenariusz-okno.js')).oknoScenariusza()],
      ['postacie', 'uzytkownik', 'bibliotekaKomiks.postacie', async () => (await komiks()).obsluzAkcjeKomiksu('komiks-postacie')],
      ['wgraj', 'obraz', 'bibliotekaKomiks.wgraj', async () => (await komiks()).obsluzAkcjeKomiksu('komiks-wgraj')],
      ['webtoon', 'pobierz', 'bibliotekaKomiks.webtoon', async () => (await komiks()).obsluzAkcjeKomiksu('komiks-webtoon')],
    ].map(([id, ik, klucz, fn]) => ({ id: `okno-${id}`, nazwa: t(klucz), grupa: t('bibliotekaKomiks.okna'), duzy: true, slowa: 'komiks okno', podglad: obrazIkony(ik), wstaw: async () => { await fn(); return null; } })) : []),
  ],
});
