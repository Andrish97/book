// Sejf kluczy AI w aplikacji (#241): okno hasła do kluczy, otwieranie sejfu konta (raz naraz) i przeniesienie kluczy
// zapisanych dawniej jawnie w pamięci przeglądarki. Używa go czat AI (js/app/czat-ai.js) i okno „Sztuczna
// inteligencja” w ustawieniach konta (js/app/dostep-ai.js). Szyfrowanie – js/sejf-kluczy.js.

import { $, powiadom } from '../ui.js';
import * as chmura from '../chmura.js';
import { utworzSejf } from '../sejf-kluczy.js';
import { stan } from './kontekst.js';
import { t } from '../jezyk.js';

const PAMIEC = 'makietka-czat-ai';
const czytaj = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const zapisz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bez pamięci */ } };
const ustawienia = () => czytaj(PAMIEC, { dostawca: 'anthropic', rola: 'edycja', dostawcy: {} });

// ---------- Sejf kluczy (#241) ----------

let sejf = null;
let kontoSejfu = null;
// Sejf zalogowanego konta (null bez logowania).
export function sejfKonta() {
  const id = stan.uzytkownik?.id;
  if (!id) return null;
  if (!sejf || kontoSejfu !== id) { sejf = utworzSejf(chmura, id); kontoSejfu = id; }
  return sejf;
}

// Okno hasła do kluczy: założenie sejfu albo otwarcie go na tym urządzeniu. Zwraca true, gdy sejf jest otwarty.
function oknoSejfu(tryb) {
  let dlg = $('#dlg-sejf-ai');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-sejf-ai';
    dlg.innerHTML = `<form method="dialog" class="formularz"><h2></h2>
      <p class="ciche">Klucze API szyfruje Twoja przeglądarka tym hasłem, zanim trafią na konto. Na serwerze leży tylko zaszyfrowany zapis – bez hasła nie odczyta go nikt poza Tobą, nawet administratorzy Makietki. Hasło znasz tylko Ty: zgubione – klucze trzeba będzie wkleić od nowa.</p>
      <label class="pole"><span>${t('sejfAi.hasloDoKluczyAi')}</span><input name="haslo" type="password" autocomplete="new-password" minlength="8"></label>
      <label class="pole" data-rola="powtorz"><span>${t('sejfAi.powtorzHaslo')}</span><input name="powtorz" type="password" autocomplete="new-password"></label>
      <p class="blad-sejfu" role="alert" hidden></p>
      <div class="przyciski-dialogu"><button class="przycisk" type="button" data-rola="usun" hidden>${t('sejfAi.niePamietamUsunZapisane')}</button><button class="przycisk" value="nie">${t('sejfAi.anuluj')}</button><button class="przycisk glowny" value="tak"></button></div></form>`;
    document.body.append(dlg);
  }
  const fo = dlg.querySelector('form');
  const zakladanie = tryb === 'brak';
  dlg.querySelector('h2').textContent = zakladanie ? t('sejfAi.hasloDoKluczyAi') : t('sejfAi.otworzKluczeAiNa');
  dlg.querySelector('[data-rola="powtorz"]').hidden = !zakladanie;
  dlg.querySelector('[data-rola="usun"]').hidden = zakladanie;
  dlg.querySelector('button[value="tak"]').textContent = zakladanie ? t('sejfAi.zapiszHaslo') : t('sejfAi.otworz');
  const blad = dlg.querySelector('.blad-sejfu');
  blad.hidden = true;
  fo.reset();
  return new Promise((ok) => {
    const s = sejfKonta();
    const naSubmit = async (e) => {
      if (e.submitter?.value !== 'tak') return;
      e.preventDefault();
      const haslo = fo.elements.haslo.value;
      const przycisk = e.submitter;
      przycisk.disabled = true;
      przycisk.textContent = t('sejfAi.szyfruje');
      try {
        if (zakladanie) {
          if (haslo !== fo.elements.powtorz.value) throw new Error('Hasła się różnią.');
          await s.zaloz(haslo);
        } else await s.otworz(haslo);
        fo.removeEventListener('submit', naSubmit);
        dlg.close('tak');
        ok(true);
      } catch (er) { blad.textContent = er.message; blad.hidden = false; } finally { przycisk.disabled = false; przycisk.textContent = zakladanie ? t('sejfAi.zapiszHaslo') : t('sejfAi.otworz'); }
    };
    fo.addEventListener('submit', naSubmit);
    dlg.querySelector('[data-rola="usun"]').onclick = async () => {
      await s.usun();
      fo.removeEventListener('submit', naSubmit);
      dlg.close('nie');
      powiadom(t('sejfAi.zapisaneKluczeUsunieteWklej'));
      ok(false);
    };
    dlg.addEventListener('close', () => { fo.removeEventListener('submit', naSubmit); if (dlg.returnValue !== 'tak') ok(false); }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Sejf gotowy do użycia (otwarty); pyta o hasło, gdy trzeba. Klucze sprzed sejfu (w pamięci przeglądarki) przenosi.
let otwieranie = null; // jedno otwieranie naraz (zmiana pola klucza potrafi przyjść dwa razy)
export function otwartySejf(opcje = {}) {
  if (!otwieranie) otwieranie = otworzSejfRaz(opcje).finally(() => { otwieranie = null; });
  return otwieranie;
}
async function otworzSejfRaz({ pytaj = true } = {}) {
  const s = sejfKonta();
  if (!s) return null;
  let st = await s.stan();
  if (st !== 'otwarty') {
    if (!pytaj) return null;
    if (!(await oknoSejfu(st))) return null;
    st = 'otwarty';
  }
  const u = ustawienia();
  let przeniesiono = false;
  for (const [id, d] of Object.entries(u.dostawcy || {})) {
    if (!d?.klucz) continue;
    await s.ustaw(id, d.klucz);
    delete d.klucz;
    przeniesiono = true;
  }
  if (przeniesiono) zapisz(PAMIEC, u);
  return s;
}
export const maKluczeDoPrzeniesienia = () => Object.values(ustawienia().dostawcy || {}).some((d) => d?.klucz);
