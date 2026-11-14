// Tryb urządzenia na <html> – jedno źródło dla CSS i JS (zamiast powtarzania zapytań o ekran w wielu miejscach).
// Wzorem Familiady (web/shared/js/core/page-boot.js, device-attrs.js), dostosowane do Makietki.
//
//   data-urzadzenie  telefon | tablet | komputer    rodzaj urządzenia: dotyk + krótszy bok ekranu < 700 px
//                                                   to telefon, dotyk przy większym ekranie – tablet
//   data-orientacja  pion | poziom                  ułożenie okna (przy otwartej klawiaturze – ułożenie ekranu,
//                                                   bo klawiatura obniża okno i telefon w pionie wyglądałby na poziomy)
//   data-uklad       telefon-pion | telefon-poziom | tablet-pion | tablet-poziom | komputer | komputer-waski |
//                    komputer-duzy                  tryb układu, z którego korzysta CSS (komputer-waski: okno do
//                                                   860 px – układ jak na tablecie w pionie; komputer-duzy: od 1680 px)
//   data-dotyk       główny wskaźnik to palec (telefon, tablet); większe cele dotyku
//   data-zaslonka    okna dialogowe wyjeżdżają od dołu jako zasłonki: dotyk ALBO okno do 600 px szerokości
//   data-kompakt     układ telefonu: okno do 600 px szerokości (zasłonki na całą szerokość)
//   data-klawiatura  klawiatura ekranowa otwarta (dotyk, aktywne pole); --klawiatura-h: jej wysokość
//
// Początkowe atrybuty ustawia skrypt w <head> index.html (przed pierwszym rysowaniem – bez mignięcia układu);
// ten moduł je aktualizuje przy obróceniu, zmianie rozmiaru okna i otwarciu klawiatury. Przy zmianie trybu
// idzie zdarzenie „urzadzenie” (detail: tryb).

export const WASKI_MAKS = 600; // okno telefonu: zasłonki na całą szerokość
export const PANELE_MAKS = 860; // do tej szerokości panele edytora są arkuszami z dołu (telefon, tablet w pionie)
export const DUZY_OD = 1680;
const TELEFON_KROTSZY_BOK = 700;
const KLAWIATURA_MIN = 120;

const dotykMq = window.matchMedia('(pointer: coarse)');

const edytowalne = (el) => Boolean(el && el !== document.body && (el.isContentEditable
  || /^(TEXTAREA|SELECT)$/.test(el.tagName)
  || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/i.test(el.type || ''))));

// Pełna wysokość okna bez klawiatury (zapamiętana dla bieżącej szerokości).
let pelne = { szer: 0, wys: 0 };
function wysokoscKlawiatury(dotyk) {
  const vv = window.visualViewport;
  const wys = Math.min(window.innerHeight, vv ? vv.height : window.innerHeight);
  if (window.innerWidth !== pelne.szer) pelne = { szer: window.innerWidth, wys };
  if (!edytowalne(document.activeElement) || wys > pelne.wys) pelne.wys = Math.max(pelne.wys, wys);
  if (!dotyk || !edytowalne(document.activeElement)) return 0;
  const zakryte = pelne.wys - wys;
  return zakryte > KLAWIATURA_MIN ? Math.round(zakryte) : 0;
}

export function urzadzenie() {
  const dotyk = dotykMq.matches;
  const ekranW = window.screen?.width || window.innerWidth;
  const ekranH = window.screen?.height || window.innerHeight;
  const rodzaj = dotyk ? (Math.min(ekranW, ekranH) < TELEFON_KROTSZY_BOK ? 'telefon' : 'tablet') : 'komputer';
  const klawiatura = wysokoscKlawiatury(dotyk);
  const typ = window.screen?.orientation?.type;
  const zEkranu = typ ? (typ.startsWith('landscape') ? 'poziom' : 'pion') : (ekranW >= ekranH ? 'poziom' : 'pion');
  const orientacja = dotyk && klawiatura ? zEkranu : (window.innerWidth >= window.innerHeight ? 'poziom' : 'pion');
  const szer = window.innerWidth;
  let uklad;
  if (rodzaj === 'komputer') uklad = szer <= PANELE_MAKS ? 'komputer-waski' : (szer >= DUZY_OD ? 'komputer-duzy' : 'komputer');
  else uklad = `${rodzaj}-${orientacja}`;
  const kompakt = szer <= WASKI_MAKS;
  return { rodzaj, orientacja, uklad, dotyk, kompakt, zaslonka: dotyk || kompakt, klawiatura };
}

export const czyZaslonka = () => urzadzenie().zaslonka;

let biezacy = null;
function ustaw() {
  const u = urzadzenie();
  const root = document.documentElement;
  root.dataset.urzadzenie = u.rodzaj;
  root.dataset.orientacja = u.orientacja;
  root.dataset.uklad = u.uklad;
  root.toggleAttribute('data-dotyk', u.dotyk);
  root.toggleAttribute('data-zaslonka', u.zaslonka);
  root.toggleAttribute('data-kompakt', u.kompakt);
  root.toggleAttribute('data-klawiatura', u.klawiatura > 0);
  root.style.setProperty('--klawiatura-h', `${u.klawiatura}px`);
  const zmiana = !biezacy || Object.keys(u).some((k) => u[k] !== biezacy[k]);
  biezacy = u;
  if (zmiana) document.dispatchEvent(new CustomEvent('urzadzenie', { detail: u }));
}

let czeka = false;
const pozniej = () => { if (czeka) return; czeka = true; requestAnimationFrame(() => { czeka = false; ustaw(); }); };

ustaw();
dotykMq.addEventListener('change', ustaw);
window.addEventListener('resize', pozniej);
window.addEventListener('orientationchange', pozniej);
window.visualViewport?.addEventListener('resize', pozniej);
document.addEventListener('focusin', pozniej);
document.addEventListener('focusout', () => setTimeout(pozniej, 300));
