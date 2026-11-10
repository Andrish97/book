// Okno „Eksport do PDF”: zakres stron, jakość, spady i podział na pliki.

import { $, pobierz, powiadom, odmiana } from './ui.js';
import { rozwin } from './serie.js';
import { sprawdzProjekt } from './kontrola.js';
import { sprawdzMieszczenie } from './kontrola-skladu.js';
import { eksportujPdf, wybierzEgzemplarze, planPlikow, JAKOSCI_PDF, Przerwano } from './eksport.js';
import { WARUNKI_DRUKU } from './profil-icc.js';

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
    this.f.addEventListener('input', (e) => {
      // Plik bez czcionek w środku (obrazy stron, tekst na krzywe): pliki czcionek dołączają się do pobrania,
      // chyba że to pole zostało już przestawione ręcznie.
      const el = this.f.elements;
      if (e.target === el.czcionki) this.czcionkiRecznie = true;
      else if (!this.czcionkiRecznie && (e.target === el.tryb || e.target === el.krzywe)) el.czcionki.checked = el.tryb.value === 'obraz' || el.krzywe.checked;
      this.odswiez();
    });
    // Profil od drukarni: plik .icc wczytany z dysku (zostaje w pamięci okna, nie w projekcie).
    this.profilWlasny = null;
    $('#pdf-wybierz-profil').addEventListener('click', () => $('#pdf-plik-profilu').click());
    $('#pdf-plik-profilu').addEventListener('change', async (e) => {
      const plik = e.target.files[0]; e.target.value = '';
      if (!plik) return;
      this.profilWlasny = { nazwa: plik.name, bajty: new Uint8Array(await plik.arrayBuffer()) };
      this.odswiez();
    });
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
    const blok = $('#pdf-uwagi');
    const pokazUwagi = (uwagi) => {
      blok.hidden = !uwagi.length;
      blok.open = uwagi.length > 0 && uwagi.length <= 3;
      blok.querySelector('summary').textContent = `Do sprawdzenia przed drukiem: ${uwagi.length} ${odmiana(uwagi.length, 'uwaga', 'uwagi', 'uwag')}`;
      blok.querySelector('ul').replaceChildren(...uwagi.map((u) => Object.assign(document.createElement('li'), { textContent: u.opis })));
    };
    const uwagi = sprawdzProjekt(this.zrodlo.projekt(), this.ciag);
    pokazUwagi(uwagi);
    this.odswiez();
    this.okno.showModal();
    // Teksty w ramkach na wszystkich powielonych stronach – to trwa chwilę, więc lista uzupełnia się po otwarciu okna.
    const nr = this.nrSprawdzenia = (this.nrSprawdzenia || 0) + 1;
    sprawdzMieszczenie(this.zrodlo.projekt(), this.ciag, { przerwij: () => nr !== this.nrSprawdzenia || !this.okno.open }).then((teksty) => {
      if (nr === this.nrSprawdzenia && this.okno.open && teksty.length) pokazUwagi([...uwagi, ...teksty]);
    });
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
      tryb: e.tryb.value,
      krzywe: e.tryb.value === 'wektor' && e.krzywe.checked,
      cmyk: e.tryb.value === 'wektor' && e.cmyk.checked,
      pdfx: e.pdfx.value,
      profilWlasny: e.pdfx.value === 'wlasny' ? this.profilWlasny : null,
      zdjeciaCmyk: e.tryb.value === 'wektor' && Boolean(e.pdfx.value) && e.zdjeciaCmyk.checked,
      dpi: Number(e.dpi.value),
      spad: e.druk.value === 'drukarnia',
      znaki: e.druk.value === 'drukarnia' ? 'sekcje' : false,
      podzial: e.podzial.value,
      ileStron: Number(e.ile.value),
      dolaczCzcionki: e.czcionki.checked,
    };
  }

  odswiez() {
    const o = this.opcje();
    $('#pdf-pole-strony').hidden = o.zakres !== 'strony';
    $('#pdf-pole-ile').hidden = o.podzial !== 'czesci';
    const wektor = o.tryb === 'wektor';
    $('#pdf-opcje-wektora').hidden = !wektor;
    $('#pdf-etykieta-dpi').textContent = wektor ? 'Jakość elementów zapisanych jako obraz' : 'Jakość';
    $('#pdf-opis-trybu').textContent = wektor
      ? (o.krzywe
        ? 'Tekst jest zamieniony na kształty liter: wygląda identycznie wszędzie i drukarnia nie potrzebuje czcionek, ale nie da się go zaznaczyć ani poprawić. Zdjęcia idą w oryginalnej rozdzielczości.'
        : 'Tekst jest prawdziwym tekstem z osadzonymi czcionkami (da się go zaznaczyć i wyszukać), kształty są wektorami, zdjęcia idą w oryginalnej rozdzielczości. Elementy z cieniem trafiają do pliku jako obraz, a tekst czcionką, której nie da się osadzić (plik WOFF2, czcionka zmienna, kursywa bez własnego pliku) – jako krzywe; po eksporcie zobaczysz ich listę.')
      : 'Każda strona jest jednym obrazem w wybranej rozdzielczości – tekst wygląda tak samo na każdym komputerze, ale nie da się go zaznaczyć, a plik jest większy.';
    // Standard dla drukarni: co plik będzie zawierał, prostymi słowami.
    $('#pdf-pole-zdjecia').hidden = !o.pdfx;
    $('#pdf-pole-profil').hidden = o.pdfx !== 'wlasny';
    $('#pdf-nazwa-profilu').textContent = this.profilWlasny ? this.profilWlasny.nazwa : 'Nie wybrano pliku.';
    const opisPdfx = $('#pdf-opis-pdfx');
    opisPdfx.hidden = !o.pdfx;
    if (o.pdfx) {
      const papier = o.pdfx === 'wlasny' ? 'warunki druku z profilu drukarni' : `warunki druku: ${WARUNKI_DRUKU[o.pdfx].nazwa}`;
      const kolory = !wektor
        ? 'Obrazy stron zostają w RGB z opisem sRGB – na farby drukarskie przeliczy je drukarnia według dołączonego profilu.'
        : `${o.cmyk ? 'Tekst i kształty są przeliczone na CMYK przez ten profil (czerń i szarości samą czarną farbą).' : 'Tekst i kształty zostają w RGB z opisem sRGB.'} ${o.zdjeciaCmyk ? 'Zdjęcia są przeliczone na CMYK przez ten profil, w rozdzielczości z pola „Jakość”, bez strat – plik będzie wyraźnie większy.' : 'Zdjęcia zostają w RGB z opisem sRGB – na farby przeliczy je drukarnia według dołączonego profilu (to zgodne z PDF/X-4).'}`;
      opisPdfx.textContent = `Plik PDF/X-4: zawiera profil barwny (${papier}) i oznaczenia, po których programy drukarni rozpoznają standard. ${kolory}${o.pdfx === 'fogra39' ? ' Profil papieru powlekanego dodaje do pliku ok. 8 MB.' : ''} Przed pierwszym zleceniem wyślij drukarni próbny plik.`;
    }
    const projekt = this.zrodlo.projekt();
    const egz = wybierzEgzemplarze(this.ciag, o);
    const pliki = planPlikow(projekt, egz, o);
    const powielone = egz.filter((e) => e.nrEgz > 1).length;
    const stron = `${egz.length} ${odmiana(egz.length, 'strona', 'strony', 'stron')}`;
    $('#pdf-podsumowanie').textContent = egz.length
      ? `Do eksportu: ${stron}${powielone ? ` (w tym ${powielone} z powieleń serii)` : ''}${pliki.length > 1 ? `, ${pliki.length} ${odmiana(pliki.length, 'plik', 'pliki', 'plików')} PDF w jednym archiwum ZIP` : ''}.`
      : 'W wybranym zakresie nie ma stron.';
    $('#pdf-eksportuj').disabled = this.trwa || !egz.length || (o.pdfx === 'wlasny' && !this.profilWlasny);
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
      // Co w pliku wektorowym zapisano inaczej niż tekstem i wektorem: osobno obrazy, osobno tekst jako krzywe.
      const lista = (pary) => pary.map(([powod, n]) => `${powod}${n > 1 ? ` (${n})` : ''}`).join('; ');
      const suma = (pary) => pary.reduce((s, [, n]) => s + n, 0);
      const jakoObraz = wynik.uwagi || [];
      const jakoKrzywe = wynik.krzywe || [];
      const ile = suma(jakoObraz);
      const ileKrzywych = suma(jakoKrzywe);
      const czesci = [`Gotowe: ${wynik.nazwa}${ile || ileKrzywych ? '.' : ''}`];
      if (ile) czesci.push(`Jako obraz ${odmiana(ile, 'zapisany został', 'zapisane zostały', 'zapisanych zostało')} ${ile} ${odmiana(ile, 'element', 'elementy', 'elementów')}: ${lista(jakoObraz)}.`);
      if (ileKrzywych) czesci.push(`Tekst jako krzywe (nie da się go zaznaczyć) w ${ileKrzywych} ${odmiana(ileKrzywych, 'elemencie', 'elementach', 'elementach')}: ${lista(jakoKrzywe)}.`);
      powiadom(czesci.join(' '));
    } catch (blad) {
      komunikat.textContent = blad instanceof Przerwano ? 'Eksport przerwany.' : (blad.message || 'Nie udało się przygotować pliku PDF.');
    } finally {
      this.trwa = false;
      $('#pdf-anuluj').textContent = 'Anuluj';
      this.odswiez();
    }
  }
}
