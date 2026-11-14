// Zestaw ikon (SVG, kreska 24×24) rysowany na potrzeby aplikacji.

const P = {
  tekst: '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>',
  prostokat: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  pioro: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.500-7.500L2 2l3.500 14.500L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  rysuj: '<path d="M4 20c2.5-.4 3.8-1.8 4.2-3.6L18.5 6.1a2.1 2.1 0 0 0-3-3L5.2 13.4C3.6 14 3.2 16.500 4 20Z"/><path d="m14 5 3.500 3.500"/>',
  tabela: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18"/><path d="M3 14.5h18"/><path d="M9 5v14"/><path d="M15 5v14"/>',
  elipsa: '<ellipse cx="12" cy="12" rx="8" ry="6.5"/>',
  linia: '<path d="M5 19 19 5"/>',
  wielokat: '<path d="M12 4.5 20 19H4z"/>',
  obraz: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L6 19.5"/>',
  cofnij: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  ponow: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  kopiuj: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  kosz: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  grupuj: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="7" y="7" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
  rozgrupuj: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  naWierzch: '<path d="M5 3h14"/><path d="m8 11 4-4 4 4"/><path d="M12 7v14"/>',
  wyzej: '<path d="m7 11 5-5 5 5"/><path d="M12 6v13"/>',
  nizej: '<path d="m7 13 5 5 5-5"/><path d="M12 18V5"/>',
  naSpod: '<path d="M5 21h14"/><path d="m8 13 4 4 4-4"/><path d="M12 17V3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  'pelny-ekran': '<path d="M4 9V4h5"/><path d="M15 4h5v5"/><path d="M20 15v5h-5"/><path d="M9 20H4v-5"/>',
  'zwin-ekran': '<path d="M9 4v5H4"/><path d="M20 9h-5V4"/><path d="M15 20v-5h5"/><path d="M4 15h5v5"/>',
  dopasuj: '<path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/>',
  prowadnice: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="7" y="7" width="10" height="10" stroke-dasharray="2 2"/>',
  siatka: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M9.2 3.5v17"/><path d="M14.8 3.5v17"/><path d="M3.5 9.2h17"/><path d="M3.5 14.8h17"/>',
  warstwy: '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  format: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  pobierz: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  wyslij: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M4 4h16"/>',
  chmura: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.75 4.75 0 0 1-.5 9.5z"/>',
  chmuraOk: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.75 4.75 0 0 1-.5 9.5z"/><path d="m9.5 13 2 2 3.5-3.5"/>',
  chmuraOff: '<path d="M3 3l18 18"/><path d="M17.5 18H7a4.5 4.5 0 0 1-1.6-8.7"/><path d="M9.3 6.4A6 6 0 0 1 18 8.5a4.75 4.75 0 0 1 2.4 8.4"/>',
  wyloguj: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="m10 16-4-4 4-4"/><path d="M6 12h10"/>',
  wstecz: '<path d="m15 18-6-6 6-6"/>',
  dalej: '<path d="m9 18 6-6-6-6"/>',
  pomoc: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17.2" r=".4" fill="currentColor"/>',
  uwaga: '<path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.8" r=".4" fill="currentColor"/>',
  wiecej: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  strony: '<rect x="4" y="3" width="11" height="15" rx="1.5"/><path d="M9 21h9.5a1.5 1.5 0 0 0 1.5-1.5V8"/>',
  suwaki: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
  zamknij: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  oko: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  okoOff: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4"/><path d="M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1"/><path d="M10 10a2.8 2.8 0 0 0 4 4"/>',
  doLewej: '<path d="M4 6h16"/><path d="M4 10h10"/><path d="M4 14h16"/><path d="M4 18h10"/>',
  doSrodka: '<path d="M4 6h16"/><path d="M7 10h10"/><path d="M4 14h16"/><path d="M7 18h10"/>',
  doPrawej: '<path d="M4 6h16"/><path d="M10 10h10"/><path d="M4 14h16"/><path d="M10 18h10"/>',
  wyjustuj: '<path d="M4 6h16"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M4 18h16"/>',
  pogrubienie: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  kursywa: '<path d="M10 5h8"/><path d="M6 19h8"/><path d="M14 5 10 19"/>',
  ksiazka: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2z"/><path d="M12 6.5v14"/>',
  olowek: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="m14.5 7.5 3 3"/>',
  wzorzec: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 8h14"/><path d="M8.5 12h7M8.5 15.5h4.5" stroke-dasharray="2 2"/>',
  szukaj: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  dane: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><path d="M3.5 15h17"/><path d="M9.5 4v16"/>',
  pdf: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M12 11v6"/><path d="m9.5 14.5 2.5 2.5 2.5-2.5"/>',
  podkreslenie: '<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>',
  przekreslenie: '<path d="M4 12h16"/><path d="M16.5 7.5A4 4 0 0 0 12.5 5h-1.3a3.4 3.4 0 0 0-2.6 5.6"/><path d="M8 16.5a4 4 0 0 0 3.6 2.5h1.2a3.6 3.6 0 0 0 3.3-5"/>',
  wyrownajLewo: '<path d="M4 4v16"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
  wyrownajSrodekX: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  wyrownajPrawo: '<path d="M20 4v16"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
  wyrownajGora: '<path d="M4 4h16"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
  wyrownajSrodekY: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  wyrownajDol: '<path d="M4 20h16"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
  rozlozX: '<path d="M4 4v16"/><path d="M20 4v16"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>',
  rozlozY: '<path d="M4 4h16"/><path d="M4 20h16"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>',
  wklej: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 12h6"/><path d="M9 16h4"/>',
  motyw: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  koperta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  uzytkownik: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  klodka: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  klodkaOtwarta: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.6"/>',
  klucz: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2"/>',
  dlon: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v7"/><path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.8-2.4L4.6 15.4a1.6 1.6 0 0 1 2.4-2.1L8 14.5"/>',
};

export function ikona(nazwa, { rozmiar = 20, klasa = '' } = {}) {
  const tresc = P[nazwa];
  if (!tresc) throw new Error(`Brak ikony: ${nazwa}`);
  return `<svg class="ikona ${klasa}" width="${rozmiar}" height="${rozmiar}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tresc}</svg>`;
}

// Wstawia ikony w elementy z atrybutem data-ikona.
export function wstawIkony(korzen = document) {
  korzen.querySelectorAll('[data-ikona]').forEach((el) => {
    if (el.querySelector(':scope > svg.ikona')) return;
    el.insertAdjacentHTML('afterbegin', ikona(el.dataset.ikona, { rozmiar: Number(el.dataset.rozmiar) || 20 }));
  });
}
