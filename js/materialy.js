// Materiały i wykończenie okładki (#214) – według tego, co zwykle oferują drukarnie i introligatornie:
//  • okładka drukowana (karton/papier z nadrukiem) z folią: matową, błyszczącą, soft-touch albo bez folii,
//  • okleiny twardej oprawy bez nadruku: płótno introligatorskie, skóra ekologiczna, papier strukturalny, aksamit
//    – w typowych kolorach (zdobienia na nich: złocenie i tłoczenie – uszlachetnienia elementów, #127),
//  • zaokrąglone rogi (narożniki) – zwykle 3, 5, 6 albo 10 mm.
// Okleina bez nadruku: grafika okładki nie drukuje się – zostają elementy z uszlachetnieniem (złocenie, tłoczenie).

export const MATERIALY = {
  druk: { nazwa: 'Okładka drukowana', opis: 'Karton z nadrukiem, zwykle foliowany.', druk: true, kolory: [] },
  plotno: {
    nazwa: 'Płótno introligatorskie', opis: 'Tkanina na tekturze; zdobienia – złocenie albo tłoczenie.', druk: false, ziarno: 'tkanina',
    kolory: [['#1f2a44', 'Granatowe'], ['#6d1a24', 'Bordowe'], ['#20402f', 'Butelkowa zieleń'], ['#1b1b1b', 'Czarne'], ['#7a7a76', 'Szare'], ['#cdbf9f', 'Lniane (beż)'], ['#8a5a2b', 'Brązowe']],
  },
  skora: {
    nazwa: 'Skóra ekologiczna', opis: 'Okleina skóropodobna z fakturą; zdobienia – złocenie albo tłoczenie.', druk: false, ziarno: 'skora',
    kolory: [['#15130f', 'Czarna'], ['#4a2c1a', 'Brązowa'], ['#8a4b22', 'Koniakowa'], ['#5c1622', 'Bordowa'], ['#1d2840', 'Granatowa'], ['#ece3cf', 'Kremowa']],
  },
  papier_strukturalny: {
    nazwa: 'Papier strukturalny', opis: 'Papier ozdobny z fakturą (np. len, skóra, kora).', druk: false, ziarno: 'papier',
    kolory: [['#f2ede1', 'Kremowy'], ['#ffffff', 'Biały'], ['#2a2a2a', 'Grafitowy'], ['#9b2335', 'Malinowy'], ['#2f4a3a', 'Zielony']],
  },
  aksamit: {
    nazwa: 'Aksamit (welur)', opis: 'Miękka okleina z meszkiem – albumy ślubne i pamiątkowe.', druk: false, ziarno: 'aksamit',
    kolory: [['#4b1028', 'Burgund'], ['#13213f', 'Granat'], ['#e9dccb', 'Kość słoniowa'], ['#1a1a1a', 'Czarny']],
  },
};
export const FOLIE_OKLADKI = { mat: 'Folia matowa', blysk: 'Folia błyszcząca', soft: 'Folia soft-touch (aksamitna w dotyku)', brak: 'Bez folii' };
export const ROGI = [0, 3, 5, 6, 10];

export function normalizujWykonczenie(w) {
  if (!w || typeof w !== 'object') return null;
  const material = MATERIALY[w.material] ? w.material : 'druk';
  const kolor = /^#[0-9a-f]{6}$/i.test(w.kolor || '') ? w.kolor.toLowerCase() : (MATERIALY[material].kolory[0]?.[0] || null);
  const wynik = {
    material,
    ...(material === 'druk' ? { folia: FOLIE_OKLADKI[w.folia] ? w.folia : 'mat' } : { kolor }),
    rogi_mm: Math.max(0, Math.min(20, Number(w.rogi_mm) || 0)),
  };
  return material === 'druk' && wynik.folia === 'mat' && !wynik.rogi_mm ? null : wynik; // domyślne – bez pola
}

// Opis do specyfikacji i podpowiedzi: „Płótno introligatorskie – Granatowe, rogi zaokrąglone 5 mm”.
export function opisWykonczenia(w) {
  if (!w) return 'Okładka drukowana, folia matowa';
  const m = MATERIALY[w.material] || MATERIALY.druk;
  const kolor = m.kolory.find(([k]) => k === w.kolor)?.[1] || w.kolor;
  const czesci = [w.material === 'druk' ? `${m.nazwa}, ${FOLIE_OKLADKI[w.folia || 'mat'].toLowerCase()}` : `${m.nazwa} – ${kolor}`];
  if (w.rogi_mm) czesci.push(`rogi zaokrąglone ${String(w.rogi_mm).replace('.', ',')} mm`);
  return czesci.join(', ');
}

// Tekstura okleiny do makiety 3D: kolor z fakturą (tkanina, skóra, papier, meszek) na płótnie w × h px.
export function teksturaOkleiny(w, szer, wys) {
  const m = MATERIALY[w?.material];
  if (!m || m.druk) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(szer));
  c.height = Math.max(2, Math.round(wys));
  const g = c.getContext('2d');
  g.fillStyle = w.kolor || m.kolory[0][0];
  g.fillRect(0, 0, c.width, c.height);
  // Faktura: deterministyczny szum (to samo przy każdym rysowaniu).
  let ziarno = 12345;
  const los = () => { ziarno = (ziarno * 1103515245 + 12345) & 0x7fffffff; return ziarno / 0x7fffffff; };
  const jasny = (a) => `rgba(255,255,255,${a})`;
  const ciemny = (a) => `rgba(0,0,0,${a})`;
  if (m.ziarno === 'tkanina') {
    for (let y = 0; y < c.height; y += 2) { g.fillStyle = y % 4 ? jasny(0.05) : ciemny(0.06); g.fillRect(0, y, c.width, 1); }
    for (let x = 0; x < c.width; x += 2) { g.fillStyle = x % 4 ? jasny(0.04) : ciemny(0.05); g.fillRect(x, 0, 1, c.height); }
  } else {
    const ile = Math.round((c.width * c.height) / (m.ziarno === 'aksamit' ? 30 : 12));
    for (let i = 0; i < ile; i += 1) {
      const x = los() * c.width;
      const y = los() * c.height;
      const r = m.ziarno === 'skora' ? 1 + los() * 2.5 : 0.8;
      g.fillStyle = los() > 0.5 ? jasny(m.ziarno === 'aksamit' ? 0.04 : 0.07) : ciemny(m.ziarno === 'aksamit' ? 0.05 : 0.09);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
  if (m.ziarno === 'aksamit') {
    const gr = g.createLinearGradient(0, 0, c.width, c.height);
    gr.addColorStop(0, jasny(0.08)); gr.addColorStop(1, ciemny(0.12));
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  }
  return c;
}
