// Adresy podstron (część adresu po znaku #): który ekran i który projekt pokazać dla bieżącego adresu.

import { powiadom } from '../ui.js';
import { trasa, stan, pokazEkran, edytor } from './kontekst.js';
import { doProjektow, pokazProjekty, wpisyProjektow, wczytajProjektZWpisu } from './projekty.js';
import { zapiszTeraz, otworzProjekt } from './zapis.js';
import { pokazUdostepniony, pokazPodglad } from './podglad-ekran.js';
import { przejdzDoStrony } from './lista-stron.js';
import { konto } from './logowanie.js';
import { edytujWzorzec } from './wzorce.js';

let obslugaTrasy = Promise.resolve();
export function przejdzDoTrasy() {
  obslugaTrasy = obslugaTrasy.then(async () => {
    const t = trasa.odczytaj();
    if (t.ekran === 'udostepnione') { await pokazUdostepniony(t); return; }
    if (document.body.classList.contains('podglad-publiczny')) { location.reload(); return; }
    if (!stan.uzytkownik) return;
    if (t.ekran === 'konto' && stan.uzytkownik) {
      if (stan.projekt) { await zapiszTeraz(); stan.projekt = null; }
      pokazEkran('konto');
      konto.pokazUstawienia();
      return;
    }
    if (t.ekran === 'projekty' || t.ekran === 'konto') {
      if (stan.projekt) await doProjektow(); else if (document.body.dataset.ekran !== 'projekty') await pokazProjekty();
      return;
    }
    if (stan.projekt?.id === t.id) {
      if (t.podglad) { await pokazPodglad(); return; }
      if (document.body.dataset.ekran === 'podglad') { pokazEkran('edytor'); edytor.canvas.calcOffset(); }
      if (t.wzorzec && (stan.tryb !== 'wzorzec' || stan.idWzorca !== t.wzorzec)) await edytujWzorzec(t.wzorzec);
      else if (t.strona) {
        const i = stan.projekt.strony.findIndex((x) => x.id === t.strona);
        if (i >= 0 && (stan.tryb !== 'strona' || i !== stan.indeks)) await przejdzDoStrony(i);
      }
      return;
    }
    if (stan.projekt) await zapiszTeraz();
    const wpis = (await wpisyProjektow()).find((w) => w.id === t.id);
    const projekt = wpis && await wczytajProjektZWpisu(wpis).catch(() => null);
    if (!projekt) {
      powiadom('Nie znaleziono projektu z tego adresu – może został usunięty.', true);
      trasa.ustaw('projekty', { zastap: true });
      stan.projekt = null;
      await pokazProjekty();
      return;
    }
    await otworzProjekt(projekt, { strona: t.strona, wzorzec: t.wzorzec });
    if (t.podglad) await pokazPodglad();
  }).catch((e) => console.error(e));
  return obslugaTrasy;
}
