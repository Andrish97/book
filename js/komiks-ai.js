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
  // F5: więcej stylów
  olowek: 'hand-drawn pencil sketch, graphite shading on white paper, loose expressive lines, no colour',
  ligne: 'European ligne claire comic style, clean uniform outlines, flat bright colours, no hatching, detailed backgrounds',
  superbohater: 'modern American superhero comic style, dynamic perspective, strong shadows, saturated colours, crisp inking',
  anime: 'colourful anime style, big expressive eyes, cel shading, soft gradients, clean line art',
  wycinanka: 'paper cut-out collage illustration, layered coloured paper with visible edges and subtle shadows, simple shapes',
};
export const STYL_DOMYSLNY = 'bajka';
export const stylProjektu = (projekt) => STYLE_RYSUNKOW[projekt?.komiks_ai?.styl] || STYLE_RYSUNKOW[STYL_DOMYSLNY];

const bez = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
const zawiera = (tekst, slowo) => slowo && new RegExp(`(^|[^\\p{L}])${bez(slowo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(bez(tekst));

// Teksty opisów w języku użytkownika (D2: użytkownik widzi opis po swojemu; techniczny dopisek o stylu i braku napisów
// dokłada generowanie, js/app/generuj-obraz.js). Model rozumie polski i ukraiński tak samo jak angielski.
const SL = {
  pl: { kadr: 'Kadr', ujecie: 'Ujęcie', scena: 'Scena', postacie: 'W kadrze', zawsze: 'zawsze', miejsce: 'Miejsce (tło)', pora: 'pora dnia', swiatlo: 'światło', wzorce: 'Obrazy wzorcowe pokazują po kolei', zachowaj: 'zachowaj ich wygląd', miejsceWzorzec: 'miejsce', dymki: 'Zostaw w górnej części kadru spokojne tło na dymki – nie rysuj dymków ani pustych ramek.', ogolny: 'Kadr otwierający, pasujący do historii.', wzorPostaci: 'Obraz wzorcowy postaci', wzorMiejsca: 'Obraz wzorcowy miejsca', cechy: 'znak rozpoznawczy', emocja: 'emocja', robi: 'robi', charakter: 'charakter', sylwetka: 'Cała sylwetka, stoi przodem, spokojna poza, czyste białe tło, nic więcej na obrazie.', widokMiejsca: 'Szeroki widok miejsca, bez ludzi.', rekwizyty: 'Rekwizyty', nalezy: 'należy do', wzorRekwizytu: 'Obraz wzorcowy rekwizytu', widokRekwizytu: 'Sam przedmiot na czystym białym tle, nic więcej na obrazie.' },
  en: { kadr: 'Panel', ujecie: 'Shot', scena: 'Scene', postacie: 'In the panel', zawsze: 'always with', miejsce: 'Place (background)', pora: 'time of day', swiatlo: 'light', wzorce: 'The reference images show, in order', zachowaj: 'keep their look', miejsceWzorzec: 'place', dymki: 'Keep a calm background in the upper part of the panel for speech bubbles – do not draw bubbles or empty boxes.', ogolny: 'An opening panel that fits the story.', wzorPostaci: 'Character reference image', wzorMiejsca: 'Place reference image', cechy: 'distinctive feature', emocja: 'emotion', robi: 'doing', charakter: 'personality', sylwetka: 'Full body, standing, facing forward, calm pose, plain white background, nothing else in the picture.', widokMiejsca: 'Wide view of the place, no people.', rekwizyty: 'Props', nalezy: 'belongs to', wzorRekwizytu: 'Prop reference image', widokRekwizytu: 'The object alone on a plain white background, nothing else in the picture.' },
  uk: { kadr: 'Кадр', ujecie: 'План', scena: 'Сцена', postacie: 'У кадрі', zawsze: 'завжди', miejsce: 'Місце (тло)', pora: 'пора дня', swiatlo: 'світло', wzorce: 'Еталонні зображення показують по черзі', zachowaj: 'збережи їхній вигляд', miejsceWzorzec: 'місце', dymki: 'Залиш у верхній частині кадру спокійне тло для бульбашок – не малюй бульбашок і порожніх рамок.', ogolny: 'Вступний кадр, що пасує до історії.', wzorPostaci: 'Еталонне зображення персонажа', wzorMiejsca: 'Еталонне зображення місця', cechy: 'прикмета', emocja: 'емоція', robi: 'робить', charakter: 'характер', sylwetka: 'На весь зріст, стоїть обличчям уперед, спокійна поза, чисте біле тло, більше нічого на зображенні.', widokMiejsca: 'Широкий вигляд місця, без людей.', rekwizyty: 'Реквізит', nalezy: 'належить', wzorRekwizytu: 'Еталонне зображення реквізиту', widokRekwizytu: 'Лише предмет на чистому білому тлі, більше нічого на зображенні.' },
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

export function opisWzorcaRekwizytu(k, j = 'pl') {
  const L = sl(j);
  return `${L.wzorRekwizytu}: ${k.nazwa}${k.opis ? `, ${k.opis}` : ''}${k.czyj ? `; ${L.nalezy}: ${k.czyj}` : ''}. ${L.widokRekwizytu}`;
}

// Kadry strony komiksu nr `strona` (1 = pierwsza strona komiksu): dla każdego kadru 1..ileKadrow – scena, ujęcie,
// postacie (mówiące, zaznaczone „w kadrze” i wymienione w opisie), miejsce (wybrane albo z nazwy w opisie) i gotowy
// opis w języku `j`. Zwraca [{ kadr, scena, ujecie, postacie: [karta], miejsce: karta|null, opis }].
export function kadryStrony(projekt, tabela, strona, ileKadrow, j = 'pl') {
  const L = sl(j);
  const postacie = karty(projekt, 'postacie');
  const miejsca = karty(projekt, 'miejsca');
  const rekwizyty = karty(projekt, 'rekwizyty');
  const sc = tabela ? scenariuszZTabeli(tabela).find((s) => s.nr === strona) : null;
  const wynik = [];
  for (let nr = 1; nr <= ileKadrow; nr += 1) {
    const kd = sc?.kadry.find((x) => x.nr === nr) || { opis: '', ujecie: '', miejsce: '', wKadrze: [], gra: [], rekwizyty: [], kwestie: [] };
    const scena = kd.opis;
    const mowiacy = kd.kwestie.map((q) => q.postac).filter(Boolean);
    const kto = postacie.filter((p) => [...mowiacy, ...kd.wKadrze].some((m) => bez(m) === bez(p.imie)) || zawiera(scena, p.imie));
    const miejsce = miejsca.find((m) => (kd.miejsce && bez(m.nazwa) === bez(kd.miejsce)) || zawiera(scena, m.nazwa)) || null;
    // rekwizyty: wybrane w kadrze albo wymienione w opisie sceny (F6)
    const rzeczy = rekwizyty.filter((r) => (kd.rekwizyty || []).some((x) => bez(x) === bez(r.nazwa)) || zawiera(scena, r.nazwa));
    const idU = idUjecia(kd.ujecie);
    const wzorce = [...kto.filter((p) => p.obraz).map((p) => p.imie), ...(miejsce?.obraz ? [`${L.miejsceWzorzec} ${miejsce.nazwa}`] : []), ...rzeczy.filter((r) => r.obraz).map((r) => r.nazwa)];
    const czesci = [
      `${L.kadr} ${nr}.`,
      kd.ujecie && `${L.ujecie}: ${kd.ujecie}${idU ? ` (${UJECIA[idU].model})` : ''}.`,
      scena ? `${L.scena}: ${scena}.` : (kto.length ? '' : L.ogolny),
      ...kto.map((p) => {
        const g = (kd.gra || []).find((x) => bez(x.imie) === bez(p.imie)); // emocja i działanie w tym kadrze (E3)
        return `${L.postacie}: ${p.imie} – ${[p.wyglad, p.znak && `${L.zawsze}: ${p.znak}`, g?.emocja && `${L.emocja}: ${g.emocja}`, g?.robi && `${L.robi}: ${g.robi}`].filter(Boolean).join(', ')}.`;
      }),
      rzeczy.length && `${L.rekwizyty}: ${rzeczy.map((r) => [r.nazwa, r.opis, r.czyj && `${L.nalezy}: ${r.czyj}`].filter(Boolean).join(', ')).join('; ')}.`,
      miejsce && `${L.miejsce}: ${[miejsce.nazwa, miejsce.opis, miejsce.pora && `${L.pora}: ${miejsce.pora}`, miejsce.swiatlo && `${L.swiatlo}: ${miejsce.swiatlo}`].filter(Boolean).join(', ')}.`,
      wzorce.length ? `${L.wzorce}: ${wzorce.join(', ')} – ${L.zachowaj}.` : '',
      kd.kwestie.some((q) => q.tekst) ? L.dymki : '',
    ];
    wynik.push({ kadr: nr, scena, ujecie: kd.ujecie, postacie: kto, miejsce, rekwizyty: rzeczy, opis: czesci.filter(Boolean).join(' ') });
  }
  return wynik;
}
