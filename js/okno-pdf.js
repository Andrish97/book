// Okno „Eksport do PDF”: zakres stron, jakość, spady i podział na pliki.

import { uzyteKoloryDruku, trybKolorow } from './kolory-druku.js';
import { $, pobierz, powiadom, odmiana } from './ui.js';
import { rozwin } from './serie.js';
import { sprawdzProjekt } from './kontrola.js';
import { sprawdzMieszczenie } from './kontrola-skladu.js';
import { eksportujPdf, wybierzEgzemplarze, planPlikow, JAKOSCI_PDF, Przerwano } from './eksport.js';
import { WARUNKI_DRUKU } from './profil-icc.js';
import { postep } from './postep.js';
import { planImpozycji, opisPlanu } from './impozycja.js';

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
      if (e.target === el.nawigacja) this.nawigacjaRecznie = true;
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
    // Składka z ustawień sekcji (#120), gdy jakaś sekcja ją ma.
    const skl = this.zrodlo.projekt().sekcje.map((s) => Number(s.skladka)).find((k) => [4, 8, 16, 32].includes(k));
    if (skl) this.f.elements.skladka.value = String(skl);
    // Na telefonie ustawienia zaawansowane zwinięte (podsumowanie w nagłówku); na większym ekranie rozwinięte (#103).
    $('#pdf-zaawansowane').open = document.documentElement.dataset.urzadzenie !== 'telefon';
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
      // W pliku wektorowym: zdjęcia przez profil; w obrazach stron: cały obraz strony przez profil.
      zdjeciaCmyk: Boolean(e.pdfx.value) && e.zdjeciaCmyk.checked,
      dpi: Number(e.dpi.value),
      spad: e.druk.value === 'drukarnia',
      znaki: e.druk.value === 'drukarnia' ? 'sekcje' : false,
      podzial: e.podzial.value,
      ileStron: Number(e.ile.value),
      dolaczCzcionki: e.czcionki.checked,
      uszlachetnienia: e.uszlachetnienia.value,
      uklad: e.uklad.value,
      formatArkusza: e.formatArkusza.value,
      skladka: Number(e.skladka.value),
      pelzanie: Math.max(0, Number(String(e.pelzanie.value).replace(',', '.')) || 0),
      // Zakładki i linki: nie w PDF/X (plik dla drukarni) i nie na arkuszach broszury.
      nawigacja: e.nawigacja.checked && !e.pdfx.value && e.uklad.value === 'zwykly',
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
    // Kolory do druku (#127): uszlachetnienia i kolory dodatkowe – tylko w pliku wektorowym.
    const druk = uzyteKoloryDruku(this.zrodlo.projekt());
    const tryb = trybKolorow(this.zrodlo.projekt());
    $('#pdf-pole-uszl').hidden = !druk.uszlachetnienia.length;
    const opisKolorow = [
      druk.spoty.length ? `Kolory dodatkowe na osobnych płytach: ${druk.spoty.map((x) => x.nazwa).join(', ')}.` : '',
      druk.uszlachetnienia.length ? `Uszlachetnienia: ${druk.uszlachetnienia.map((x) => `${x.etykieta} (płyta ${x.plyta})`).join(', ')} – z nadrukiem, bez wybijania farby pod spodem.` : '',
      tryb === 'szarosc' ? 'Projekt w skali szarości: wszystko jedną czarną farbą, zdjęcia w odcieniach szarości.' : '',
      tryb === 'czb1' ? 'Projekt czarno-biały + 1 kolor: czerń i jedna płyta koloru dodatkowego, zdjęcia w odcieniach szarości.' : '',
    ].filter(Boolean).join(' ');
    $('#pdf-opis-kolorow').hidden = !opisKolorow;
    $('#pdf-opis-kolorow').textContent = opisKolorow;
    // Standard dla drukarni: co plik będzie zawierał, prostymi słowami.
    $('#pdf-pole-zdjecia').hidden = !o.pdfx;
    $('#pdf-etykieta-zdjecia').textContent = wektor ? 'Zdjęcia też w CMYK (większy plik)' : 'Obrazy stron w CMYK (większy plik)';
    $('#pdf-pole-profil').hidden = o.pdfx !== 'wlasny';
    $('#pdf-nazwa-profilu').textContent = this.profilWlasny ? this.profilWlasny.nazwa : 'Nie wybrano pliku.';
    const opisPdfx = $('#pdf-opis-pdfx');
    opisPdfx.hidden = !o.pdfx;
    if (o.pdfx) {
      const papier = o.pdfx === 'wlasny' ? 'warunki druku z profilu drukarni' : `warunki druku: ${WARUNKI_DRUKU[o.pdfx].nazwa}`;
      const kolory = !wektor
        ? (o.zdjeciaCmyk
          ? 'Obrazy stron są przeliczone na CMYK przez ten profil. Czarny i szary tekst, kształty i cienie idą samą czarną farbą (także gdy leżą na zdjęciu) i są zapisane bez strat, więc litery są ostre; same zdjęcia – czterema farbami, jak wynika z profilu, jako JPEG. Plik jest większy niż zwykłe obrazy stron.'
          : 'Obrazy stron zostają w RGB z opisem sRGB – na farby drukarskie przeliczy je drukarnia według dołączonego profilu.')
        : `${o.cmyk ? 'Tekst i kształty są przeliczone na CMYK przez ten profil (czerń i szarości samą czarną farbą).' : 'Tekst i kształty zostają w RGB z opisem sRGB.'} ${o.zdjeciaCmyk ? 'Zdjęcia są przeliczone na CMYK przez ten profil, w rozdzielczości z pola „Jakość” (zdjęcia JPEG zostają JPEG-iem w czterech farbach, pozostałe obrazy bez strat) – plik będzie większy.' : 'Zdjęcia zostają w RGB z opisem sRGB – na farby przeliczy je drukarnia według dołączonego profilu (to zgodne z PDF/X-4).'}`;
      opisPdfx.textContent = `Plik PDF/X-4: zawiera profil barwny (${papier}) i oznaczenia, po których programy drukarni rozpoznają standard. ${kolory}${o.pdfx === 'fogra39' ? ' Profil papieru powlekanego dodaje do pliku ok. 8 MB.' : ''} Przed pierwszym zleceniem wyślij drukarni próbny plik.`;
    }
    // Układ arkuszy (#131C): broszura, składki, 2 albo 4 strony na arkuszu.
    const arkusze = o.uklad !== 'zwykly';
    $('#pdf-pole-arkusze').hidden = !arkusze;
    $('#pdf-pole-skladka').hidden = o.uklad !== 'skladki';
    $('#pdf-pole-pelzanie').hidden = o.uklad !== 'broszura' && o.uklad !== 'skladki';
    // PDF do czytania: domyślnie dla zwykłego pliku; przy PDF/X i arkuszach – wyłączone.
    const nawig = this.f.elements.nawigacja;
    nawig.disabled = Boolean(o.pdfx) || arkusze;
    if (!this.nawigacjaRecznie) nawig.checked = !o.pdfx && !arkusze;
    const projekt = this.zrodlo.projekt();
    const egz = wybierzEgzemplarze(this.ciag, o);
    if (arkusze) {
      $('#pdf-opis-arkuszy').textContent = `${opisPlanu(egz.length, o)} Strony stoją równo do formatu (bez spadu)${o.formatArkusza === 'auto' ? '' : ' i w razie potrzeby są zmniejszone'}; znaki cięcia${o.uklad === 'broszura' || o.uklad === 'skladki' ? ' i złamu (przerywane)' : ''} – przy „Do drukarni”.`;
      pokazPlanArkuszy($('#pdf-plan-arkuszy'), egz, o);
    }
    const pliki = planPlikow(projekt, egz, o);
    const powielone = egz.filter((e) => e.nrEgz > 1).length;
    const stron = `${egz.length} ${odmiana(egz.length, 'strona', 'strony', 'stron')}`;
    $('#pdf-podsumowanie').textContent = egz.length
      ? `Do eksportu: ${stron}${powielone ? ` (w tym ${powielone} z powieleń serii)` : ''}${pliki.length > 1 ? `, ${pliki.length} ${odmiana(pliki.length, 'plik', 'pliki', 'plików')} PDF w jednym archiwum ZIP` : ''}.`
      : 'W wybranym zakresie nie ma stron.';
    // Podsumowanie zwiniętej sekcji „Zaawansowane”: jakość, kolory, standard, podział.
    const f = this.f.elements;
    const wybrana = (pole) => pole?.selectedOptions?.[0]?.textContent?.split(/ [–-] /)[0] || '';
    $('#pdf-zaawansowane-opis').textContent = [arkusze ? wybrana(f.uklad) : '', wybrana(f.dpi), o.cmyk && wektor ? 'CMYK' : 'RGB', o.pdfx ? 'PDF/X-4' : '', wybrana(f.podzial)].filter(Boolean).join(' · ');
    $('#pdf-eksportuj').disabled = this.trwa || !egz.length || (o.pdfx === 'wlasny' && !this.profilWlasny);
  }

  async eksportuj() {
    if (this.trwa) return;
    const komunikat = $('#pdf-komunikat');
    this.trwa = true; this.przerwane = false;
    $('#pdf-eksportuj').disabled = true;
    $('#pdf-anuluj').textContent = 'Przerwij';
    komunikat.textContent = 'Przygotowuję strony…';
    // Wspólny wskaźnik postępu (js/postep.js): pasek „strona i z n” i „Anuluj”, jak przy innych dłuższych czynnościach.
    const pasek = postep('Eksport do PDF', { anuluj: () => { this.przerwane = true; } });
    try {
      const wynik = await eksportujPdf(this.zrodlo.projekt(), {
        ...this.opcje(),
        postep: (i, n) => { komunikat.textContent = `Strona ${i} z ${n}…`; pasek.krok(i, n); },
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
      pasek.koniec();
      this.trwa = false;
      $('#pdf-anuluj').textContent = 'Anuluj';
      this.odswiez();
    }
  }
}

// Podgląd układu: miniaturki arkuszy z numerami stron (pierwsze 12 stron arkuszy; reszta jako „…”).
function pokazPlanArkuszy(lista, egz, o) {
  const plan = planImpozycji(egz.length, o);
  const numer = (i) => (i === null || i === undefined ? '' : String(egz[i]?.nr ?? i + 1));
  const broszura = o.uklad === 'broszura' || o.uklad === 'skladki';
  const pozycje = plan.strony.slice(0, 12).map((a, k) => {
    const li = document.createElement('li');
    li.className = `arkusz-planu${a.wiersze > 1 ? ' cztery' : ''}${a.falc ? ' falc' : ''}`;
    li.title = broszura ? `Arkusz ${Math.floor(k / 2) + 1}, ${k % 2 ? 'tył' : 'przód'}` : `Arkusz ${k + 1}`;
    li.innerHTML = a.pola.map((i) => `<span class="${i === null ? 'pusta' : ''}">${numer(i)}</span>`).join('') + (broszura ? `<small>${Math.floor(k / 2) + 1}${k % 2 ? ' tył' : ' przód'}</small>` : '');
    return li;
  });
  if (plan.strony.length > 12) pozycje.push(Object.assign(document.createElement('li'), { className: 'arkusz-planu reszta', textContent: `+${plan.strony.length - 12}` }));
  lista.replaceChildren(...pozycje);
}
