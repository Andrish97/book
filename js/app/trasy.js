// Adresy podstron (część adresu po znaku #): który ekran i który projekt pokazać dla bieżącego adresu.

import { postep } from '../postep.js';
import { powiadom } from '../ui.js';
import { trasa, stan, pokazEkran, edytor } from './kontekst.js';
import { doProjektow, pokazProjekty, wpisyProjektow, wczytajProjektZWpisu } from './projekty.js';
import { pokazUdostepniony } from './udostepnione.js';
import { konto } from './logowanie.js';
import { czekajNaEdytor, edytorGotowy } from './doczytaj.js';
import { pokazZaproszenieZLinku } from './wspolpraca.js';

// Funkcje edytora: wczytują go, gdy adres prowadzi do projektu (js/app/doczytaj.js).
const zapiszTeraz = async () => edytorGotowy()?.zapiszTeraz();
const otworzProjekt = async (...a) => (await czekajNaEdytor()).otworzProjekt(...a);
const pokazPodglad = async (...a) => (await czekajNaEdytor()).pokazPodglad(...a);
const przejdzDoStrony = async (i) => (await czekajNaEdytor()).przejdzDoStrony(i);
const edytujWzorzec = async (id) => (await czekajNaEdytor()).edytujWzorzec(id);
// #/p/<id>/obrazy – projekt z oknem „Obrazy projektu” (link, który AI daje, żeby wgrać zdjęcia albo ZIP).
// Adres wraca potem do zwykłego adresu projektu, żeby odświeżenie strony nie otwierało okna drugi raz.
const otworzOknoObrazow = async () => {
  await czekajNaEdytor();
  trasa.ustaw(`p/${stan.projekt.id}`, { zastap: true });
  (await import('./obrazy-okno.js')).otworzObrazy();
};

let obslugaTrasy = Promise.resolve();
export function przejdzDoTrasy() {
  obslugaTrasy = obslugaTrasy.then(async () => {
    const t = trasa.odczytaj();
    if (t.ekran === 'udostepnione') { await pokazUdostepniony(t); return; }
    if (document.body.classList.contains('podglad-publiczny')) { location.reload(); return; }
    if (!stan.uzytkownik) return;
    // #/zaproszenie/<kod> – zaproszenie do projektu (współpraca): pytanie, czy je przyjąć.
    if (t.ekran === 'zaproszenie') {
      if (stan.projekt) await doProjektow();
      await pokazZaproszenieZLinku(t.kod);
      return;
    }
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
    // Rola „może oglądać” (współpraca): projekt otwiera się tylko w podglądzie.
    const tylkoPodglad = () => stan.projekt?.wspolpraca_chmury?.rola === 'odczyt';
    if (stan.projekt?.id === t.id) {
      if (t.podglad || tylkoPodglad()) { await pokazPodglad(); return; }
      if (document.body.dataset.ekran === 'podglad') { pokazEkran('edytor'); edytor.canvas.calcOffset(); }
      if (t.obrazy) { await otworzOknoObrazow(); return; }
      if (t.wzorzec && (stan.tryb !== 'wzorzec' || stan.idWzorca !== t.wzorzec)) await edytujWzorzec(t.wzorzec);
      else if (t.strona) {
        const i = stan.projekt.strony.findIndex((x) => x.id === t.strona);
        if (i >= 0 && (stan.tryb !== 'strona' || i !== stan.indeks)) await przejdzDoStrony(i);
      }
      return;
    }
    if (stan.projekt) await zapiszTeraz();
    const wpis = (await wpisyProjektow()).find((w) => w.id === t.id);
    const pasek = postep(`Otwieranie „${wpis?.nazwa || 'projektu'}”…`);
    try {
      const projekt = wpis && await wczytajProjektZWpisu(wpis, pasek).catch(() => null);
      if (!projekt) {
        powiadom('Nie znaleziono projektu z tego adresu – może został usunięty.', true);
        trasa.ustaw('projekty', { zastap: true });
        stan.projekt = null;
        await pokazProjekty();
        return;
      }
      pasek.opis(`Otwieranie „${projekt.nazwa}”…`);
      pasek.razem(null);
      await otworzProjekt(projekt, { strona: t.strona, wzorzec: t.wzorzec });
    } finally {
      pasek.koniec();
    }
    if (t.podglad || tylkoPodglad()) await pokazPodglad();
    if (t.obrazy) await otworzOknoObrazow();
  }).catch((e) => console.error(e));
  return obslugaTrasy;
}
