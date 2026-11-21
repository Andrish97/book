// Publikacja linku (#335): co narysować i jak – wspólne dla aplikacji i rysowania na serwerze (rysuj.html).
// Układ linku, odciski stron (strona bez zmian nie jest rysowana), znak wodny wtopiony w obraz, obraz strony.
import { renderujCel } from './zlozenie.js';
import { rozwin } from './serie.js';
import { ukladProjektu, stronyUkladu } from './podglad.js';
import { opisMakiety } from './makieta-opis.js';
import { wzorceStrony } from './projekt.js';

// Skrót treści projektu – pozwala powiedzieć, czy link pokazuje aktualny stan.
export function skrot(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i += 1) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${tekst.length}-${(h >>> 0).toString(36)}`;
}
// 'm1' i projekt.makieta (#189): link idzie też za makietą 3D – a link sprzed #188 (bez opisu makiety) ma inny
// odcisk, więc przy najbliższym otwarciu projektu sam się uzupełnia (wysyła się tylko opis, strony się nie zmieniły).
export const odciskTresci = (projekt) => skrot(JSON.stringify(['m1', projekt.nazwa, projekt.sekcje, projekt.wzorce, projekt.strony, projekt.style, projekt.tabele, projekt.serie, projekt.czcionki, projekt.makieta || null, projekt.makieta_linku || null, projekt.znak_wodny || null]));

// Skrót wszystkiego, od czego zależy wygląd jednej strony wydruku. Strona o tym samym
// skrócie co przy poprzedniej aktualizacji linku nie jest rysowana ani wysyłana.
// Części wspólne wielu stron (wzorce, sekcja, treść strony powielanej serią, nazwy stron…) liczone raz na jedno
// rozwinięcie projektu (ciag) – wcześniej każda z setek stron przepisywała je od nowa i przy dużym projekcie
// każdy zapis zatrzymywał edytor na ułamek sekundy (zgłoszenie 21.11: „bardzo dużo rzeczy się zacina”, #343).
const pamiecOdciskow = new WeakMap(); // ciag → { wspolny, obiekt: WeakMap(obiekt → skrót) }
function skrotObiektu(pam, o) {
  if (o === undefined || o === null) return null;
  if (typeof o !== 'object') return o;
  let w = pam.obiekt.get(o);
  if (w === undefined) { w = skrot(JSON.stringify(o)); pam.obiekt.set(o, w); }
  return w;
}
function pamiecDla(projekt, ciag) {
  let pam = pamiecOdciskow.get(ciag);
  if (!pam || pam.projekt !== projekt) {
    pam = { projekt, obiekt: new WeakMap() };
    pam.wspolny = skrot(JSON.stringify([projekt.nazwa, ciag.liczbaStron, ciag.egzemplarze.length, projekt.czcionki,
      projekt.sekcje.map((s) => s.nazwa), projekt.strony.map((s) => s.nazwa), projekt.znak_wodny || null]));
    pamiecOdciskow.set(ciag, pam);
  }
  return pam;
}
export function pamiecOdciskowDla(projekt, ciag) { return pamiecDla(projekt, ciag); }
export const skrotCzesci = (pam, o) => skrotObiektu(pam, o);

export function odciskStrony(projekt, egz, ciag) {
  const pam = pamiecDla(projekt, ciag);
  const h = (o) => skrotObiektu(pam, o);
  const wzorce = wzorceStrony(projekt, egz.strona).map((w) => [h(w.obiekty), w.tlo, w.lustro]);
  return skrot(JSON.stringify([
    h(egz.strona.obiekty), egz.strona.tlo, h(egz.sasiad?.strona.obiekty), egz.sasiad?.wiersz, wzorce, h(egz.sekcja.wydruk), egz.sekcja.nazwa,
    egz.wiersz, egz.dodatkowe.map((d) => d.wiersz), egz.nr, egz.indeks, egz.nrWSekcji, egz.nrEgz, egz.ileEgz, egz.bok, pam.wspolny,
  ]));
}


// ---------- Znak wodny (#191) ----------
export const ZNAK_DOMYSLNY = 'PODGLĄD';
// Krycie (zgłoszenie 19.11: „watermark troszkę bladszy albo suwak przezroczystości”): 5–50 %, domyślnie 12 %
// (wcześniej na stałe ok. 24 % szarego napisu + 30 % białej obwódki – za mocny).
export const KRYCIE_ZNAKU = 12;
export const kryciaZnaku = (z) => Math.max(5, Math.min(50, Math.round(Number(z?.krycie) || KRYCIE_ZNAKU)));

// Obraz strony z napisem: ukośne rzędy tekstu na całej powierzchni, półprzezroczyste, z jasną obwódką –
// widoczne na jasnym i ciemnym tle. krycie – w procentach (szary napis; obwódka o 1/4 mocniejsza).
export function rysujZnak(g, w, h, tekst, krycie, rozmiarPx = null) {
  const a = Math.max(5, Math.min(50, krycie)) / 100;
  const rozmiar = rozmiarPx ?? Math.max(14, Math.round(Math.min(w, h) / 9));
  g.save();
  g.font = `700 ${rozmiar}px Inter, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const szer = g.measureText(tekst).width + rozmiar * 1.6;
  const krok = rozmiar * 3.2;
  const przekatna = Math.hypot(w, h);
  g.translate(w / 2, h / 2);
  g.rotate(-Math.atan2(h, w));
  g.lineWidth = Math.max(2, rozmiar / 10);
  g.strokeStyle = `rgba(255,255,255,${Math.min(1, a * 1.25).toFixed(3)})`;
  g.fillStyle = `rgba(60,60,60,${a.toFixed(3)})`;
  // Rzędy od środka strony (rząd przez środek zawsze jest) – na małym obrazie jedyny rząd nie wypada poza brzeg.
  const rzedy = Math.ceil(przekatna / 2 / krok);
  const wRzedzie = Math.ceil(przekatna / 2 / szer) + 1;
  for (let r = -rzedy; r <= rzedy; r += 1) {
    const y = r * krok;
    const przes = (Math.abs(r) % 2) * szer / 2;
    for (let i = -wRzedzie; i <= wRzedzie; i += 1) {
      const x = i * szer + przes;
      g.strokeText(tekst, x, y);
      g.fillText(tekst, x, y);
    }
  }
  g.restore();
}

