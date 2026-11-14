# Konfiguracja domeny makietka.app, przekaźnika API i poczty Brevo

Krok po kroku, co kliknąć. Nic z tego nie wymaga podawania mi kluczy – wszystkie hasła i klucze wpisujesz
tylko w panelach Cloudflare, Brevo i Supabase. Kolejność ma znaczenie: najpierw domena aplikacji (1–2),
potem przekaźnik (3), na końcu maile (4).

Co gdzie będzie:

| Adres | Co to | Skąd |
|---|---|---|
| `https://makietka.app/` | aplikacja | GitHub Pages (to samo repozytorium, własna domena) |
| `https://api.makietka.app/` | przekaźnik do bazy i adres łącznika AI (`…/mcp/<klucz>`) | Cloudflare Worker (`cloudflare/`) |
| `no-reply@makietka.app` | nadawca maili (logowanie, reset hasła, zaproszenia) | Brevo |

## 1. Cloudflare: DNS dla aplikacji

Cloudflare → wybierz domenę **makietka.app** → **DNS** → **Records** → **Add record**. Dodaj osiem rekordów
dla samej domeny (pole **Name**: `@`) i jeden dla `www`. Przy każdym przełącz **Proxy status** na
**DNS only** (szara chmurka) – GitHub sam wystawia certyfikat HTTPS i musi widzieć swoje adresy.

| Type | Name | Content |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | andrish97.github.io |

Jeśli w DNS są już inne rekordy A/AAAA/CNAME dla `@` albo `www` (np. „parking” rejestratora) – usuń je.

## 2. GitHub: własna domena dla Pages

GitHub → repozytorium **Andrish97/book** → **Settings** → **Pages** → **Custom domain**: wpisz
`makietka.app` → **Save**. GitHub sprawdzi DNS (zwykle kilka minut, czasem do 24 h). Gdy pokaże
„DNS check successful”, zaznacz **Enforce HTTPS** (pole robi się aktywne, gdy certyfikat jest gotowy –
do godziny).

Pliku `CNAME` w repozytorium nie trzeba: strona wdraża się przepływem GitHub Actions, a wtedy domena
jest tylko w ustawieniach Pages.

Sprawdzenie: `https://makietka.app/` otwiera aplikację, a `https://andrish97.github.io/book/` przekierowuje
na nową domenę (razem z linkami do projektów i podglądów).

## 3. Cloudflare: przekaźnik api.makietka.app (Worker z repozytorium)

Worker wdraża się sam z katalogu `cloudflare/` po każdym pushu na `main` (integracja Git Cloudflare,
„Workers Builds”).

1. Cloudflare → **Workers & Pages** → **Create** → zakładka **Workers** → **Import a repository**.
2. **Connect GitHub** – zezwól aplikacji Cloudflare na dostęp do repozytorium **Andrish97/book**
   (wystarczy to jedno) → wybierz je.
3. Ustawienia (**Set up your application** / **Build settings**; część pól jest pod **Advanced settings**):
   - **Project name**: `makietka-api` – musi być dokładnie taka jak `name` w `cloudflare/wrangler.jsonc`,
     inaczej budowanie się nie uda;
   - **Production branch**: `main`;
   - **Root directory** (katalog główny / Path): `cloudflare`;
   - **Build command**: puste;
   - **Deploy command**: `npx wrangler deploy`;
   - **Build watch paths** (jeśli są): Include `cloudflare/*` – wtedy Worker buduje się tylko po zmianie
     w tym katalogu.
4. **Deploy**. Własną domenę `api.makietka.app` (rekord DNS i certyfikat) Cloudflare tworzy sam
   z `routes` w `wrangler.jsonc` – nie dodawaj jej ręcznie.

