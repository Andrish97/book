// Sekcja „Miejsce” w ustawieniach konta (#89): zajętość plików całej aplikacji z Twoim udziałem, rozbicie
// Twoich plików i „Posprzątaj…” z podsumowaniem przed usunięciem.

import { $, potwierdz } from './ui.js';
import {
  miejsce, planSprzatania, posprzataj, rozmiar, udzialPlikow, udzialBazy, ostrzezenie,
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
  const razem = $('#miejsce-razem');
  if (!razem) return;
  let m;
  try { m = await miejsce({ swieze }); } catch {
    razem.textContent = 'Nie udało się sprawdzić – brak połączenia z kontem.';
    return;
  }
  const limit = liczba(m.limit_plikow) || 1;
  const moje = Math.min(liczba(m.obrazy) + liczba(m.czcionki) + liczba(m.podglady), liczba(m.pliki_razem));
  const inne = Math.max(0, liczba(m.pliki_razem) - moje);
  razem.textContent = `${rozmiar(m.pliki_razem)} z ${rozmiar(limit)} (${procent(udzialPlikow(m))})`;
  $('#miejsce-pasek-moje').style.width = `${Math.min(100, (moje / limit) * 100)}%`;
  $('#miejsce-pasek-inne').style.width = `${Math.min(100, (inne / limit) * 100)}%`;
  $('#miejsce-aplikacji .miejsce-pasek').setAttribute('aria-valuenow', String(Math.round(udzialPlikow(m) * 100)));
  $('#miejsce-moje-opis').textContent = `Twoje pliki: ${rozmiar(moje)}`;
  $('#miejsce-baza').textContent = m.baza_razem != null
    ? `Baza danych aplikacji: ${rozmiar(m.baza_razem)} z ${rozmiar(m.limit_bazy)} (${procent(udzialBazy(m))}).`
    : '';
  const tekst = ostrzezenie(m);
  $('#miejsce-ostrzezenie').hidden = !tekst;
  $('#miejsce-ostrzezenie').textContent = tekst || '';
  $('#miejsce-aplikacji').classList.toggle('wysoko', Boolean(tekst));
  $('#miejsce-obrazy').textContent = rozmiar(m.obrazy);
  $('#miejsce-czcionki').textContent = rozmiar(m.czcionki);
  $('#miejsce-podglady').textContent = rozmiar(liczba(m.podglady) + liczba(m.chronione));
  $('#miejsce-od-ai').textContent = rozmiar(m.od_ai);
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
    await posprzataj(plan);
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
