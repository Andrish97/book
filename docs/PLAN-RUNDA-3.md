# Plan – runda 3 (uwagi z 18.11.2026)

Uwagi użytkownika uporządkowane w etapy; numery w nawiasach – numery z listy użytkownika. Plan potwierdzony
z poprawkami 18.11 (punkty 6, 14, 15, 17, 20). Zasada: rzeczy, które wymagają sprawdzenia albo zatwierdzenia
wyglądu przez użytkownika (logo, ikona) – na sam koniec. Przypomnienie co godzinę wraca do pracy, gdyby stanęła.
Stan: ✅ zrobione · 🔄 w toku · ⏳ czeka · ℹ️ już było.
Szczegóły każdej zmiany – docs/DECYZJE.md, bieżący stan – docs/ZGLOSZENIA.md.

## Zrobione

| # | Uwaga | Stan |
|---|---|---|
| A1 | Kopia projektu: link sam się kasuje | ✅ #201 |
| A2 | (3) Okno Udostępnij na telefonie nie przewija się | ✅ #202 |
| A3 | (1) Makieta 3D na telefonie – „Kurza twarz” | ✅ #203 |
| A4 | (2) Udostępnianie w tle, oglądający widzi „podgląd w przygotowaniu” | ✅ #204 |
| A6 | Ekran ładowania – wyrównanie tekstu | ✅ #200 |
| B1 | (8) Motyw – przycisk na górze, 3 tryby | ✅ #205 (+ czytelniejsza ikona „jak w systemie”) |
| B2 | (13) Wyłączenie przyciągania | ℹ️ Widok → „Przyciągaj do elementów” |
| B3 | (10) Wyłączenie e-maili w powiadomieniach | ✅ #206 |

## Kolejność dalszej pracy

