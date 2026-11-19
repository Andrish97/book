// Porównanie wyglądu z inną wersją arkuszy (silnik stylów, #291): przechodzi po ekranach, ustawieniach konta,
// panelu administratora, edytorze (z zaznaczonym tekstem i kształtem), wszystkich oknach z index.html i podglądzie –
// na komputerze i telefonie, w obu motywach – i w każdym stanie porównuje wyliczone style każdego elementu
// z bieżącymi arkuszami i z arkuszami z podanej wersji gita. Bez szumu zrzutów (godziny, animacje, tokeny).
//
// Użycie:  node scripts/porownaj-style.cjs [wersja=HEAD] [--wyjscie=plik.txt]
// Kod wyjścia 1, gdy są różnice; lista różnic: „urządzenie/motyw/stan ścieżka-elementu: właściwość: wtedy → teraz”.
// Przy przenoszeniu reguł i zamianie kolorów na tokeny wynik ma być pusty.

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');
const { porownajStyle } = require('../tests/porownaj-style.cjs');

const KORZEN = path.join(__dirname, '..');
const ARG = process.argv.slice(2);
const WERSJA = ARG.find((a) => !a.startsWith('--')) || 'HEAD';
const WYJSCIE = ARG.find((a) => a.startsWith('--wyjscie='))?.slice('--wyjscie='.length);

