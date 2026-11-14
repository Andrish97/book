# Zgłoszenia – lista uwag i ich stan

Bieżąca lista Twoich uwag z rozmów: co zrobione, co w toku, co czeka. Szczegóły i cytaty każdej decyzji są w
[DECYZJE.md](DECYZJE.md) (numery w nawiasach). Aktualizuję ją przy każdej nowej uwadze i po każdym scaleniu.

Oznaczenia: ✅ zrobione i wdrożone · 🔄 w toku · ⏳ czeka (kolejny etap) · 👤 krok po Twojej stronie

## W toku

| # | Uwaga | Stan |
|---|---|---|
| 107 | Bez przejściowego stanu „link aktualizowany” i bez starego magazynu Supabase Storage; polecenia i opisy AI także w oknie Dostęp dla AI w ustawieniach konta | 🔄 |

## Czeka (kolejne etapy)

| Uwaga | Stan |
|---|---|
| Skrzynka jak w Familiadzie (bez marketingu, styl Makietki): foldery, lista, wątki, pisanie nowych wiadomości z TinyMCE, odpowiedz/przekaż, robocze, załączniki, operacje zbiorcze | ⏳ zaraz |
| 15 decyzji wyglądu (#109) – wdrożenie | 🔄 |
| Instrukcja: dopisać funkcje z #103 (Ctrl+K, kolory projektu, tabela −/+, PDF „Zaawansowane”) i zrzuty nowych rozdziałów | ⏳ |
| Reszta propozycji wyglądu i edytora z #103 na później: pasek szybkich akcji przy zaznaczeniu, podgląd wybranego wiersza danych w edytorze, szablony startowe, segmenty w Serii, Szer./Wys./Spad w rzędzie, ⋯ na karcie obrazu | ⏳ |
| Pełny przegląd zrzutów wszystkich ekranów po zmianach #103/#104 (kolejny etap poprawek interfejsu) | ⏳ |
| Niestabilne testy pod obciążeniem: „obrazy poza pamięcią”, „grupa otwarta: obraz kadruje”, „tekst przez strony” – naprawić | ⏳ |
| Sprawdzenie na prawdziwym telefonie: gesty iPhone (#101), klawiatura w zasłonkach, instalacja aplikacji | ⏳ |

## Kroki po Twojej stronie

| Krok | Stan |
|---|---|
| Cloudflare → makietka-api → Settings → Variables and Secrets → sekret `SUPABASE_SERVICE_ROLE_KEY` (secret key z Supabase → Project Settings → API Keys) – po wdrożeniu #106 | 👤 |
| Email Routing: kontakt@, noreply@, no-reply@ → Send to a Worker → makietka-api (catch-all zostaje) | 👤 |
| Zoho: weryfikacja domeny makietka.app (support), potem włączenie ZeptoMail w panelu | 👤 |
| Opublikować ponownie link z hasłem w oknie Udostępnij (po #107) i usunąć w Supabase → Storage buckety zasoby i podglady | 👤 |
| Wyczyścić dane strony andrish97.github.io na swoich urządzeniach (stary moduł offline nie przekierowuje) | 👤 |

## Zrobione

| # | Uwaga |
|---|---|
| 73 | Okna jako zasłonki na telefonie i tablecie, przegląd zrzutów |
| 74 | Familiada – korzystać do woli |
| 71 | Duże zdjęcia od AI w kawałkach (do 25 MB) |
| 75–77 | Zdjęcia z komputera i z czatu: link do wgrania, ChatGPT pliki z czatu, `wgraj_czesciami` bez domen |
| 78–79 | Claude odrzucał listę narzędzi łącznika (`_meta`, `ttlMs`/`cacheScope`) |
| 80 | Otwarta karta nadpisywała zmiany AI |
| 81 | Tekst od AI Times 40 mm → Inter 14 pt |
| 82 | Okno obrazów otwierało się długo i lagowało |
| 83 | Optymalizacja (pisanie, przeciąganie, zapis) i karta postępu |
| 84, 101 | Powiększanie i gesty w podglądzie; procent zmienia tylko strony (iPhone) |
| 86 | Współpraca między kontami, wspólna edycja, obecność |
| 87 | Działać bez pytania |
| 88–89 | Marka Makietka, domena makietka.app, przekaźnik api.makietka.app |
| 90, 92, 93, 96 | Miejsce na koncie, pliki w R2, limity (2 GB, 50 MB, 100 projektów, 1000 obrazów, 20 osób), panel użycia konta |
| 91 | Tryby urządzeń i przegląd 70 widoków × 15 urządzeń |
| 94, 100 | Klucz AI dla całego konta, tylko w ustawieniach konta |
| 95, 95h | Panel administratora: skrzynka kontakt@, kolejka, ustawienia poczty, limity, statystyki; formularz kontaktowy bez maili |
| 96 | Podpowiedzi o klawiaturze schowane na telefonie |
| 97 | Sprzątanie bazy (129 MB linków z hasłem → R2) |
| 92b | Stary magazyn i kod przenoszenia usunięte |
| 99 | Własne kontrolki (listy na telefonie), instalacja aplikacji, bezpieczne marginesy, plakietka na kafelku, pełny ekran na logowaniu, przycisk motywu |
| 100 | Nazwy użytkownika (rejestracja, pierwsze logowanie, zapraszanie po nazwie); konto bez danych całej aplikacji |
| 104 | Instrukcja w stylu Familiady: 42 rozdziały, spis z wyszukiwarką, edytor i panel właściwości szczegółowo, dane w praktyce (kalendarz ze świętami, dziennik, planer, obrót i kolor z danych), AI krok po kroku + komiks + polecenia „Kopiuj”, automatyczne zrzuty w CI |
| 105–106 | ZeptoMail (Zoho, EU) jako drugi dostawca po Brevo, włączany przełącznikiem; sekrety po angielsku, bez klucza skrzynki – jeden sekret `SUPABASE_SERVICE_ROLE_KEY` |
| 108 | Konta testowe usunięte |
| 103 | Kompaktowość i ikony (13 propozycji: tabela −/+, PDF „Zaawansowane”, ikony w Danych, Czcionkach, Obrazach, zaproszeniach, imporcie) + paleta poleceń Ctrl+K i kolory projektu w wyborze koloru |
| 102 | Pasek prezentacji, wspólna kontrolka powiększenia, X zamiast „Zamknij” |
| – | Brevo: wysyłka działa po wyłączeniu blokady IP (reset hasła sprawdzony) |
