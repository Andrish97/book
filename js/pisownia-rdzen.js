// Sprawdzanie pisowni po polsku (#131C) – własny, mały silnik zgodny z plikami Hunspella, których używa
// słownik sjp.pl (js/zewnetrzne/slownik-pl/pl.aff i pl.dic): flagi jednoznakowe, przyrostki SFX z warunkiem
// i przedrostek PFX („nie”) łączony z przyrostkami. Działa w Web Workerze (js/pisownia-worker.js) i w Node (testy).

// Parsuje plik reguł. Zwraca { sfx: Map(dopisek → [reguła]), pfx: [reguła], try: 'litery', map: [['aą'], …] }.
export function wczytajReguly(aff) {
  const sfx = new Map();
  const pfx = [];
  let proby = '';
  const mapa = [];
  for (const linia of String(aff).split(/\r?\n/)) {
    const c = linia.trim().split(/\s+/);
    if (c[0] === 'TRY' && c[1]) proby = c[1];
    else if (c[0] === 'MAP' && c[1] && !/^\d+$/.test(c[1])) mapa.push(c[1]);
    else if ((c[0] === 'SFX' || c[0] === 'PFX') && c.length >= 5) {
      const [rodzaj, flaga, zdejmij, dopisek, warunek] = c;
      const r = {
        flaga,
        zdejmij: zdejmij === '0' ? '' : zdejmij,
        dopisek: dopisek === '0' ? '' : dopisek.split('/')[0],
        warunek: warunek === '.' ? null : new RegExp(rodzaj === 'SFX' ? `${warunek}$` : `^${warunek}`, 'u'),
      };
      if (rodzaj === 'SFX') {
        if (!sfx.has(r.dopisek)) sfx.set(r.dopisek, []);
        sfx.get(r.dopisek).push(r);
      } else pfx.push(r);
    }
  }
  const najdluzszy = Math.max(0, ...[...sfx.keys()].map((k) => k.length));
  return { sfx, pfx, proby, mapa, najdluzszy };
}

// Słownik: Map(słowo → flagi). Pierwsza linia pliku to liczba słów.
export function wczytajSlowa(dic) {
  const slowa = new Map();
  const tekst = String(dic);
  let i = tekst.indexOf('\n') + 1; // pomijamy liczbę na początku
  while (i < tekst.length) {
    let j = tekst.indexOf('\n', i);
    if (j < 0) j = tekst.length;
    const linia = tekst.slice(i, j).replace(/\r$/, '');
    i = j + 1;
    if (!linia) continue;
    const ukosnik = linia.indexOf('/');
    if (ukosnik < 0) slowa.set(linia, (slowa.get(linia) || ''));
    else {
      const s = linia.slice(0, ukosnik);
      slowa.set(s, (slowa.get(s) || '') + linia.slice(ukosnik + 1));
    }
  }
  return slowa;
}

export class Pisownia {
  constructor(aff, dic) {
    this.r = wczytajReguly(aff);
    this.slowa = wczytajSlowa(dic);
    this.wlasne = new Set();
  }

  dodajWlasne(lista) { for (const s of lista || []) if (s) this.wlasne.add(String(s).toLowerCase()); }

  // Czy forma jest w słowniku – wprost albo przez przyrostek (i ewentualnie przedrostek „nie”).
  _forma(w, wymagana = null) {
    const f = this.slowa.get(w);
    if (f !== undefined && (!wymagana || f.includes(wymagana))) return true;
    const { sfx, najdluzszy } = this.r;
    for (let n = Math.min(najdluzszy, w.length - 1); n >= 0; n -= 1) {
      const reguly = sfx.get(n ? w.slice(-n) : '');
      if (!reguly) continue;
      const rdzen = w.slice(0, w.length - n);
      for (const r of reguly) {
        const temat = rdzen + r.zdejmij;
        if (!temat) continue;
        if (r.warunek && !r.warunek.test(temat)) continue;
        const ft = this.slowa.get(temat);
        if (ft && ft.includes(r.flaga) && (!wymagana || ft.includes(wymagana))) return true;
      }
    }
    return false;
  }

  _poprawneDokladnie(w) {
    if (this._forma(w)) return true;
    for (const p of this.r.pfx) {
      if (!p.dopisek || !w.startsWith(p.dopisek)) continue;
      const reszta = p.zdejmij + w.slice(p.dopisek.length);
      if (reszta && (!p.warunek || p.warunek.test(reszta)) && this._forma(reszta, p.flaga)) return true;
    }
    return false;
  }

