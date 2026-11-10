// Okno „Eksport do PDF”: zakres stron, jakość, spady i podział na pliki.

import { $, pobierz, powiadom, odmiana } from './ui.js';
import { rozwin } from './serie.js';
import { sprawdzProjekt } from './kontrola.js';
import { eksportujPdf, wybierzEgzemplarze, planPlikow, JAKOSCI_PDF, Przerwano } from './eksport.js';

export class OknoPdf {
  // projekt() → bieżący projekt, sekcja() → bieżąca sekcja, przedEksportem() –
  // zapisuje to, co jest na płótnie, do projektu.
  constructor({ projekt, sekcja, przedEksportem }) {
    this.zrodlo = { projekt, sekcja, przedEksportem };
    this.okno = $('#dlg-pdf');
    this.f = $('#form-pdf');
    this.trwa = false;
    this.przerwane = false;
    this.f.elements.dpi.replaceChildren(...JAKOSCI_PDF.map((j) => new Option(j.opis, j.dpi, j.dpi === 300, j.dpi === 300)));
    this.f.addEventListener('input', () => this.odswiez());
    this.f.addEventListener('submit', (e) => { e.preventDefault(); this.eksportuj(); });
    $('#pdf-anuluj').addEventListener('click', () => this.zamknij());
    $('#pdf-zamknij').addEventListener('click', () => this.zamknij());
    this.okno.addEventListener('cancel', (e) => { if (this.trwa) { e.preventDefault(); this.przerwane = true; } });
  }

  otworz() {
    this.zrodlo.przedEksportem();
    this.ciag = rozwin(this.zrodlo.projekt());
    const ile = this.ciag.egzemplarze.length;
    const { od, do: doStrony } = this.f.elements;
    od.max = ile; doStrony.max = ile;
    od.value = 1; doStrony.value = ile;
    $('#pdf-komunikat').textContent = '';
    // Rzeczy do sprawdzenia przed drukiem – nie blokują eksportu.
    const uwagi = sprawdzProjekt(this.zrodlo.projekt(), this.ciag);
    const blok = $('#pdf-uwagi');
    blok.hidden = !uwagi.length;
    blok.open = uwagi.length > 0 && uwagi.length <= 3;
    blok.querySelector('summary').textContent = `Do sprawdzenia przed drukiem: ${uwagi.length} ${odmiana(uwagi.length, 'uwaga', 'uwagi', 'uwag')}`;
    blok.querySelector('ul').replaceChildren(...uwagi.map((u) => Object.assign(document.createElement('li'), { textContent: u.opis })));
    this.odswiez();
    this.okno.showModal();
  }

  zamknij() {
    if (this.trwa) { this.przerwane = true; return; }
    this.okno.close();
  }

  opcje() {
    const e = this.f.elements;
    return {
      zakres: e.zakres.value,
      sekcja: this.zrodlo.sekcja()?.id,
      od: Number(e.od.value),
      do: Number(e.do.value),
      dpi: Number(e.dpi.value),
      spad: e.druk.value === 'drukarnia',
      znaki: e.druk.value === 'drukarnia' ? 'sekcje' : false,
      podzial: e.podzial.value,
      ileStron: Number(e.ile.value),
    };
  }

  odswiez() {
    const o = this.opcje();
    $('#pdf-pole-strony').hidden = o.zakres !== 'strony';
    $('#pdf-pole-ile').hidden = o.podzial !== 'czesci';
    const projekt = this.zrodlo.projekt();
    const egz = wybierzEgzemplarze(this.ciag, o);
    const pliki = planPlikow(projekt, egz, o);
    const powielone = egz.filter((e) => e.nrEgz > 1).length;
    const stron = `${egz.length} ${odmiana(egz.length, 'strona', 'strony', 'stron')}`;
    $('#pdf-podsumowanie').textContent = egz.length
      ? `Do eksportu: ${stron}${powielone ? ` (w tym ${powielone} z powieleń serii)` : ''}${pliki.length > 1 ? `, ${pliki.length} ${odmiana(pliki.length, 'plik', 'pliki', 'plików')} PDF w jednym archiwum ZIP` : ''}.`
      : 'W wybranym zakresie nie ma stron.';
    $('#pdf-eksportuj').disabled = this.trwa || !egz.length;
  }

  async eksportuj() {
    if (this.trwa) return;
    const komunikat = $('#pdf-komunikat');
    this.trwa = true; this.przerwane = false;
    $('#pdf-eksportuj').disabled = true;
    $('#pdf-anuluj').textContent = 'Przerwij';
    komunikat.textContent = 'Przygotowuję strony…';
    try {
      const wynik = await eksportujPdf(this.zrodlo.projekt(), {
        ...this.opcje(),
        postep: (i, n) => { komunikat.textContent = `Strona ${i} z ${n}…`; },
        przerwij: () => this.przerwane,
      });
      this.ostatni = wynik; // do testów i ponownego pobrania
      pobierz(wynik.nazwa, URL.createObjectURL(wynik.blob));
      this.trwa = false;
      this.okno.close();
      powiadom(`Gotowe: ${wynik.nazwa}`);
    } catch (blad) {
      komunikat.textContent = blad instanceof Przerwano ? 'Eksport przerwany.' : (blad.message || 'Nie udało się przygotować pliku PDF.');
    } finally {
      this.trwa = false;
      $('#pdf-anuluj').textContent = 'Anuluj';
      this.odswiez();
    }
  }
}