| # | Uwaga – jak rozumiem | Stan |
|---|---|---|
| 1 | (14) **Szablony projektów** – osobno od szablonów sekcji. Szablon projektu to cały zestaw sekcji z ustawieniami, np. książka w twardej oprawie: okładka twarda, wyklejka przednia, blok z krotnością 16, wyklejka tylna; książka miękka, broszura zeszytowa (krotność 4), planer i album w twardej oprawie… – gotowe od razu pod makietę 3D. W „Nowy projekt” → „Gotowego szablonu” galeria szablonów projektów w tym samym oknie. Szablony sekcji zostają w edytorze (wstawianie sekcji). | ✅ #208 |
| 2 | (11) Panel administratora: zakładki na górze na telefonie z podpisami, ładniejsza skrzynka, kolejka i ustawienia poczty jako jedna zakładka „Poczta”, czyszczenie starych kopii zapasowych | ✅ #207 |
| 3 | (17) Pola z właściwości projektu bez wpisywania (lista pól do wstawienia) – tylko z tego, co już jest w ustawieniach projektu, bez dokładania nowych ustawień | ✅ #209 |
| 4 | (12) Kopiowanie stron, sekcji i elementów między projektami | ✅ #210 |
| 5 | (9) Kilka zestawów marki | ✅ #211 |
| 6 | (6) Książka: automatyczne dokładanie stron przy długim tekście, wybór czy rozdział (i inne sekcje) zaczyna się od nowej strony, obrazy w tekście z opływaniem, wcięcia i odstępy, przypisy, klikalny spis treści, więcej wzorców | ✅ #212 (reszta była: opływanie, przypisy, spis treści, linki w PDF) |
| 7 | (19) Druk na folii / kolorowym papierze: podłoże przezroczyste albo kolorowe, widoczne w edytorze, podglądzie i 3D; biały poddruk na folii | ✅ #213 (biały poddruk – uszlachetnienie elementu, było) |
| 8 | (20) Materiały i uszlachetnienia według standardów drukarni (okleiny: płótno, skóra ekologiczna, papier; tłoczenie, złocenie/hot-stamping, lakier wybiórczy UV, folia mat/błysk/soft-touch) z kolorami; zaokrąglone rogi w opcjach sekcji okładki; widok w 3D i eksport ustawień | ✅ #214 |
| 9 | (7) Przetestować wszystkie makiety 3D | ✅ #215 |
| 10 | (15) Makieta dobrana do projektu: projekt spełnia zwykle jedną, najwyżej dwie makiety (np. książka twarda albo miękka, czasem spirala); tylko te są dostępne, inne (np. kalendarz dla książki) się nie pokazują; przy brakach – co brakuje i propozycja uzupełnienia (np. białe strony) | ✅ #215 |
| 11 | (16) Wycinanki i składanki: typy linii (cięcie, zgięcie, klejenie), miejsca klejenia, grupa wycinana jako jeden kawałek, druga strona arkusza, łączenie, zawijanie po krzywej, ustawienia plotera, gotowe wzory, sprawdzenie złożenia, makieta 3D | ✅ #218, #222, #223 (linie wykrojnika, druga strona arkusza, nowe wykroje); reszta → punkt 16 (tryb składanek) |
| 12 | (5) Zgodność z innymi programami: odczyt i zapis formatów (IDML, Scribus, DOCX, EPUB, PDF) | ✅ #216: DOCX, ODT, Markdown, TXT – odczyt; DOCX i EPUB – zapis; #220: Scribus (.sla), #221: IDML (InDesign, Affinity, Quark) – zapis całego układu; #225: odczyt IDML i SLA (z pakietem obrazów, pola scalania) |
| 12a | (5) **Serie a inne programy** (Publisher, InDesign, Affinity, Word, Scribus – korespondencja seryjna): zapis „szablon + dane” (IDML z <<pole>> + CSV z @obrazami; DOCX z polami scalania + XLSX/CSV dla Publishera i Worda) obok zapisu z rozwiniętymi stronami; odczyt <<pole>> z IDML i MERGEFIELD z DOCX jako pola {pole}, z CSV od razu tabela i seria; Publisher (.pub) – tekst z polami i obrazy bez układu. **Źródło danych przypięte do tabeli**: oryginalny Excel/CSV jako załącznik projektu (nazwa, arkusz, data), „Wczytaj nową wersję” z porównaniem (kolumny używane w polach, wiersze), „Odśwież z tego samego pliku” (pamiętany dostęp do pliku w Chrome/Edge), arkusz z sieci (link CSV), pobranie danych jako XLSX, znacznik „zmienione w Makietce”. | ✅ #226 (szablon + dane, MERGEFIELD), #227 (źródło danych), #228 (odczyt Publishera .pub), #229 (Word z układem stron, SVG), #232 (raport przeniesienia przy zapisie i odczycie) |
| 13 | AI: własne klucze API wielu dostawców z wyborem modelu, własny czat w Makietce, łącznik MCP z logowaniem przez zatwierdzenie, uprawnienia per projekt, bez przywiązania do dostawcy | ✅ #217 (czat z własnym kluczem, OpenRouter z logowaniem, uprawnienia per projekt; łącznik MCP był) |
| 14 | (18) Przełącznik języka – 3 języki jak w Familiadzie (tłumaczenie całej aplikacji) | ✅ #219 |
| 15 | (4) Ikona i logo – propozycje do zatwierdzenia (na koniec – wymaga oceny wyglądu) | ✅ #240 (znaki cięcia) |
| 16 | **Tryb składanek i wycinanek** – ogólny tryb z własnymi narzędziami: modele z wielu części na wielu arkuszach, grubość materiału z kompensacją, zakładki, miejsca klejenia z numerami, szczeliny, połączenia, sprawdzanie, szablony, 3D z instrukcją, pop-up (ustalenia: docs/PLAN-SKLADANKI.md). Na koniec – „dość skomplikowane”. | ✅ #233 (krok 1–2 z 8: tryb, ustawienia, część, narzędzia, połączenia numerami), #234 (krok 4: sprawdzanie), #235 (krok 3: połączenia), #236 (krok 5: arkusze), #237 (krok 6: szablony z kompensacją grubości), #238 (krok 7: 3D i instrukcja montażu), #261 (krok 8 częściowo: pop-up wycinanka; krok 10 częściowo: walec, stożek, stożek ścięty), #262 (kula z klinów), #263 (krok 11: bryła z kształtu), #264 (krok 9: model 3D OBJ/STL na siatkę), #265 (krok 14: domek, samochód), #266 (łuki z pióra), #267 (bryła obrotowa – wazon), #268 (mechanizm: klapa wsuwana), #269 (pop-up: platforma wklejana), #270 (druga warstwa pop-up), #271 (zatrzask), #272 (pop-up: zgięcie V), #273 (pop-up w makiecie 3D), #274 (Rozetnij część), #275 (Scal części), #276 (żółw), #277 (kolory z MTL), #278 (koło obrotowe), #279 (suwak), #280 (klapki z zawiasem), #281 (zgięcia po łuku, pudełko-poduszka), #282 (łączenie brył: ściany z dachem), #283 (tekstura modelu 3D) – wszystkie kroki docs/PLAN-SKLADANKI.md zrobione |
| 17 | **AI według koncepcji „Makietka AI 1.0”** (dokument od użytkownika, 18.11): łącznik z logowaniem OAuth 2.1, drobniejsze zakresy uprawnień, zatwierdzanie usuwania w czacie, Ustawienia → Sztuczna inteligencja (kilku dostawców, test połączenia, klucze opcjonalnie na koncie), streaming i czytelne błędy, brakujące narzędzia. Audyt i plan: docs/PLAN-AI.md. **Robione przed dokończeniem punktu 16** (składanki: pop-up, rozkładanie brył 3D…). | ✅ plan AI kroki 1–7: #244 (OAuth), #252 (zakresy), #255 (zgoda), #256 (połączenie, błędy), #259 (streaming), #260 (zdjęcia), #257 (narzędzia), #258 (dokumentacja); okno kluczy #241–#251, #254 |
| 18 | **Silnik stylów jak w Familiadzie** – warstwy (tokeny, baza, komponenty), katalog komponentów, test-strażnik przed elementami w wyglądzie przeglądarki. Na później, po punkcie 17 i 16 (plan: docs/PLAN-STYLE.md). | 🕓 na później |

Każdy punkt: test, instrukcja, DECYZJE, ZGŁOSZENIA, commit i push.
