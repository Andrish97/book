// Typ sekcji (#177): jawne pole `sekcja.typ`, wybierane przez użytkownika przy dodawaniu sekcji i zmieniane
// w ustawieniach sekcji. Typ sam ustala geometrię i zachowanie sekcji – okładka liczy grzbiet z bloku, wyklejka
// jest rozłożonym arkuszem z bigiem pośrodku, wkładka nie ma numerów stron… Cała aplikacja (grzbiet, numeracja,
// PDF dla drukarni, kontrola przed drukiem, makieta 3D, AI) czyta wyłącznie typ – nigdy nazwy sekcji.
//
// Moduł bez zależności – używają go js/okladka.js, js/serie.js, js/projekt.js i js/sekcje-specjalne.js.

// rodzaj – parametry sekcji: 'okladka' (pole sekcja.okladka), rodzaj sekcji specjalnej (pole sekcja.specjalna,
// js/sekcje-specjalne.js) albo null (zwykłe strony). rola – miejsce w publikacji (grzbiet, numeracja, pliki PDF).
export const TYPY_SEKCJI = {
  zwykla: { nazwa: 'Zwykła', opis: 'Strony w wybranym formacie – plakat, ulotka jednokartkowa, zaproszenie, broszura.', ikona: 'strony', rodzaj: null, rola: 'blok' },
  blok: { nazwa: 'Blok (środek książki)', opis: 'Strony środka: numerowane, z ich liczby i papieru liczy się grzbiet okładki.', ikona: 'ksiazka', rodzaj: null, rola: 'blok' },
  okladka: { nazwa: 'Okładka', opis: 'Tył, grzbiet i przód – szerokość grzbietu liczy się sama z bloku i papieru.', ikona: 'makieta', rodzaj: 'okladka', rola: 'okladka' },
  wyklejka_przednia: { nazwa: 'Wyklejka przednia', opis: 'Twarda oprawa: arkusz z dwóch kartek – połowa przyklejona do okładki, połowa to pierwsza kartka.', ikona: 'warstwy', rodzaj: 'wyklejka', rola: 'wyklejka' },
  wyklejka_tylna: { nazwa: 'Wyklejka tylna', opis: 'Twarda oprawa: ostatnia luźna kartka i połowa przyklejona do tylnej okładki.', ikona: 'warstwy', rodzaj: 'wyklejka', rola: 'wyklejka' },
  obwoluta: { nazwa: 'Obwoluta', opis: 'Papierowa okładka na twardą oprawę ze skrzydełkami – wymiary z okładki.', ikona: 'format', rodzaj: 'obwoluta', rola: 'obwoluta' },
  wkladka: { nazwa: 'Wkładka', opis: 'Kartki na innym papierze w środku książki (np. zdjęcia na kredzie) – bez numerów stron.', ikona: 'obraz', rodzaj: null, rola: 'wkladka' },
  podkladka: { nazwa: 'Podkładka / plecy', opis: 'Karton pod kalendarzem albo notesem – poza numeracją i grzbietem.', ikona: 'separator', rodzaj: null, rola: 'podkladka' },
  ulotka: { nazwa: 'Ulotka składana', opis: 'Arkusz na 2–4 panele (zwijany albo harmonijka) – zgięcia i panele podpisane.', ikona: 'rozkladowka', rodzaj: 'ulotka', rola: 'osobny' },
  kalendarz: { nazwa: 'Kalendarz roczny (daty)', opis: 'Strona na miesiąc, tydzień albo dzień – daty i polskie święta w danych, zmiana roku przelicza wszystko.', ikona: 'kalendarz', rodzaj: 'kalendarz', rola: 'blok' },
  trojdzielny: { nazwa: 'Kalendarz trójdzielny', opis: 'Główka i trzy kalendaria z okienkiem, bigiem i perforacjami.', ikona: 'planer', rodzaj: 'trojdzielny', rola: 'osobny' },
  wykrojnik: { nazwa: 'Wykrojnik', opis: 'Koperta, teczka z kieszenią albo pudełko – linia cięcia i zgięć dla drukarni.', ikona: 'ksztalty', rodzaj: 'wykrojnik', rola: 'osobny' },
  skladanka: { nazwa: 'Składanka / wycinanka', opis: 'Model z papieru albo kartonu z wielu części na kilku arkuszach: zakładki klejowe, zgięcia, miejsca klejenia z numerami, szczeliny.', ikona: 'ksztalty', rodzaj: 'skladanka', rola: 'osobny' },
  arkusz: { nazwa: 'Arkusz użytków', opis: 'Wizytówki, naklejki, etykiety – jeden projekt powielony na arkuszu drukarskim.', ikona: 'siatka', rodzaj: 'arkusz', rola: 'osobny' },
};

// Typ sekcji: zapisany `typ` albo – dla sekcji bez typu (starsze projekty, sekcja zbudowana w kodzie) – wynikający
// z jej parametrów (okładka, sekcja specjalna, rola). Nigdy z nazwy.
export function typSekcji(s) {
  if (!s) return 'zwykla';
  if (TYPY_SEKCJI[s.typ]) return s.typ;
  if (s.okladka) return 'okladka';
  const r = s.specjalna?.rodzaj;
  if (r === 'wyklejka') return s.specjalna.strona === 'tylna' ? 'wyklejka_tylna' : 'wyklejka_przednia';
  if (r && TYPY_SEKCJI[r]) return r;
  if (s.rola === 'wkladka' || s.rola === 'podkladka') return s.rola;
  return 'zwykla';
}

export const rolaTypu = (typ) => TYPY_SEKCJI[typ]?.rola || 'blok';
// Czy sekcja ma numery stron i liczy się do bloku (grzbiet okładki): tylko typy z rolą „blok”.
export const wBloku = (s) => rolaTypu(typSekcji(s)) === 'blok';
export const pozaNumeracja = (s) => !wBloku(s);
