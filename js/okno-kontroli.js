// Okno „Sprawdź przed drukiem”: uwagi do całego projektu, już po powieleniu serii.

import { $, odmiana } from './ui.js';
import { rozwin } from './serie.js';
import { sprawdzProjekt } from './kontrola.js';
import { sprawdzMieszczenie } from './kontrola-skladu.js';

// Wypełnia listę uwagami; przy uwadze, która wskazuje stronę, jest przycisk „Pokaż”.
export function rysujUwagi(ul, uwagi, pokaz) {
  ul.replaceChildren(...uwagi.map((u) => {
    const li = document.createElement('li');
    const opis = document.createElement('span');
    opis.textContent = u.opis;
    li.append(opis);
    if (pokaz && u.idStrony) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk maly', textContent: 'Pokaż' });
      b.addEventListener('click', () => pokaz(u.idStrony, u.idObiektu));
      li.append(b);
    }
    return li;
  }));
}

export class OknoKontroli {
  // projekt() → bieżący projekt; przedSprawdzeniem() – płótno oddaje treść do projektu;
  // pokaz(idStrony, idObiektu) – otwiera stronę i zaznacza element.
  constructor({ projekt, przedSprawdzeniem, pokaz }) {
    this.zrodlo = { projekt, przedSprawdzeniem, pokaz };
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
    const pokaz = (idStrony, idObiektu) => { this.okno.close(); this.zrodlo.pokaz(idStrony, idObiektu); };
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
