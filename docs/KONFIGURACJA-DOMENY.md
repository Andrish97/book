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

## Stare adresy

- `https://andrish97.github.io/book/…` – GitHub przekierowuje na `https://makietka.app/…` (po kroku 2).
- Adresy łącznika `https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/<klucz>` – działają dalej
  (to ta sama funkcja), ale okno „Dostęp dla AI” po przełączeniu podaje już adres z `api.makietka.app`.
