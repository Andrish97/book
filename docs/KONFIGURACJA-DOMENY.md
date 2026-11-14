# Konfiguracja domeny makietka.app, przekaźnika API i poczty Brevo

Krok po kroku, co kliknąć. Nic z tego nie wymaga podawania mi kluczy – wszystkie hasła i klucze wpisujesz
tylko w panelach Cloudflare, Brevo i Supabase. Kolejność ma znaczenie: najpierw domena aplikacji (1–2),
potem przekaźnik (3), na końcu poczta (4–6).

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

## 4. Brevo: domena i nadawca

1. Załóż konto na brevo.com (plan darmowy: 300 maili dziennie).
2. **Senders, Domains & Dedicated IPs** (ikona trybika/menu konta) → **Domains** → **Add a domain** →
   `makietka.app`.
3. Uwierzytelnienie domeny: jeśli Brevo zaproponuje automatyczne dodanie rekordów w Cloudflare – zgódź
   się. Jeśli nie, wybierz ręczne (**Authenticate the domain yourself**) i dodaj w Cloudflare → DNS
   rekordy, które Brevo pokaże (wartości są indywidualne – kopiuj z Brevo):
   - **TXT** `@` – `brevo-code:…`,
   - **DKIM** – dwa rekordy **CNAME** (`brevo1._domainkey`, `brevo2._domainkey`) albo jeden TXT, zależnie
     od tego, co pokaże Brevo,
   - **TXT** `_dmarc` – np. `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`.

   Wszystkie jako **DNS only** (szara chmurka). Potem w Brevo **Authenticate this email domain**.
4. **Senders** → **Add a sender**: nazwa `Makietka`, adres `no-reply@makietka.app`.
5. **SMTP & API** → zakładka **SMTP**: zanotuj **Login** (np. `…@smtp-brevo.com`) i wygeneruj
   **SMTP key** (to hasło SMTP – nie klucz API).
6. **SMTP & API** → zakładka **API keys** → **Generate a new API key** (nazwa np. „Makietka –
   zaproszenia”) – do maili z zaproszeniami do współpracy.

## 5. Supabase: poczta przez Brevo

Panel Supabase → projekt **pganajmivwtstapnwsgv**:

1. **Authentication** → **Emails** → **SMTP Settings** → **Enable custom SMTP**:
   - Sender email: `no-reply@makietka.app`, Sender name: `Makietka`,
   - Host: `smtp-relay.brevo.com`, Port: `587`,
   - Username: login SMTP z Brevo, Password: klucz SMTP z Brevo → **Save**.
2. **Authentication** → **Rate Limits** → limit maili na godzinę podnieś np. do `100` (z własnym SMTP
   domyślnie 30).
3. **Edge Functions** → **Secrets** (albo Project Settings → Edge Functions) → **Add new secret**:
   nazwa `BREVO_API_KEY`, wartość – klucz API z Brevo (punkt 4.6). Z niego korzystają maile z
   zaproszeniami.
4. **Authentication** → **URL Configuration** – nic nie zmieniaj ręcznie: adres aplikacji
   (`https://makietka.app/`) i adresy powrotu wdraża repozytorium (`supabase/config.toml`). Ręczna
   zmiana zostałaby nadpisana przy następnym wdrożeniu.

Hasła SMTP nie ma w repozytorium. `config.toml` nie zawiera bloku `[auth.email.smtp]`, więc wdrożenia
nie powinny ruszać ustawień z punktu 1 – po pierwszym wdrożeniu po tej zmianie zajrzyj jeszcze raz do
SMTP Settings (krok 6).

## 6. Sprawdzenie i ostatnie przełączenia

1. Na ekranie logowania aplikacji **Nie pamiętasz hasła?** na swój adres → mail od „Makietka
   <no-reply@makietka.app>”, link prowadzi do `https://makietka.app/`.
2. Po kolejnym wdrożeniu (dowolny push) – czy **SMTP Settings** w Supabase dalej są włączone.
3. Gdy poczta działa, włączam w `supabase/config.toml` własne szablony maili z marką Makietka i
   potwierdzanie adresu przy rejestracji (`enable_confirmations = true`). Wcześniej nie można: Supabase
   z wbudowaną pocztą odrzuca szablony i całe wdrożenie (razem z migracjami) kończy się błędem.

## Stare adresy

- `https://andrish97.github.io/book/…` – GitHub przekierowuje na `https://makietka.app/…` (po kroku 2).
- Adresy łącznika `https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/<klucz>` – działają dalej
  (to ta sama funkcja), ale okno „Dostęp dla AI” po przełączeniu podaje już adres z `api.makietka.app`.