Sprawdzenie: `https://api.makietka.app/` pokazuje „Makietka – API (przekaźnik do bazy)”.
Wtedy przełączam aplikację na przekaźnik (`PRZEZ_WORKER = true` w `js/marka.js`): od tej chwili okno
„Dostęp dla AI” daje adres `https://api.makietka.app/mcp/<klucz>`. Przy przełączeniu każdy raz się
wyloguje (sesja jest zapisana pod adresem bazy) – projekty są na koncie, nic nie ginie.

## 3a. Pliki w R2 (Cloudflare)

Obrazy, czcionki i obrazy stron linków leżą w Cloudflare R2 (10 GB za darmo, bez opłat za transfer).
Przekaźnik `api.makietka.app` obsługuje je pod `/pliki/…` i `/podglady/…` (decyzja #92).

1. Cloudflare → **R2 Object Storage** → włącz R2 (Cloudflare prosi o metodę płatności także dla darmowego progu;
   bez przekroczenia 10 GB nic nie płacisz).
2. **Create bucket** → nazwa **`makietka-files`**, lokalizacja automatyczna (albo Europa) → **Create**.
3. Nic więcej: powiązanie bucketu z Workerem (`PLIKI`) jest w `cloudflare/wrangler.jsonc` i ustawia się samo przy
   wdrożeniu Workera z repozytorium.
4. Sprawdzenie: po wdrożeniu `https://api.makietka.app/pliki/_miejsce` bez logowania odpowiada `401`
   („Zaloguj się ponownie”), a nie `503` („Magazyn plików nie jest podłączony”).

Kolejność: bucket i wdrożony Worker **przed** scaleniem wersji aplikacji, która używa R2 – inaczej obrazy
przestaną się wgrywać i pobierać. Pierwsze zalogowanie po zmianie przenosi Twoje pliki ze starego magazynu
(karta „Przenoszenie plików do nowego magazynu”).

## 4. Maile (Brevo)

Wszystkie maile – logowanie, reset hasła, zaproszenia do współpracy – wysyła funkcja Edge przez API Brevo,
podpięta w Supabase jako hak „Send Email Hook”. SMTP nie używamy.

1. **Brevo** (konto na brevo.com, plan darmowy: 300 maili dziennie) → **Senders, Domains & Dedicated IPs**
   → **Domains** → **Add a domain** → `makietka.app`. Rekordy DNS, które pokaże Brevo (TXT `brevo-code:…`,
   DKIM – dwa CNAME `brevo1._domainkey` i `brevo2._domainkey` albo jeden TXT, TXT `_dmarc`, np.
   `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`), dodaj w Cloudflare → **DNS** jako **DNS only**
   (szara chmurka; wartości kopiuj z Brevo) – albo zgódź się na automatyczne dodanie, jeśli Brevo je
   zaproponuje. Potem w Brevo **Verify** / **Authenticate this email domain**.
2. **Brevo** → **Senders** → **Add a sender**: nazwa `Makietka`, adres `no-reply@makietka.app`.
3. **Brevo** → **SMTP & API** → **API Keys** → **Generate a new API key** (np. „Makietka”). To klucz API,
   nie klucz SMTP.
4. **Supabase** → **Edge Functions** → **Secrets** → dodaj `BREVO_API_KEY` (klucz z punktu 3) i resztę
   sekretów funkcji „poczta” – lista w sekcji „Maile – sekrety i hak” niżej.
5. **Supabase** → **Authentication** → **Hooks** → **Send Email** → typ **HTTPS** → adres funkcji „poczta”
   (sekcja niżej) → **Generate secret** → skopiuj i wklej jako sekret `SEND_EMAIL_HOOK_SECRET` (punkt 4)
   → **Create**/**Save**.

Sprawdzenie: na ekranie logowania **Nie pamiętasz hasła?** na swój adres – mail od „Makietka
<no-reply@makietka.app>”, link prowadzi do `https://makietka.app/`.

**Authentication → URL Configuration** nie zmieniaj ręcznie: adres aplikacji (`https://makietka.app/`)
i adresy powrotu wdraża repozytorium (`supabase/config.toml`) – ręczna zmiana zostałaby nadpisana.

<!-- Sekcję „Maile – sekrety i hak” (adres funkcji poczta, pełna lista sekretów: BREVO_API_KEY,
SEND_EMAIL_HOOK_SECRET, MAIL_FROM_EMAIL, MAIL_FROM_NAME, SITE_URL) dopisuje praca o współpracy między kontami. -->

## 4a. Maile przez ZeptoMail (Zoho) – drugi dostawca za Brevo (decyzja #105)

**Kolejność:** 1. **Brevo**, 2. **ZeptoMail** (domyślnie wyłączony). Gdy Brevo odmówi, wiadomość idzie przez
ZeptoMail, jeśli jest włączony. Kolejność, włączenie i dzienne limity (ZeptoMail 1000/dobę) ustawia się w
**Panel administratora → Ustawienia poczty → Dostawcy**; tam też „Test” dla każdego dostawcy. Gdy baza jest chwilowo
niedostępna (mail logowania z haka Auth), funkcja wysyła przez Brevo.

1. **ZeptoMail → Mail Agents → Add Mail Agent** – nazwa „Makietka” (osobny agent, niezależny od Familiady).
2. **Domains → Add domain** – `makietka.app`, agent „Makietka”. ZeptoMail pokaże dwa rekordy DNS:
   - **DKIM** – rekord **TXT** z nazwą w rodzaju `…._domainkey` i długą wartością,
   - **bounce** – rekord **CNAME**, np. `bounce` → adres w domenie ZeptoMail (przez niego idzie też SPF).
3. **Cloudflare → makietka.app → DNS → Records** – dodaj oba rekordy dokładnie tak, jak podał ZeptoMail,
   z szarą chmurką („DNS only”). Osobnego rekordu SPF dla ZeptoMail nie trzeba (obsługuje go rekord bounce).
   Jeśli kiedyś dopisujesz SPF ręcznie: w domenie może być **tylko jeden** rekord `TXT` zaczynający się od
   `v=spf1` – kilku dostawców łączy się w nim kolejnymi `include:` (np. `v=spf1 include:spf.brevo.com include:_spf.mx.cloudflare.net ~all`).
4. W ZeptoMail kliknij **Verify** przy domenie (publikacja rekordów trwa od kilku minut do kilkunastu godzin).
5. **Mail Agents → Makietka → SMTP/API → zakładka API** – skopiuj **Send Mail token** (ciąg zaczynający się
   zwykle od `Zoho-enczapikey …` albo sam token – kod przyjmuje obie postacie).
6. **Supabase → Edge Functions → Secrets → Add new secret** :
   - `ZEPTOMAIL_API_KEY` = skopiowany token,
   - `ZEPTOMAIL_REGION` = `eu` (centrum danych Zoho EU; bez tej zmiennej też przyjmowane jest `eu`),
   - opcjonalnie `ZEPTOMAIL_BOUNCE_ADDRESS` – adres bounce z ustawień agenta (zwykle niepotrzebny).
7. **Włączenie:** Panel administratora → Ustawienia poczty → **Włączony** przy ZeptoMail → zapisz. Kolumna
   **Sekret** pokazuje, czy sekret jest ustawiony; **Test** przy ZeptoMail wysyła mail testowy tylko przez niego.

## 5. Skrzynka kontakt@makietka.app, formularz kontaktowy i kolejka maili (decyzja #95)

Panel administratora (w aplikacji: kółko z inicjałem → **Panel administratora**, adres `#/admin`) ma skrzynkę
`kontakt@makietka.app`, kolejkę maili, ustawienia poczty i statystyki. Poczta przychodząca i formularz
kontaktowy przechodzą przez Workera `makietka-api`, wysyłka – przez funkcję „poczta” i kolejkę w bazie.

**Kolejność** (wszystko po wdrożeniu tej wersji: migracja bazy wdraża się sama po pushu na `main`, Worker –
przez Workers Builds):

1. **Cloudflare → makietka-api → Settings → Variables and Secrets → Secret `SUPABASE_SERVICE_ROLE_KEY` = secret
   key z Supabase** (Supabase → **Project Settings** → **API Keys** → **Secret keys**, `sb_secret_…`) → **Deploy**.
   To jedyny sekret, którego Worker potrzebuje do skrzynki i formularza (decyzja #106).
2. **Cloudflare** → **makietka.app** → **Email** → **Email Routing** → **Routing rules** (Email Routing jest już
   włączony). Worker `makietka-api` pojawi się na liście „Send to a Worker” dopiero **po wdrożeniu tej wersji
   Workera** (z obsługą poczty) – wcześniej widać tylko inne Workery. Wtedy przy każdym z adresów:
   - `kontakt@makietka.app` → **Edit** → Action **Send to a Worker** → destination `makietka-api` → **Save**;
   - `noreply@makietka.app` (dziś „Drop”) → **Edit** → Action **Send to a Worker** → `makietka-api` → **Save**;
   - `no-reply@makietka.app` – **Create address** (z myślnikiem: z tego adresu aplikacja wysyła maile, więc
     tu trafiają odpowiedzi ludzi, których program pocztowy pominie „odpowiedz do”) → Action **Send to a Worker**
     → `makietka-api` → **Save**.

   **Catch-all zostaje bez zmian** (na Twoją prywatną skrzynkę) – dotyczy tylko adresów bez własnej reguły.
   Poczta na `noreply@`/`no-reply@` trafia do tej samej **Skrzynki** w panelu z plakietką „na noreply@”
   (bez automatycznej odpowiedzi – decyzja #95f); odpowiadasz z panelu, czyli z `kontakt@`.
   (Wysyłka przez Brevo działa dalej – Email Routing dotyczy tylko poczty przychodzącej.)
3. *(Opcjonalnie)* **Kopia na Twoją skrzynkę**: w Workerze dodaj sekret `FORWARD_TO` z adresem z listy
   **Destination addresses** w Email Routing (potwierdzonym) – każda wiadomość do Workera trafi też do Ciebie.
4. *(Opcjonalnie)* **Turnstile** (ochrona formularza przed botami): Cloudflare → **Turnstile** → **Add widget**
   → domena `makietka.app`, tryb **Managed** → skopiuj **Site Key** (publiczny – wpisuję go do aplikacji,
   `js/app/kontakt.js`, stała `KLUCZ_TURNSTILE`) i **Secret Key** → w Workerze sekret `TURNSTILE_SECRET`.
   Bez Turnstile formularz chronią pułapka na boty i limity (na IP, adres i dobę).

Nic nie trzeba ustawiać w Supabase: funkcja „poczta” przetwarza kolejkę kluczem serwisowym, który Supabase daje
funkcjom sam, a co minutę prosi ją o to Cron Trigger Workera (`wrangler.jsonc` → `triggers.crons`).

Sprawdzenie:
- **Panel → Ustawienia poczty → Test wysyłki** – mail testowy przez kolejkę (w **Kolejce maili** stan „wysłany”).
- Wyślij maila na `kontakt@makietka.app` ze swojej skrzynki – po chwili jest w **Skrzynce**; odpowiedz
  z panelu – odpowiedź przychodzi z `kontakt@makietka.app`, a Twoja odpowiedź na nią wraca do tej samej rozmowy.
- **Kontakt** (stopka ekranu logowania albo menu konta) – wiadomość w Skrzynce z plakietką „formularz”,
  potwierdzenie na podany adres.

## Stare adresy

- `https://andrish97.github.io/book/…` – GitHub przekierowuje na `https://makietka.app/…` (po kroku 2).
- Adresy łącznika `https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/<klucz>` – działają dalej
  (to ta sama funkcja), ale okno „Dostęp dla AI” po przełączeniu podaje już adres z `api.makietka.app`.
