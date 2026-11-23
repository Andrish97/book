// Specyfikacja dla drukarni (#214): wszystkie ustawienia, które drukarnia potrzebuje poza plikiem PDF – formaty
// i liczby stron sekcji, oprawa, papier środka, materiał i folia okładki, zaokrąglone rogi, tasiemka, podłoże,
// tryb kolorów, kolory dodatkowe i uszlachetnienia. Zwykły tekst (do maila albo zamówienia) i JSON (do systemów).

import { rozwin } from './serie.js';
import { OPRAWY, PAPIERY, geometriaOkladki } from './okladka.js';
import { opisWykonczenia } from './materialy.js';
import { TYPY_SEKCJI, typSekcji } from './typ-sekcji.js';
import { TRYBY_KOLOROW, trybKolorow, uzyteKoloryDruku } from './kolory-druku.js';
import { t as tt } from './jezyk.js';

const mm = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');
const PODLOZA = { kolor: 'kolorowy papier', folia: 'przezroczysta folia' };

export function specyfikacja(projekt, ciag = rozwin(projekt)) {
  const sekcje = projekt.sekcje.map((s) => {
    const stron = ciag.egzemplarze.filter((e) => e.sekcja.id === s.id).length;
    const w = s.wydruk;
    const wpis = {
      nazwa: s.nazwa, typ: TYPY_SEKCJI[typSekcji(s)]?.nazwa || 'Zwykła', stron,
      format_mm: [w.szerokosc_mm, w.wysokosc_mm], spad_mm: w.spad_mm, uklad: s.uklad,
      ...(s.skladka ? { skladka: s.skladka } : {}),
      ...(s.podloze?.rodzaj ? { podloze: s.podloze } : {}),
      ...(s.papier ? { papier: s.papier } : {}),
      kolory: TRYBY_KOLOROW.find((t) => t.id === trybKolorow(projekt, s))?.nazwa,
    };
    if (s.okladka) {
      const o = s.okladka;
      let g = o.wynik;
      try { g = geometriaOkladki(projekt, s, ciag); } catch { /* zostaje zapisany wynik */ }
      Object.assign(wpis, {
        oprawa: OPRAWY[o.oprawa], grzbiet_mm: g?.grzbiet, stron_srodka: g?.stron,
        papier_srodka: o.papier.tryb === 'gramatura' ? `${PAPIERY[o.papier.rodzaj]?.nazwa || o.papier.rodzaj}, ${o.papier.gramatura} g/m²` : `kartka ${mm(o.papier.grubosc_mm)} mm`,
        wykonczenie: opisWykonczenia(o.wykonczenie), ...(o.wykonczenie ? { wykonczenie_dane: o.wykonczenie } : {}),
        ...(o.tasiemka ? { tasiemka: o.tasiemka.kolor } : {}),
        ...(o.oprawa === 'twarda' ? { tektura_mm: o.tektura_mm, zawiniecie_mm: o.zawiniecie_mm } : {}),
      });
    }
    return wpis;
  });
  const { spoty, uszlachetnienia } = uzyteKoloryDruku(projekt);
  return {
    projekt: projekt.nazwa, data: new Date().toISOString().slice(0, 10), stron_razem: ciag.egzemplarze.length, sekcje,
    kolory_dodatkowe: spoty.map((s) => s.nazwa), uszlachetnienia: uszlachetnienia.map((u) => tt('specyfikacja.plytaEl', { etykieta: u.etykieta, plyta: u.plyta, ile: u.ile })),
  };
}

export function specyfikacjaTekst(spec) {
  const l = [`SPECYFIKACJA DO DRUKU – ${spec.projekt}`, `Data: ${spec.data}`, `Stron w wydruku razem: ${spec.stron_razem}`, ''];
  for (const s of spec.sekcje) {
    l.push(`■ ${s.nazwa} (${s.typ})`);
    l.push(tt('specyfikacja.formatNettoMmSpad', { mm: mm(s.format_mm[0]), mm2: mm(s.format_mm[1]), mm3: mm(s.spad_mm), stron: s.stron, x: s.uklad === 'rozkladowki' ? tt('specyfikacja.rozkladowki') : '' }));
    if (s.oprawa) {
      l.push(`  Oprawa: ${s.oprawa}${s.grzbiet_mm ? `, grzbiet ${mm(s.grzbiet_mm)} mm` : ''}${s.stron_srodka ? `, środek ${s.stron_srodka} stron` : ''}`);
      l.push(tt('specyfikacja.papierSrodka', { papier_srodka: s.papier_srodka }));
      l.push(tt('kod.spec.okladka', { w: s.wykonczenie }));
      if (s.tektura_mm) l.push(tt('specyfikacja.tekturaMmZawiniecieMm', { mm: mm(s.tektura_mm), mm2: mm(s.zawiniecie_mm) }));
      if (s.tasiemka) l.push(tt('specyfikacja.tasiemkaZakladka', { tasiemka: s.tasiemka }));
    }
    if (s.skladka) l.push(tt('specyfikacja.skladkiPoStron', { skladka: s.skladka }));
    if (s.papier) l.push(tt('specyfikacja.papierWkladkiGM', { x: PAPIERY[s.papier.rodzaj]?.nazwa || s.papier.rodzaj, gramatura: s.papier.gramatura }));
    if (s.podloze) l.push(tt('specyfikacja.podlozeNieDrukujeSie', { x: PODLOZA[s.podloze.rodzaj], x2: s.podloze.kolor ? ` (${s.podloze.kolor})` : '' }));
    if (s.kolory) l.push(`  Kolory: ${s.kolory}`);
    l.push('');
  }
  if (spec.kolory_dodatkowe.length) l.push(tt('specyfikacja.koloryDodatkoweOsobnePlyty', { join: spec.kolory_dodatkowe.join(', ') }));
  if (spec.uszlachetnienia.length) l.push(`Uszlachetnienia: ${spec.uszlachetnienia.join('; ')}`);
  l.push('', 'Przygotowano w Makietce (makietka.app).');
  return l.join('\n');
}