  // Słowo poprawne? Wielkość liter: „Kraków” w słowniku – tylko z wielkiej; „dom” – też „Dom” i „DOM”.
  poprawne(slowo) {
    const w = String(slowo || '').replace(/[’']/g, "'");
    if (!w) return true;
    if (this.wlasne.has(w.toLowerCase())) return true;
    if (this._poprawneDokladnie(w)) return true;
    const male = w.toLowerCase();
    if (w !== male) {
      const zWielkiej = male[0].toUpperCase() + male.slice(1);
      if (w === zWielkiej || w === w.toUpperCase()) {
        if (this._poprawneDokladnie(male)) return true;
        if (w === w.toUpperCase() && this._poprawneDokladnie(zWielkiej)) return true;
      }
    }
    // Słowa z łącznikiem: każda część osobno („biało-czerwony”).
    if (w.includes('-')) return w.split('-').every((cz) => !cz || this.poprawne(cz));
    return false;
  }

  // Podpowiedzi: najpierw brakujące ogonki (MAP), potem jedna literówka (zamiana, brak, nadmiar, przestawienie).
  podpowiedzi(slowo, ile = 6) {
    const w = String(slowo || '');
    if (!w) return [];
    const wielka = w[0] !== w[0].toLowerCase();
    const male = w.toLowerCase();
    const wynik = [];
    const dodaj = (k) => {
      if (k === male || wynik.includes(k) || wynik.length >= ile * 3) return;
      if (this._poprawneDokladnie(k)) wynik.push(k);
    };
    // Ogonki: każda litera zamieniona na warianty z grupy MAP (także kilka naraz, do 3 miejsc).
    const grupa = (z) => this.r.mapa.find((g) => g.includes(z));
    const miejsca = [...male].map((z, i) => [i, grupa(z)]).filter(([, g]) => g);
    const zOgonkami = (s, od, glebokosc) => {
      if (glebokosc > 4) return;
      for (let k = od; k < miejsca.length; k += 1) {
        const [i, g] = miejsca[k];
        for (const z of g) {
          if (z === s[i]) continue;
          const nowy = s.slice(0, i) + z + s.slice(i + 1);
          dodaj(nowy);
          zOgonkami(nowy, k + 1, glebokosc + 1);
        }
      }
    };
    zOgonkami(male, 0, 1);
    // Rozdzielenie na dwa słowa („wogóle” → „w ogóle”).
    for (let i = 1; i < male.length; i += 1) {
      const a = male.slice(0, i);
      const b = male.slice(i);
      if (this._poprawneDokladnie(a) && this._poprawneDokladnie(b) && wynik.length < ile * 3) wynik.push(`${a} ${b}`);
    }
    const litery = this.r.proby.toLowerCase().replace(/[^\p{L}]/gu, '').split('').filter((z, i, a) => a.indexOf(z) === i);
    // Kolejność od najczęstszych pomyłek: przestawienie, brakująca litera, zbędna litera, zła litera.
    for (let i = 0; i < male.length - 1; i += 1) dodaj(male.slice(0, i) + male[i + 1] + male[i] + male.slice(i + 2));
    for (let i = 0; i <= male.length; i += 1) for (const z of litery) dodaj(male.slice(0, i) + z + male.slice(i));
    for (let i = 0; i < male.length; i += 1) dodaj(male.slice(0, i) + male.slice(i + 1));
    for (let i = 0; i < male.length; i += 1) for (const z of litery) dodaj(male.slice(0, i) + z + male.slice(i + 1));
    return wynik.slice(0, ile).map((k) => (wielka ? k[0].toUpperCase() + k.slice(1) : k));
  }
}

// Słowa do sprawdzenia w tekście: [{ start, koniec, slowo }]. Pomija pola {…}, liczby, adresy (www, @, ://),
// słowa z cyframi, słowa spoza alfabetu łacińskiego i pojedyncze litery.
export function slowaWTekscie(tekst) {
  const t = String(tekst || '');
  const pomin = [];
  for (const m of t.matchAll(/\{[^{}\n]*\}|\S*(?:https?:\/\/|www\.|@)\S*/giu)) pomin.push([m.index, m.index + m[0].length]);
  const wynik = [];
  for (const m of t.matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)) {
    const start = m.index;
    const koniec = start + m[0].length;
    if (m[0].length < 2 || /\p{N}/u.test(m[0])) continue;
    // Słownik jest polski: słowa w innym piśmie (np. ukraińskie dymki komiksu cyrylicą) nie są błędami (#368).
    if (/[^\p{Script=Latin}\-'’]/u.test(m[0])) continue;
    if (pomin.some(([a, b]) => start < b && koniec > a)) continue;
    wynik.push({ start, koniec, slowo: m[0] });
  }
  return wynik;
}
