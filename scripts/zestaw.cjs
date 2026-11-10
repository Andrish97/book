// Wspólne dla skryptów pobierających czcionki: lista z js/zestaw-czcionek.js i zapytanie do Google Fonts.
const fs = require('node:fs');
const path = require('node:path');

const zrodlo = fs.readFileSync(path.join(__dirname, '..', 'js', 'zestaw-czcionek.js'), 'utf8');
const ZESTAW = JSON.parse(zrodlo.slice(zrodlo.indexOf('['), zrodlo.lastIndexOf(']') + 1));

// Odmiany rodziny w zapisie Google Fonts (css2). Inter ma dodatkowe grubości – używa go interfejs aplikacji.
function odmiany(c, wagi = [400, 700]) {
  const w = c.pogrubiona ? wagi : [400];
  if (c.kursywa) return `:ital,wght@${[0, 1].flatMap((i) => w.map((x) => `${i},${x}`)).join(';')}`;
  return w.length > 1 ? `:wght@${w.join(';')}` : '';
}
const adresRodziny = (c, wagi) => `${c.nazwa.replace(/ /g, '+')}${odmiany(c, wagi)}`;
const slug = (rodzina) => rodzina.toLowerCase().replace(/\s+/g, '-');

module.exports = { ZESTAW, adresRodziny, slug };
