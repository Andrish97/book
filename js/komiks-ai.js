// Komiks z AI (#374, plan komiksu C1–C3): gotowe style rysunków, opis obrazu wzorcowego postaci i miejsca z karty,
// opisy kadrów strony składane ze scenariusza (opis sceny, kto mówi), kart postaci (wygląd, znak) i miejsc (opis,
// pora dnia, światło) – użytkownik nie pisze promptów. Obrazy wzorcowe kart idą do modelu jako odniesienie,
// więc postać wygląda tak samo w każdym kadrze. Moduł bez zależności od edytora.

import { karty } from './postacie.js';
import { scenariuszZTabeli, idUjecia, UJECIA } from './komiks-scenariusz.js';

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

// Teksty opisów w języku użytkownika (D2: użytkownik widzi opis po swojemu; techniczny dopisek o stylu i braku napisów
// dokłada generowanie, js/app/generuj-obraz.js). Model rozumie polski i ukraiński tak samo jak angielski.
const SL = {
  pl: { kadr: 'Kadr', ujecie: 'Ujęcie', scena: 'Scena', postacie: 'W kadrze', zawsze: 'zawsze', miejsce: 'Miejsce (tło)', pora: 'pora dnia', swiatlo: 'światło', wzorce: 'Obrazy wzorcowe pokazują po kolei', zachowaj: 'zachowaj ich wygląd', miejsceWzorzec: 'miejsce', dymki: 'Zostaw w górnej części kadru wolne miejsce na dymki.', ogolny: 'Kadr otwierający, pasujący do historii.', wzorPostaci: 'Obraz wzorcowy postaci', wzorMiejsca: 'Obraz wzorcowy miejsca', cechy: 'znak rozpoznawczy', charakter: 'charakter', sylwetka: 'Cała sylwetka, stoi przodem, spokojna poza, czyste białe tło, nic więcej na obrazie.', widokMiejsca: 'Szeroki widok miejsca, bez ludzi.' },
  en: { kadr: 'Panel', ujecie: 'Shot', scena: 'Scene', postacie: 'In the panel', zawsze: 'always with', miejsce: 'Place (background)', pora: 'time of day', swiatlo: 'light', wzorce: 'The reference images show, in order', zachowaj: 'keep their look', miejsceWzorzec: 'place', dymki: 'Leave free space in the upper part of the panel for speech bubbles.', ogolny: 'An opening panel that fits the story.', wzorPostaci: 'Character reference image', wzorMiejsca: 'Place reference image', cechy: 'distinctive feature', charakter: 'personality', sylwetka: 'Full body, standing, facing forward, calm pose, plain white background, nothing else in the picture.', widokMiejsca: 'Wide view of the place, no people.' },
  uk: { kadr: 'Кадр', ujecie: 'План', scena: 'Сцена', postacie: 'У кадрі', zawsze: 'завжди', miejsce: 'Місце (тло)', pora: 'пора дня', swiatlo: 'світло', wzorce: 'Еталонні зображення показують по черзі', zachowaj: 'збережи їхній вигляд', miejsceWzorzec: 'місце', dymki: 'Залиш у верхній частині кадру вільне місце для бульбашок.', ogolny: 'Вступний кадр, що пасує до історії.', wzorPostaci: 'Еталонне зображення персонажа', wzorMiejsca: 'Еталонне зображення місця', cechy: 'прикмета', charakter: 'характер', sylwetka: 'На весь зріст, стоїть обличчям уперед, спокійна поза, чисте біле тло, більше нічого на зображенні.', widokMiejsca: 'Широкий вигляд місця, без людей.' },
};
const sl = (j) => SL[j] || SL.pl;

// Obraz wzorcowy (C2): postać na białym tle, cała sylwetka; miejsce – sam widok bez postaci.
export function opisWzorcaPostaci(k, j = 'pl') {
  const L = sl(j);
  return `${L.wzorPostaci}: ${k.imie}${k.wyglad ? `, ${k.wyglad}` : ''}${k.znak ? `; ${L.cechy}: ${k.znak}` : ''}${k.charakter ? `; ${L.charakter}: ${k.charakter}` : ''}. ${L.sylwetka}`;
}
export function opisWzorcaMiejsca(k, j = 'pl') {
  const L = sl(j);
  return `${L.wzorMiejsca}: ${k.nazwa}${k.opis ? `, ${k.opis}` : ''}${k.pora ? `; ${L.pora}: ${k.pora}` : ''}${k.swiatlo ? `; ${L.swiatlo}: ${k.swiatlo}` : ''}. ${L.widokMiejsca}`;
}

// Kadry strony komiksu nr `strona` (1 = pierwsza strona komiksu): dla każdego kadru 1..ileKadrow – scena, ujęcie,
// postacie (mówiące, zaznaczone „w kadrze” i wymienione w opisie), miejsce (wybrane albo z nazwy w opisie) i gotowy
// opis w języku `j`. Zwraca [{ kadr, scena, ujecie, postacie: [karta], miejsce: karta|null, opis }].
export function kadryStrony(projekt, tabela, strona, ileKadrow, j = 'pl') {
  const L = sl(j);
  const postacie = karty(projekt, 'postacie');
  const miejsca = karty(projekt, 'miejsca');
  const sc = tabela ? scenariuszZTabeli(tabela).find((s) => s.nr === strona) : null;
  const wynik = [];
  for (let nr = 1; nr <= ileKadrow; nr += 1) {
    const kd = sc?.kadry.find((x) => x.nr === nr) || { opis: '', ujecie: '', miejsce: '', wKadrze: [], kwestie: [] };
    const scena = kd.opis;
    const mowiacy = kd.kwestie.map((q) => q.postac).filter(Boolean);
    const kto = postacie.filter((p) => [...mowiacy, ...kd.wKadrze].some((m) => bez(m) === bez(p.imie)) || zawiera(scena, p.imie));
    const miejsce = miejsca.find((m) => (kd.miejsce && bez(m.nazwa) === bez(kd.miejsce)) || zawiera(scena, m.nazwa)) || null;
    const idU = idUjecia(kd.ujecie);
    const wzorce = [...kto.filter((p) => p.obraz).map((p) => p.imie), ...(miejsce?.obraz ? [`${L.miejsceWzorzec} ${miejsce.nazwa}`] : [])];
    const czesci = [
      `${L.kadr} ${nr}.`,
      kd.ujecie && `${L.ujecie}: ${kd.ujecie}${idU ? ` (${UJECIA[idU].model})` : ''}.`,
      scena ? `${L.scena}: ${scena}.` : (kto.length ? '' : L.ogolny),
      ...kto.map((p) => `${L.postacie}: ${p.imie} – ${[p.wyglad, p.znak && `${L.zawsze}: ${p.znak}`].filter(Boolean).join(', ')}.`),
      miejsce && `${L.miejsce}: ${[miejsce.nazwa, miejsce.opis, miejsce.pora && `${L.pora}: ${miejsce.pora}`, miejsce.swiatlo && `${L.swiatlo}: ${miejsce.swiatlo}`].filter(Boolean).join(', ')}.`,
      wzorce.length ? `${L.wzorce}: ${wzorce.join(', ')} – ${L.zachowaj}.` : '',
      kd.kwestie.some((q) => q.tekst) ? L.dymki : '',
    ];
    wynik.push({ kadr: nr, scena, ujecie: kd.ujecie, postacie: kto, miejsce, opis: czesci.filter(Boolean).join(' ') });
  }
  return wynik;
}