// Arkusze aplikacji z danej wersji – w kolejności z jej index.html, url() przeliczone od korzenia strony.
function arkuszeWersji(wersja) {
  const git = (p) => execFileSync('git', ['show', `${wersja}:${p}`], { cwd: KORZEN, encoding: 'utf8', maxBuffer: 64 << 20 });
  const linki = [...git('index.html').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]).filter((l) => !/czcionki/.test(l));
  return linki.map((p) => git(p).replace(/url\((['"]?)(?!data:|https?:|#|\/)([^'")]+)\1\)/g, (_, q, u) => `url(${q}/${path.posix.normalize(path.posix.join(path.posix.dirname(p), u))}${q})`)).join('\n');
}

async function przejdz(tryb, stary) {
  const sprzatanie = [];
  const t = { after: (fn) => sprzatanie.push(fn) };
  const { strona, baza } = await otworz(t, tryb === 'telefon' ? { telefon: true } : { widok: { width: 1400, height: 900 } });
  const w = [];
  const por = async (g) => {
    for (const motyw of ['jasny', 'ciemny']) {
      await strona.evaluate((m) => { if (m === 'ciemny') document.documentElement.dataset.motyw = 'ciemny'; else delete document.documentElement.dataset.motyw; }, motyw);
      w.push(...await porownajStyle(strona, stary, `${tryb}/${motyw}/${g}`));
    }
    await strona.evaluate(() => { delete document.documentElement.dataset.motyw; });
  };
  try {
    await nowyProjekt(strona, 'Porównanie');
    await strona.waitForTimeout(800);
    await strona.evaluate(() => { location.hash = '#/'; });
    await strona.waitForTimeout(800);
    await por('projekty');
    for (const s of ['profil', 'ai', 'wyglad', 'bezpieczenstwo', 'miejsce', 'czcionki', 'powiadomienia', 'marka']) {
      await strona.evaluate((x) => { location.hash = `#/konto/${x}`; }, s);
      await strona.waitForTimeout(500);
      await por(`konto/${s}`);
    }
    baza.administratorzy.add(baza.konta[0].id);
    baza.adminPoczta.przyjmij({ od_email: 'ola@przyklad.pl', temat: 'Pomysł', tekst: 'Treść', zrodlo: 'formularz' });
    await strona.reload();
    await strona.waitForTimeout(1500);
    for (const z of ['skrzynka', 'poczta', 'statystyki', 'kopie']) {
      await strona.evaluate((x) => { location.hash = `#/admin/${x}`; }, z);
      await strona.waitForTimeout(700);
      await por(`admin/${z}`);
    }
    await strona.evaluate(() => { location.hash = '#/'; });
    await strona.waitForTimeout(700);
    await strona.click('.karta-projektu .otworz-projekt');
    await strona.waitForTimeout(1200);
    await por('edytor');
    for (const kod of ['dodajTekst', 'dodajProstokat']) {
      await strona.evaluate((k) => { const e = window.seriodruk.edytor; e.odznacz(); const o = e[k](); e.canvas.setActiveObject(o); e.canvas.requestRenderAll(); }, kod);
      await strona.waitForTimeout(300);
      await por(`edytor/${kod}`);
    }
    for (const id of await strona.$$eval('dialog[id]', (d) => d.map((x) => x.id))) {
      const ok = await strona.evaluate((i) => { const d = document.getElementById(i); if (d.open) return false; try { d.showModal(); return true; } catch { return false; } }, id);
      if (!ok) continue;
      await por(`okno ${id}`);
      await strona.evaluate((i) => document.getElementById(i).close(), id);
    }
    // Stany otwierane akcjami (instrukcja, biblioteka, gotowe sekcje, lista wyboru – na telefonie zasłonka).
    // Bez Escape – w podglądzie Escape z niego wychodzi; okna zamyka się wprost.
    const akcja = async (nazwa, g, przed = null) => {
      await strona.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); });
      if (przed) await strona.evaluate(przed);
      const ok = await strona.evaluate((n) => { const b = [...document.querySelectorAll(`[data-akcja="${n}"]`)].find((x) => x.offsetParent) || document.querySelector(`[data-akcja="${n}"]`); if (!b) return false; b.click(); return true; }, nazwa);
      if (!ok) return;
      await strona.waitForTimeout(900);
      await por(g);
    };
    await akcja('instrukcja', 'instrukcja');
    await akcja('biblioteka', 'biblioteka');
    await akcja('gotowe-sekcje', 'gotowe sekcje');
    await strona.keyboard.press('Escape').catch(() => {});
    await strona.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); const e = window.seriodruk.edytor; e.odznacz(); const o = e.dodajTekst(); e.canvas.setActiveObject(o); e.canvas.requestRenderAll(); });
    await strona.waitForTimeout(300);
    await strona.evaluate(() => { const b = [...document.querySelectorAll('#wlasciwosci .wybor-przycisk')].find((x) => x.offsetParent); b?.click(); });
    await strona.waitForTimeout(400);
    await por('lista wyboru');
    await strona.keyboard.press('Escape').catch(() => {});
    await strona.evaluate(() => { location.hash = `#/p/${window.seriodruk.stan.projekt.id}/podglad`; });
    await strona.waitForTimeout(1500);
    await por('podglad');
    await akcja('podglad-prezentacja', 'prezentacja');
  } finally {
    for (const fn of sprzatanie) await fn();
  }
  return w;
}

(async () => {
  const stary = arkuszeWersji(WERSJA);
  const roznice = [...await przejdz('komputer', stary), ...await przejdz('telefon', stary)];
  if (WYJSCIE) fs.writeFileSync(WYJSCIE, roznice.join('\n'));
  if (!roznice.length) { console.log(`Bez różnic względem ${WERSJA}.`); return; }
  // Zbiorczo: ta sama różnica na wielu elementach / w wielu stanach – raz, z liczbą.
  const zbior = new Map();
  for (const r of roznice) {
    const m = r.match(/^(.*?) (\S+): (.*)$/);
    const k = m ? `${m[2].split('>').pop().replace(/:\d+$/, '')}: ${m[3]}` : r;
    zbior.set(k, [...(zbior.get(k) || []), r]);
  }
  console.log(`Różnice względem ${WERSJA}: ${roznice.length} (${zbior.size} rodzajów)`);
  for (const [k, l] of [...zbior].sort((a, b) => b[1].length - a[1].length).slice(0, 40)) console.log(`  ${String(l.length).padStart(5)}× ${k.slice(0, 160)}\n         np. ${l[0].slice(0, 200)}`);
  process.exitCode = 1;
})();
