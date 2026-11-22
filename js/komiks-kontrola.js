// Kontrola komiksu przed drukiem (#370, plan komiksu A12): tekst w dymku mniejszy niż 7 pt, dymek wychodzący poza
// stronę, dymek leżący na dwóch kadrach (przecina rynnę), ogonek celujący poza kadry, puste kadry. Działa na danych
// stron sekcji typu „Komiks”; uwagi w tym samym kształcie co reszta kontroli (js/kontrola.js).

import { t as tt } from './jezyk.js';

const MIN_PT = 7;
const naPt = (mm) => (mm * 72) / 25.4;
const ramka = (o) => ({
  x1: o.left || 0, y1: o.top || 0,
  x2: (o.left || 0) + (o.width || 0) * Math.abs(o.scaleX ?? 1), y2: (o.top || 0) + (o.height || 0) * Math.abs(o.scaleY ?? 1),
});
const zachodzi = (a, b, min = 2) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > min && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > min;
const wewnatrz = (p, r, tol = 1) => p.x >= r.x1 - tol && p.x <= r.x2 + tol && p.y >= r.y1 - tol && p.y <= r.y2 + tol;
const skrot = (s) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > 24 ? `${x.slice(0, 23)}…` : x; };

// strony: [{ strona, nr, w, h, spad }] – strony komiksu z numerem w publikacji i formatem sekcji.
export function uwagiKomiksu(strony) {
  const uwagi = [];
  const dodaj = (s, opis, idObiektu = null) => uwagi.push({ rodzaj: 'komiks', strony: s.nr ? [s.nr] : [], idStrony: s.strona.id, ...(idObiektu ? { idObiektu } : {}), opis });
  for (const s of strony) {
    const obiekty = (s.strona.obiekty || []).filter((o) => o && o.visible !== false);
    const kadry = obiekty.filter((o) => o.kadr_nr != null).map((o) => ({ o, r: ramka(o) }));
    const dymki = obiekty.filter((o) => o.dymek);
    const obrazy = obiekty.filter((o) => o.type === 'image').map(ramka);
    const nr = s.nr ?? '?';
    for (const d of dymki) {
      const r = ramka(d);
      const tekst = skrot(d.text);
      const pt = naPt((d.fontSize || 0) * Math.abs(d.scaleY ?? 1));
      if (pt && pt < MIN_PT - 0.05) dodaj(s, tt('komiks.kontrolaMalyTekst', { nr, tekst, pt: Math.round(pt * 10) / 10, min: MIN_PT }), d.id);
      if (r.x1 < 0 || r.y1 < 0 || r.x2 > s.w || r.y2 > s.h) dodaj(s, tt('komiks.kontrolaPozaStrona', { nr, tekst }), d.id);
      else if (kadry.filter((k) => zachodzi(r, k.r)).length > 1) dodaj(s, tt('komiks.kontrolaNaDwochKadrach', { nr, tekst }), d.id);
      const og = d.dymek.ogonek;
      if (og && kadry.length) {
        const p = { x: (d.left || 0) + og.x * Math.abs(d.scaleX ?? 1), y: (d.top || 0) + og.y * Math.abs(d.scaleY ?? 1) };
        if (!kadry.some((k) => wewnatrz(p, k.r))) dodaj(s, tt('komiks.kontrolaOgonek', { nr, tekst }), d.id);
      }
    }
    // Puste kadry: bez obrazu w kadrze i bez obrazu leżącego na kadrze.
    const puste = kadry.filter((k) => !k.o.zasob && !obrazy.some((r) => zachodzi(r, k.r, 5))).map((k) => k.o.kadr_nr).sort((a, b) => a - b);
    if (puste.length) dodaj(s, tt('komiks.kontrolaPusteKadry', { nr, ile: puste.length, lista: puste.join(', ') }));
  }
  return uwagi;
}
