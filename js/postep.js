// Wskaźnik postępu dłuższych czynności (otwieranie projektu, wgrywanie obrazów, miniatury, porządkowanie,
// wczytywanie pliku, wysyłka obrazów na konto). Jeden wspólny wygląd: karta u góry ekranu z opisem,
// licznikiem („12 z 48”) albo samym ruchomym paskiem, gdy nie wiadomo, ile zostało; opcjonalnie „Anuluj”.
//
// Nie blokuje pracy – to nie okno. Pojawia się dopiero po chwili (domyślnie 0,4 s), więc szybkie czynności
// nie mrugają. Gdy otwarte jest okno dialogowe (warstwa nad stroną), karta przechodzi do niego, żeby była
// widoczna nad nim. Kilka czynności naraz – kilka kart jedna pod drugą.
//
// Użycie:
//   const p = postep('Wgrywanie obrazów', { razem: 48, anuluj: () => { przerwij = true; } });
//   p.krok(12);            // 12 z 48
//   p.opis('Pakowanie…');  // zmiana opisu
//   p.koniec();            // znika (także po błędzie – w finally)
//   await zPostepem('Otwieranie projektu…', () => otworz());  // bez licznika

// Krótkie czynności (poniżej ~0,3 s) nie pokazują karty wcale – nic nie mruga (#159).
const OPOZNIENIE = 300;

let host = null;
function dajHost() {
  if (!host) {
    host = document.createElement('div');
    host.className = 'postepy';
    host.setAttribute('aria-live', 'polite');
  }
  // Nad otwartym oknem modalnym widać tylko to, co jest w nim – karta idzie do najwyżej położonego okna.
  const okna = [...document.querySelectorAll('dialog[open]')];
  const rodzic = okna.at(-1) || document.body;
  if (host.parentElement !== rodzic) rodzic.append(host);
  // Karta nie zasłania pływającego paska narzędzi edytora (telefon, #159) – stoi tuż pod nim.
  const pasek = rodzic === document.body && document.body.dataset.ekran === 'edytor' ? document.querySelector('#pasek-narzedzi') : null;
  const r = pasek?.offsetParent ? pasek.getBoundingClientRect() : null;
  host.style.top = r && r.bottom > 0 && r.top < window.innerHeight / 2 ? `${Math.round(r.bottom + 8)}px` : '';
  return host;
}

// procent: licznik jako „37%” zamiast „12 z 48” (np. gdy liczy się bajty, a nie strony).
export function postep(tekst, { razem = null, anuluj = null, opoznienie = OPOZNIENIE, procent = false } = {}) {
  const el = document.createElement('div');
  el.className = 'postep';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="postep-wiersz"><span class="postep-opis"></span><span class="postep-licznik"></span></div>
    <div class="postep-pasek"><div class="postep-wypelnienie"></div></div>`;
  const opisEl = el.querySelector('.postep-opis');
  const licznikEl = el.querySelector('.postep-licznik');
  const wypelnienie = el.querySelector('.postep-wypelnienie');
  // Pasek dla czytników ekranu: role=progressbar z wartością (bez wartości – czynność bez znanej długości).
  const pasekEl = el.querySelector('.postep-pasek');
  pasekEl.setAttribute('role', 'progressbar');
  pasekEl.setAttribute('aria-valuemin', '0');
  pasekEl.setAttribute('aria-valuemax', '100');
  if (anuluj) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'postep-anuluj';
    b.textContent = 'Anuluj';
    b.addEventListener('click', () => { b.disabled = true; opisEl.textContent = 'Przerywanie…'; anuluj(); });
    el.querySelector('.postep-wiersz').append(b);
  }
  let zrobione = 0;
  let calosc = razem;
  let zakonczony = false;
  const odswiez = () => {
    const znany = Number.isFinite(calosc) && calosc > 0;
    el.classList.toggle('nieokreslony', !znany);
    const pr = znany ? Math.round((Math.min(zrobione, calosc) / calosc) * 100) : null;
    licznikEl.textContent = !znany ? '' : procent ? `${pr}%` : `${Math.min(zrobione, calosc)} z ${calosc}`;
    wypelnienie.style.width = znany ? `${pr}%` : '';
    if (znany) pasekEl.setAttribute('aria-valuenow', String(pr)); else pasekEl.removeAttribute('aria-valuenow');
    pasekEl.setAttribute('aria-valuetext', licznikEl.textContent || 'w toku');
    if (el.isConnected) dajHost();
    if (opisEl.textContent) naEkranieStartu();
  };
  const ustawOpis = (t) => { opisEl.textContent = t; pasekEl.setAttribute('aria-label', t); naEkranieStartu(); };
  // W trakcie uruchamiania (#170) karta jest pod ekranem startowym – opis czynności idzie na ekran startowy.
  function naEkranieStartu() {
    if (!document.body.classList.contains('startuje')) return;
    const p = document.querySelector('#ekran-start .ciche');
    if (p) p.textContent = `${opisEl.textContent}${licznikEl.textContent ? ` ${licznikEl.textContent}` : ''}`;
  }
  ustawOpis(tekst);
  odswiez();
  const pokaz = setTimeout(() => { if (!zakonczony) { dajHost().append(el); el.dataset.widoczny = ''; } }, opoznienie);
  return {
    krok(n = zrobione + 1, r = calosc) { zrobione = n; calosc = r; odswiez(); },
    razem(r) { calosc = r; odswiez(); },
    opis(t) { ustawOpis(t); },
    koniec() {
      zakonczony = true;
      clearTimeout(pokaz);
      el.remove();
      if (host && !host.children.length) host.remove();
    },
    get widoczny() { return el.isConnected; },
  };
}

// Czynność bez licznika: karta z ruchomym paskiem, gdy trwa dłużej niż chwilę.
export async function zPostepem(tekst, fn, opcje = {}) {
  const p = postep(tekst, opcje);
  try { return await fn(p); } finally { p.koniec(); }
}

// Czynność liczona naraz, bez przerw (np. zmiana formatu wszystkich stron): przeglądarka nie odświeży ekranu
// w trakcie, więc karta musi pojawić się przed nią. Pokazywana tylko, gdy czynność jest duża (np. dużo stron)
// – przy małej nie mruga (#159).
export async function przedDlugaCzynnoscia(tekst, duza, fn) {
  if (!duza) return fn();
  const p = postep(tekst, { opoznienie: 0 });
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  try { return await fn(); } finally { p.koniec(); }
}