export async function zeZnakiemWodnym(blob, tekst, krycie = KRYCIE_ZNAKU) {
  const obraz = await window.createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = obraz.width; c.height = obraz.height;
  const g = c.getContext('2d');
  g.drawImage(obraz, 0, 0);
  obraz.close?.();
  rysujZnak(g, c.width, c.height, tekst, krycie);
  return new Promise((ok) => { c.toBlob((b) => ok(b || blob), blob.type || 'image/jpeg', 0.85); });
}

let webp = null;
export const umieWebp = () => {
  if (webp === null) { const c = document.createElement('canvas'); c.width = 2; c.height = 2; webp = c.toDataURL('image/webp').startsWith('data:image/webp'); }
  return webp;
};


// Wszystko do publikacji linku: układ (z opisem makiety 3D), strony, odciski i funkcja rysująca obraz strony.
export function przygotujPublikacje(p, { szerokoscPx = 1200 } = {}) {
  const ciag = rozwin(p);
  const poKluczu = new Map(ciag.egzemplarze.map((e) => [e.klucz, e]));
  const uklad = ukladProjektu(p, ciag);
  // Makieta 3D dla oglądającego (#188): opis bryły i wariantu – bez treści stron (tekstury to obrazy linku).
  try { uklad.makieta = opisMakiety(p, ciag); } catch { /* bez makiety – link działa jak dawniej */ }
  const strony = stronyUkladu(uklad);
  const odciski = Object.fromEntries(strony.map((s) => [s.id, odciskStrony(p, poKluczu.get(s.id), ciag)]));
  // WebP: ten sam wygląd przy ok. 30–40% mniejszych plikach (#90); przeglądarka bez zapisu WebP – JPEG.
  const rozszerzenie = umieWebp() ? 'webp' : 'jpg';
  const obraz = async (s) => {
    const url = await renderujCel(p, poKluczu.get(s.id), { szerokoscPx, spad: false, ciag, ...(rozszerzenie === 'webp' ? { format: 'webp', jakosc: 0.8 } : { format: 'jpeg' }) });
    const blob = await (await fetch(url)).blob();
    return p.znak_wodny ? zeZnakiemWodnym(blob, p.znak_wodny.tekst, kryciaZnaku(p.znak_wodny)) : blob;
  };
  return { ciag, uklad, strony, odciski, rozszerzenie, obraz, odcisk: odciskTresci(p) };
}
