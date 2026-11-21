// Aplikacja makietka.app (#347): pliki podaje Cloudflare (static assets), a ten kod tylko przekierowuje
// www.makietka.app na makietka.app – jeden adres, jedno logowanie i jedna pamięć przeglądarki.
export default {
  async fetch(zapytanie, env) {
    const url = new URL(zapytanie.url);
    if (url.hostname === 'www.makietka.app') {
      url.hostname = 'makietka.app';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(zapytanie);
  },
};
