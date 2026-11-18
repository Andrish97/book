# „Makietka” jako GPT w ChatGPT – logowanie hasłem Makietki w zwykłym czacie

Dla osób, które chcą pracować z Makietką w zwykłym ChatGPT (także w darmowym planie – GPT-y z akcjami może
używać każdy; utworzyć GPT trzeba raz, z konta z płatnym planem). Rozmowa z GPT prosi o zalogowanie do Makietki
(okno logowania i zgody Makietki – wybór projektów i zakresu), potem GPT czyta i zmienia projekty.

## Utworzenie GPT (raz, właściciel Makietki)

1. ChatGPT → **Explore GPTs** → **Create** → **Configure**. Nazwa: „Makietka”. Instrukcje: „Pracujesz z projektami
   użytkownika w Makietce. Na początku wywołaj opis, potem używaj wywolaj (parametry narzędzia w polu json).
   Zmieniaj małymi krokami i sprawdzaj wynik. Odpowiadaj po polsku.”
2. **Actions** → **Create new action** → **Import from URL**: `https://makietka.app/ai/gpt/openapi.json`.
3. **Authentication** → **OAuth**:
   - Authorization URL: `https://api.makietka.app/mcp/oauth/authorize`
   - Token URL: `https://api.makietka.app/mcp/oauth/token`
   - Scope: `makietka`
   - Token exchange method: Default (POST request)
   - Client ID / Client Secret: najpierw zapisz akcję z dowolnymi wartościami, skopiuj **Callback URL**
     (`https://chat.openai.com/aip/g-…/oauth/callback`), zarejestruj klienta:

     ```sh
     curl -X POST https://api.makietka.app/mcp/oauth/register \
       -H 'content-type: application/json' \
       -d '{"client_name":"ChatGPT – Makietka","redirect_uris":["<Callback URL>"]}'
     ```

     i wpisz zwrócony `client_id` jako Client ID (Client Secret – dowolny tekst, Makietka go nie używa: PKCE).
4. Zapisz GPT jako **Publiczny** albo „Każdy z linkiem” i wpisz jego adres w `js/marka.js` (`ADRES_GPT`) – wtedy
   okno „Sztuczna inteligencja” → „Zwykły czat” pokaże przycisk „Otwórz GPT Makietka”.

Token to zwykły klucz dostępu AI – użytkownik widzi go w ustawieniach konta (opis „Łącznik: ChatGPT – Makietka”)
i może go odebrać.
