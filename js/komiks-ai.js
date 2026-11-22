// Komiks z AI (#374, plan komiksu C1–C3): gotowe style rysunków, opis obrazu wzorcowego postaci i miejsca z karty,
// opisy kadrów strony składane ze scenariusza (opis sceny, kto mówi), kart postaci (wygląd, znak) i miejsc (opis,
// pora dnia, światło) – użytkownik nie pisze promptów. Obrazy wzorcowe kart idą do modelu jako odniesienie,
// więc postać wygląda tak samo w każdym kadrze. Moduł bez zależności od edytora.

import { karty } from './postacie.js';
import { kolumnyDialogu } from './dialogi.js';

// Style rysunków (C1): id → opis dla modelu (po angielsku – modele rozumieją go najlepiej).
export const STYLE_RYSUNKOW = {
  bajka: 'colourful children\'s book illustration, soft shading, friendly rounded shapes, clean ink outlines',
  akwarela: 'delicate watercolour illustration with visible paper texture and soft washes of colour, ink outlines',
  cartoon: 'simple flat cartoon style, bold black outlines, bright flat colours, minimal shading',
  manga: 'black and white manga style, screentone shading, expressive line art, no colour',
  retro: 'vintage 1960s comic book style, halftone dots, bold primary colours, thick ink lines',
};
export const STYL_DOMYSLNY = 'bajka';
export const stylProjektu = (projekt) => STYLE_RYSUNKOW[projekt?.komiks_ai?.styl] || STYLE_RYSUNKOW[STYL_DOMYSLNY];

const bez = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
const zawiera = (tekst, slowo) => slowo && new RegExp(`(^|[^\\p{L}])${bez(slowo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(bez(tekst));

// Obraz wzorcowy (C2): postać na białym tle, cała sylwetka; miejsce – sam widok bez postaci.
export function opisWzorcaPostaci(k) {
  return `Character reference image: ${k.imie}${k.wyglad ? `, ${k.wyglad}` : ''}${k.znak ? `; distinctive feature: ${k.znak}` : ''}${k.charakter ? `; personality: ${k.charakter}` : ''}. Full body, standing, front three-quarter view, neutral pose, plain white background, nothing else in the picture.`;
}
export function opisWzorcaMiejsca(k) {
  return `Location reference image: ${k.nazwa}${k.opis ? `, ${k.opis}` : ''}${k.pora ? `; time of day: ${k.pora}` : ''}${k.swiatlo ? `; light: ${k.swiatlo}` : ''}. Wide establishing view, no people.`;
}

// Kadry strony komiksu nr `strona` (1 = pierwsza strona komiksu): dla każdego kadru 1..ileKadrow – opis sceny, postacie
// (z kolumny „postać” i z imion w opisie sceny), miejsce (z kolumny „miejsce” albo z nazwy w opisie) i gotowy opis
// dla modelu. Zwraca [{ kadr, scena, postacie: [karta], miejsce: karta|null, opis }].
export function kadryStrony(projekt, tabela, strona, ileKadrow) {
  const k = tabela ? kolumnyDialogu(tabela) : { strona: -1 };
  const iMiejsca = tabela ? tabela.kolumny.findIndex((n) => ['miejsce', 'place', 'location', 'місце'].includes(bez(n))) : -1;
  const iSceny = tabela ? tabela.kolumny.findIndex((n) => ['opis sceny', 'scena', 'scene', 'opis', 'сцена'].includes(bez(n))) : -1;
  const postacie = karty(projekt, 'postacie');
  const miejsca = karty(projekt, 'miejsca');
  const wiersze = tabela && k.strona >= 0 ? tabela.wiersze.filter((w) => parseInt(w[k.strona], 10) === strona) : [];
  const wynik = [];
  for (let nr = 1; nr <= ileKadrow; nr += 1) {
    const wk = wiersze.filter((w) => (k.kadr >= 0 ? Math.max(1, parseInt(w[k.kadr], 10) || 1) : 1) === nr);
    const sceny = [...new Set(wk.map((w) => String(w[iSceny] ?? '').trim()).filter(Boolean))];
    const scena = sceny.join('. ');
    const mowiacy = wk.map((w) => String(k.postac >= 0 ? w[k.postac] : '').trim()).filter(Boolean);
    const kto = postacie.filter((p) => mowiacy.some((m) => bez(m) === bez(p.imie)) || zawiera(scena, p.imie));
    const nazwaMiejsca = wk.map((w) => String(iMiejsca >= 0 ? w[iMiejsca] : '').trim()).find(Boolean);
    const miejsce = miejsca.find((m) => (nazwaMiejsca && bez(m.nazwa) === bez(nazwaMiejsca)) || zawiera(scena, m.nazwa)) || null;
    const czesci = [
      `Comic panel ${nr}.`,
      scena ? `Scene: ${scena}.` : (kto.length ? '' : 'An establishing shot that fits the story.'),
      ...kto.map((p) => `${p.imie}: ${[p.wyglad, p.znak && `always with ${p.znak}`].filter(Boolean).join(', ')}.`),
      miejsce && `Place: ${[miejsce.nazwa, miejsce.opis, miejsce.pora && `time of day: ${miejsce.pora}`, miejsce.swiatlo && `light: ${miejsce.swiatlo}`].filter(Boolean).join(', ')}.`,
      kto.some((p) => p.obraz) || miejsce?.obraz ? 'Keep the characters and place consistent with the reference images.' : '',
      mowiacy.length ? 'Leave empty space in the upper part of the panel for speech bubbles.' : '',
    ];
    wynik.push({ kadr: nr, scena, postacie: kto, miejsce, opis: czesci.filter(Boolean).join(' ') });
  }
  return wynik;
}
