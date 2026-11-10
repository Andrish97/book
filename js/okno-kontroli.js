// Okno „Sprawdź przed drukiem”: uwagi do całego projektu, już po powieleniu serii.

import { $, odmiana } from './ui.js';
import { rozwin } from './serie.js';
import { sprawdzProjekt } from './kontrola.js';
import { sprawdzMieszczenie } from './kontrola-skladu.js';

// Wypełnia listę uwagami. Przy uwadze z numerami stron jest „Pokaż” – otwiera podgląd na pierwszej z tych
// stron (już z danymi tego powielenia); przy uwadze o konkretnym elemencie także „Otwórz wzór” – stronę
// w edytorze, z zaznaczonym elementem.
export function rysujUwagi(ul, uwagi, { wPodgladzie, wzor } = {}) {
  ul.replaceChildren(...uwagi.map((u) => {
    const li = document.createElement('li');
    const opis = document.createElement('span');
    opis.textContent = u.opis;
    li.append(opis);
    const przyciski = document.createElement('span');
    przyciski.className = 'przyciski-uwagi';
    const dodaj = (tekst, tytul, fn) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk maly', textContent: tekst, title: tytul });
      b.addEventListener('click', fn);
      przyciski.append(b);
    };
    if (wPodgladzie && u.strony?.length) dodaj('Pokaż', 'Pokaż tę stronę w podglądzie – z danymi tego powielenia', () => wPodgladzie(Math.min(...u.strony)));
    if (wzor && u.idStrony) dodaj('Otwórz wzór', 'Otwórz stronę-wzór w edytorze i zaznacz element', () => wzor(u.idStrony, u.idObiektu));
    if (przyciski.children.length) li.append(przyciski);
    return li;
  }));
}

export class OknoKontroli {
  // projekt() → bieżący projekt; przedSprawdzeniem() – płótno oddaje treść do projektu;
  // pokaz(idStrony, idObiektu) – otwiera stronę-wzór i zaznacza element;
  // pokazWPodgladzie(nr) – otwiera podgląd na stronie o tym numerze w wydruku.
  constructor({ projekt, przedSprawdzeniem, pokaz, pokazWPodgladzie }) {
    this.zrodlo = { projekt, przedSprawdzeniem, pokaz, pokazWPodgladzie };
    this.okno = $('#dlg-kontrola');
    this.nr = 0;
    $('#kontrola-zamknij').addEventListener('click', () => this.okno.close());
    this.okno.addEventListener('close', () => { this.nr += 1; });
  }

  async otworz() {
    this.zrodlo.przedSprawdzeniem();
    const projekt = this.zrodlo.projekt();
    const ciag = rozwin(projekt);
    const nr = this.nr += 1;
    const lista = $('#kontrola-lista');
    const stan = $('#kontrola-stan');
    const pokaz = {
      wzor: (idStrony, idObiektu) => { this.okno.close(); this.zrodlo.pokaz(idStrony, idObiektu); },
      wPodgladzie: this.zrodlo.pokazWPodgladzie ? (nrStrony) => { this.okno.close(); this.zrodlo.pokazWPodgladzie(nrStrony); } : null,
    };
    let uwagi = sprawdzProjekt(projekt, ciag);
    rysujUwagi(lista, uwagi, pokaz);
    stan.textContent = `Sprawdzam, czy teksty mieszczą się w ramkach na ${ciag.egzemplarze.length} ${odmiana(ciag.egzemplarze.length, 'stronie', 'stronach', 'stronach')}…`;
    this.okno.showModal();
    const teksty = await sprawdzMieszczenie(projekt, ciag, { przerwij: () => nr !== this.nr });
    if (nr !== this.nr) return;
    uwagi = [...uwagi, ...teksty];
    rysujUwagi(lista, uwagi, pokaz);
    stan.textContent = uwagi.length
      ? `${uwagi.length} ${odmiana(uwagi.length, 'uwaga', 'uwagi', 'uwag')} do sprawdzenia. Żadna nie blokuje eksportu.`
      : `Wszystko w porządku: ${ciag.egzemplarze.length} ${odmiana(ciag.egzemplarze.length, 'strona', 'strony', 'stron')} bez uwag.`;
    this.uwagi = uwagi; // do testów
  }
}
