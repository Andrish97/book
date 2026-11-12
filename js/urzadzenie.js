// Rodzaj urządzenia na <html> – jedno źródło dla CSS i JS (zamiast powtarzania zapytań o ekran w wielu miejscach).
//
//   data-dotyk      główny wskaźnik to palec (telefon, tablet); większe cele dotyku
//   data-zaslonka   okna dialogowe wyjeżdżają od dołu jako zasłonki: dotyk ALBO okno do 600 px szerokości
//   data-kompakt    układ telefonu: okno do 600 px szerokości (zasłonki na całą szerokość)
//
// Na komputerze (mysz, szersze okno) żadnego z atrybutów nie ma – okna są zwykłymi oknami na środku.
// Atrybuty zmieniają się przy obróceniu urządzenia i zmianie rozmiaru okna; wtedy idzie zdarzenie
// „urzadzenie” (detail: { dotyk, zaslonka, kompakt }).

export const WASKI_MAKS = 600;

const dotykMq = window.matchMedia('(pointer: coarse)');
const waskiMq = window.matchMedia(`(max-width: ${WASKI_MAKS}px)`);

let biezacy = null;

export function urzadzenie() {
  const dotyk = dotykMq.matches;
  const kompakt = waskiMq.matches;
  return { dotyk, kompakt, zaslonka: dotyk || kompakt };
}

export const czyZaslonka = () => urzadzenie().zaslonka;

function ustaw() {
  const u = urzadzenie();
  const root = document.documentElement;
  root.toggleAttribute('data-dotyk', u.dotyk);
  root.toggleAttribute('data-zaslonka', u.zaslonka);
  root.toggleAttribute('data-kompakt', u.kompakt);
  const zmiana = !biezacy || Object.keys(u).some((k) => u[k] !== biezacy[k]);
  biezacy = u;
  if (zmiana) document.dispatchEvent(new CustomEvent('urzadzenie', { detail: u }));
}

ustaw();
dotykMq.addEventListener('change', ustaw);
waskiMq.addEventListener('change', ustaw);
window.addEventListener('orientationchange', ustaw);
