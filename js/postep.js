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

const OPOZNIENIE = 400;

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
  return host;
}

export function postep(tekst, { razem = null, anuluj = null, opoznienie = OPOZNIENIE } = {}) {
  const el = document.createElement('div');
  el.className = 'postep';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="postep-wiersz"><span class="postep-opis"></span><span class="postep-licznik"></span></div>
    <div class="postep-pasek"><div class="postep-wypelnienie"></div></div>`;
  const opisEl = el.querySelector('.postep-opis');
  const licznikEl = el.querySelector('.postep-licznik');
  const wypelnienie = el.querySelector('.postep-wypelnienie');
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
    licznikEl.textContent = znany ? `${Math.min(zrobione, calosc)} z ${calosc}` : '';
    wypelnienie.style.width = znany ? `${Math.round((Math.min(zrobione, calosc) / calosc) * 100)}%` : '';
    if (el.isConnected) dajHost();
  };
  opisEl.textContent = tekst;
  odswiez();
  const pokaz = setTimeout(() => { if (!zakonczony) { dajHost().append(el); el.dataset.widoczny = ''; } }, opoznienie);
  return {
    krok(n = zrobione + 1, r = calosc) { zrobione = n; calosc = r; odswiez(); },
    razem(r) { calosc = r; odswiez(); },
    opis(t) { opisEl.textContent = t; },
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
