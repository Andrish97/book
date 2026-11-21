// Strona zgody łącznika z logowaniem (#244): aplikacja AI (Claude, ChatGPT…) przysłała użytkownika na
// #/polacz-ai/<id>. Pokazujemy, kto prosi, i pozwalamy wybrać zakres – jak przy ręcznym kluczu: projekty (albo pełny
// dostęp), czytanie albo też zmiany, ważność. „Zezwól” tworzy klucz dostępu (widoczny w ustawieniach konta →
// Sztuczna inteligencja, do odebrania) i wraca do aplikacji AI z jednorazowym kodem; „Odmów” wraca z odmową.

import * as chmura from '../chmura.js';
import { $, powiadom } from '../ui.js';
import { trasa } from './kontekst.js';
import { wyborProjektow } from './dostep-ai.js';
import { t } from '../jezyk.js';

function okno() {
  let dlg = $('#dlg-polacz-ai');
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.id = 'dlg-polacz-ai';
  dlg.className = 'dialog-szeroki';
  dlg.innerHTML = `<form method="dialog" class="formularz">
    <h2>${t('polaczAi.polaczZMakietka')}</h2>
    <p class="polacz-kto"></p>
    <div class="rzad">
      <label class="pole"><span>${t('polaczAi.moze')}</span><select name="rola"><option value="edycja">${t('polaczAi.czytacIZmieniac')}</option><option value="odczyt">${t('polaczAi.tylkoCzytac')}</option></select></label>
      <label class="pole"><span>${t('polaczAi.naJakDlugo')}</span><select name="dni"><option value="7">${t('polaczAi.7Dni')}</option><option value="30">${t('polaczAi.30Dni')}</option><option value="90" selected>${t('polaczAi.90Dni')}</option><option value="365">${t('polaczAi.rok')}</option><option value="bez">${t('polaczAi.bezTerminu')}</option></select></label>
    </div>
    <div class="przelacznik-segmentowy" role="radiogroup" aria-label="${t('polaczAi.zakres')}">
      <label><input type="radio" name="zakres" value="wybrane" checked><span>${t('polaczAi.wybraneProjekty')}</span></label>
      <label><input type="radio" name="zakres" value="pelny"><span>Wszystkie (też tworzenie i usuwanie)</span></label>
    </div>
    <div class="lista-projektow-klucza polacz-projekty"></div>
    <p class="podpowiedz">Połączenie to zwykły klucz dostępu – zobaczysz go i odbierzesz w ustawieniach konta → Sztuczna inteligencja. Aplikacja AI nie dostaje Twojego hasła.</p>
    <p class="blad-polaczenia" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" value="nie">${t('polaczAi.odmow')}</button><button class="przycisk glowny" value="tak">${t('polaczAi.zezwol')}</button></div>
  </form>`;
  document.body.append(dlg);
  const f = dlg.querySelector('form');
  f.addEventListener('change', (e) => { if (e.target.name === 'zakres') f.querySelector('.polacz-projekty').hidden = e.target.value === 'pelny'; });
  return dlg;
}

export async function pokazZgode(id) {
  trasa.ustaw('projekty', { zastap: true });
  let info;
  try { info = await chmura.oauthZadanie(id); } catch (e) { powiadom(chmura.komunikatBledu(e), true); return; }
  if (!info) { powiadom('Ta prośba o połączenie wygasła albo już ją obsłużono. Zacznij łączenie od nowa w aplikacji AI.', true); return; }
  const dlg = okno();
  const f = dlg.querySelector('form');
  f.reset();
  dlg.querySelector('.polacz-kto').textContent = `„${info.klient}” (${info.host}) prosi o dostęp do Twoich projektów w Makietce. Wybierz, co może.`;
  const blad = dlg.querySelector('.blad-polaczenia');
  blad.hidden = true;
  f.querySelector('.polacz-projekty').hidden = false;
  const wybor = await wyborProjektow(f.querySelector('.polacz-projekty'));
  const naSubmit = async (e) => {
    e.preventDefault();
    const tak = e.submitter?.value === 'tak';
    try {
      if (!tak) {
        const w = await chmura.oauthOdmow(id);
        dlg.close();
        if (w?.adres) location.href = w.adres;
        return;
      }
      const zakres = f.elements.zakres.value;
      const dni = f.elements.dni.value;
      const w = await chmura.oauthZatwierdz(id, { rola: f.elements.rola.value, dni: dni === 'bez' ? null : Number(dni), zakres, projekty: zakres === 'pelny' ? [] : wybor() });
      dlg.close();
      powiadom(`Połączono „${info.klient}” z Makietką – wracam do aplikacji AI.`);
      location.href = w.adres;
    } catch (er) {
      blad.textContent = chmura.komunikatBledu(er);
      blad.hidden = false;
    }
  };
  f.onsubmit = naSubmit;
  dlg.showModal();
}
