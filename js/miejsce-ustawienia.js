// Sekcja „Miejsce” w ustawieniach konta (#90, #92, #100): Twoje pliki wobec limitu konta, projekty wobec limitu,
// rozbicie Twoich plików i „Posprzątaj…”. Bez danych całej aplikacji – te są tylko w panelu administratora.

import { $, potwierdz } from './ui.js';
import { postep } from './postep.js';
import {
  miejsce, planSprzatania, posprzataj, rozmiar, udzialKonta, ostrzezenie,
} from './miejsce.js';

const procent = (x) => `${(Math.min(100, Math.round(x * 1000) / 10)).toLocaleString('pl-PL')}%`;
const liczba = (x) => Number(x) || 0;
const pliki = (n) => {
  if (n === 1) return 'plik';
  const j = n % 10;
  const d = n % 100;
  return j >= 2 && j <= 4 && (d < 12 || d > 14) ? 'pliki' : 'plików';
};

export async function pokazMiejsce({ swieze = true } = {}) {
  const konto = $('#miejsce-konto');
  if (!konto) return;
  let m;
  try { m = await miejsce({ swieze }); } catch {
    konto.textContent = 'Nie udało się sprawdzić – brak połączenia z kontem.';
    return;
  }
  konto.textContent = `${rozmiar(m.konto)} z ${rozmiar(m.limit_konta)} (${procent(udzialKonta(m))})`;
  $('#miejsce-pasek-konta').style.width = `${Math.min(100, udzialKonta(m) * 100)}%`;
  $('#miejsce-konta .miejsce-pasek').setAttribute('aria-valuenow', String(Math.round(udzialKonta(m) * 100)));
  $('#miejsce-limity').textContent = `Projekty: ${liczba(m.projekty)} z ${liczba(m.limit_projektow)}. Jeden plik – najwyżej ${rozmiar(m.limit_pliku)}, w jednym projekcie najwyżej ${liczba(m.obrazy_w_projekcie)} obrazów i ${liczba(m.osoby_w_projekcie)} osób do współpracy.`;
  const tekst = ostrzezenie(m);
  $('#miejsce-ostrzezenie').hidden = !tekst;
  $('#miejsce-ostrzezenie').textContent = tekst || '';
  $('#miejsce-konta').classList.toggle('wysoko', Boolean(tekst));
  $('#miejsce-obrazy').textContent = rozmiar(m.obrazy);
  $('#miejsce-czcionki').textContent = rozmiar(m.czcionki);
  $('#miejsce-podglady').textContent = rozmiar(liczba(m.podglady) + liczba(m.chronione));
  $('#miejsce-od-ai').textContent = rozmiar(m.od_ai);
  import('./uzycie-konta.js').then((u) => u.pokazUzycie(m)).catch(() => {});
}

let trwa = false;
async function sprzataj() {
  if (trwa) return;
  trwa = true;
  const przycisk = $('#miejsce-posprzataj');
  const komunikat = $('#miejsce-komunikat');
  przycisk.disabled = true;
  komunikat.textContent = 'Sprawdzam, co można usunąć…';
  try {
    const plan = await planSprzatania();
    if (!plan.ile) { komunikat.textContent = 'Nie ma czego sprzątać – każdy plik na koncie jest używany.'; return; }
    const tak = await potwierdz(
      'Posprzątać konto?',
      `Usunę ${plan.ile} ${pliki(plan.ile)}, których żaden projekt nie używa – zwolni się ${rozmiar(plan.bajty)}. Projektów, obrazów na stronach ani czcionek to nie zmienia.`,
      'Posprzątaj',
    );
    if (!tak) { komunikat.textContent = ''; return; }
    komunikat.textContent = 'Sprzątam…';
    const karta = postep('Sprzątanie konta', { razem: plan.ile });
    try { await posprzataj(plan, (gotowe) => karta.krok(gotowe)); } finally { karta.koniec(); }
    komunikat.textContent = `Posprzątane – zwolniono ${rozmiar(plan.bajty)}.`;
    await pokazMiejsce();
  } catch (e) {
    komunikat.textContent = `Nie udało się posprzątać: ${e.message}`;
  } finally {
    trwa = false;
    przycisk.disabled = false;
  }
}

$('#miejsce-posprzataj')?.addEventListener('click', sprzataj);
