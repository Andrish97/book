// Adresy podstron (część adresu po znaku #): który ekran i który projekt pokazać dla bieżącego adresu.

import { postep } from '../postep.js';
import { powiadom } from '../ui.js';
import { trasa, stan, pokazEkran } from './kontekst.js';
import { doProjektow, pokazProjekty, wpisyProjektow, wczytajProjektZWpisu } from './projekty.js';
import { pokazUdostepniony } from './udostepnione.js';
import { konto } from './logowanie.js';
import { czekajNaEdytor, edytorGotowy } from './doczytaj.js';
import { pokazZaproszenieZLinku } from './wspolpraca.js';
import { instrukcja } from './instrukcja-leniwa.js';

// Funkcje edytora: wczytują go, gdy adres prowadzi do projektu (js/app/doczytaj.js).
const zapiszTeraz = async () => edytorGotowy()?.zapiszTeraz();
const otworzProjekt = async (...a) => (await czekajNaEdytor()).otworzProjekt(...a);
const pokazPodglad = async (...a) => (await czekajNaEdytor()).pokazPodglad(...a);
const pokazEdytor = async () => (await czekajNaEdytor()).pokazEdytor();
const przejdzDoStrony = async (i) => (await czekajNaEdytor()).przejdzDoStrony(i);
const edytujWzorzec = async (id) => (await czekajNaEdytor()).edytujWzorzec(id);
// #/p/<id>/obrazy – projekt z oknem „Obrazy projektu” (link, który AI daje, żeby wgrać zdjęcia albo ZIP).
// Adres wraca potem do zwykłego adresu projektu, żeby odświeżenie strony nie otwierało okna drugi raz.
// #/p/<id>/k/<wątek> – panel komentarzy na tym wątku (link z powiadomienia, #131D).
const otworzKomentarzZTrasy = async (watek) => {
  await czekajNaEdytor();
  trasa.ustaw(`p/${stan.projekt.id}`, { zastap: true });
  (await import('./komentarze.js')).otworzKomentarze({ watek });
};
// #/p/<id>/eksport/<zlecenie> – eksport PDF/PNG zlecony przez AI, gdy aplikacja była zamknięta (#175):
// projekt się otwiera, a aplikacja robi plik i oddaje go łącznikowi. Bez czekania na koniec – kolejka trasy idzie dalej.
const eksportZTrasy = async (zlecenie) => {
  (await import('./eksport-ai.js')).wykonajZTrasy(zlecenie).catch((e) => console.error(e));
};
const otworzOknoObrazow = async () => {
  await czekajNaEdytor();
  trasa.ustaw(`p/${stan.projekt.id}`, { zastap: true });
  (await import('./obrazy-okno.js')).otworzObrazy();
};

// #/p/<id>/asystent – Asystent AI w trybie „kopiuj i wklej” (#254).
const otworzAsystentaKopiuj = async () => {
  await czekajNaEdytor();
  trasa.ustaw(`p/${stan.projekt.id}`, { zastap: true });
  (await import('./czat-ai.js')).otworzCzatAi({ dostawca: 'schowek' });
};

let obslugaTrasy = Promise.resolve();
export function przejdzDoTrasy() {
  obslugaTrasy = obslugaTrasy.then(async () => {
    const t = trasa.odczytaj();
    if (t.ekran === 'udostepnione') { await pokazUdostepniony(t); return; }
    if (document.body.classList.contains('podglad-publiczny')) { location.reload(); return; }
    // #/instrukcja – podręcznik nad bieżącym ekranem, także bez konta (#114).
    if (t.ekran === 'instrukcja') {
      if (stan.uzytkownik && !stan.projekt && document.body.dataset.ekran !== 'projekty') await pokazProjekty();
      await instrukcja.otworzZAdresu(stan.projekt ? `#/p/${stan.projekt.id}` : (stan.uzytkownik ? '#/projekty' : '#/'));
      return;
    }
    if (!stan.uzytkownik) return;
    // #/zaproszenie/<kod> – zaproszenie do projektu (współpraca): pytanie, czy je przyjąć.
    if (t.ekran === 'zaproszenie') {
      if (stan.projekt) await doProjektow();
      await pokazZaproszenieZLinku(t.kod);
      return;
    }
    // #/polacz-ai/<id> – aplikacja AI prosi o dostęp (łącznik z logowaniem OAuth, #244): strona zgody.
    if (t.ekran === 'polacz-ai') {
      if (stan.projekt) await doProjektow(); else if (document.body.dataset.ekran !== 'projekty') await pokazProjekty();
      await (await import('./polacz-ai.js')).pokazZgode(t.id);
      return;
    }
    if (t.ekran === 'konto' && stan.uzytkownik) {
      // Przejście między listą a sekcją ustawień (Wstecz) – bez przeładowania ekranu.
      if (document.body.dataset.ekran === 'konto') { konto.pokazSekcje(t.sekcja); return; }
      if (stan.projekt) { await zapiszTeraz(); stan.projekt = null; }
      pokazEkran('konto');
      konto.pokazUstawienia(t.sekcja);
      return;
    }
    // #/admin – panel administratora (decyzja #95); dla innych kont – lista projektów.
    if (t.ekran === 'admin') {
      if (stan.projekt) { await zapiszTeraz(); stan.projekt = null; }
      const admin = await import('./admin.js');
      if (await admin.czyAdministrator()) { pokazEkran('admin'); await admin.pokazPanel(t.zakladka); return; }
      trasa.ustaw('projekty', { zastap: true });
      await pokazProjekty();
      return;
    }
    if (t.ekran === 'projekty' || t.ekran === 'konto') {
      if (stan.projekt) await doProjektow(); else if (document.body.dataset.ekran !== 'projekty') await pokazProjekty();
      return;
    }
    // Rola „może oglądać” (współpraca): projekt otwiera się tylko w podglądzie.
    const tylkoPodglad = () => stan.projekt?.wspolpraca_chmury?.rola === 'odczyt';
    if (stan.projekt?.id === t.id) {
      if (t.eksport) { await eksportZTrasy(t.eksport); return; }
      if (t.komentarz) { await otworzKomentarzZTrasy(t.komentarz); return; }
      if (t.podglad || tylkoPodglad()) { await pokazPodglad(); return; }
      if (document.body.dataset.ekran === 'podglad') await pokazEdytor();
      if (t.obrazy) { await otworzOknoObrazow(); return; }
      if (t.asystent) { await otworzAsystentaKopiuj(); return; }
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
      await otworzProjekt(projekt, { strona: t.strona, wzorzec: t.wzorzec, podglad: !!t.podglad || projekt.wspolpraca_chmury?.rola === 'odczyt' });
    } finally {
      pasek.koniec();
    }
    if (t.podglad || tylkoPodglad()) await pokazPodglad();
    if (t.obrazy) await otworzOknoObrazow();
    if (t.asystent && !t.podglad && !tylkoPodglad()) await otworzAsystentaKopiuj();
    if (t.komentarz) await otworzKomentarzZTrasy(t.komentarz);
    if (t.eksport) await eksportZTrasy(t.eksport);
  }).catch((e) => console.error(e));
  return obslugaTrasy;
}
