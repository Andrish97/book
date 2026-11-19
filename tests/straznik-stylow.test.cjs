// Silnik stylów, krok 4 (#289): test-strażnik.
// 1) Na ekranach, w panelach i oknach aplikacji (komputer i telefon) nie ma przycisku ani pola w wyglądzie domyślnym
//    przeglądarki – każdy element ma styl bazowy albo klasę komponentu (tak wyglądały przyciski w oknie
//    „Sztuczna inteligencja”, 18.11).
// 2) Zasady arkuszy: !important i kolory wpisane poza tokenami (:root) – liczby nie mogą rosnąć (zapadka; kolejne
//    kroki silnika schodzą do zera), w JS żadnych kolorów wpisanych w style elementów.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');
const { sprawdzStyle } = require('./straznik-stylow.cjs');

const KORZEN = path.join(__dirname, '..');

// Liczby z arkuszy aplikacji (bez czcionek): komentarze pominięte, bloki tokenów (:root { … }) też.
function policzArkusze() {
  const pliki = fs.readdirSync(path.join(KORZEN, 'css'), { recursive: true }).filter((p) => p.endsWith('.css') && !p.startsWith('czcionki'));
  let important = 0;
  const kolory = [];
  for (const p of pliki) {
    const s = fs.readFileSync(path.join(KORZEN, 'css', p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // #295: !important tylko w klasach widoczności (display) i przy kursorze nad płótnem (Fabric wpisuje kursor
    // w styl elementu) – reszta przez mocniejszy selektor.
    for (const m of s.matchAll(/([a-z-]+)\s*:[^;{}]*!important/g)) if (!['display', 'cursor'].includes(m[1])) important += 1;
    const bez = s.replace(/:root(\[[^\]]*\])?\s*\{[^}]*\}/g, '');
    for (const k of bez.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || []) kolory.push(`${p}: ${k}`);
  }
  return { important, kolory };
}

// Zapadka: wartości z chwili wprowadzenia strażnika; kroki 2 i 6 je obniżają (nie wolno podnieść).
// #294: kolory poza tokenami – 0 (wszystkie w tokens.css).
const NAJWIECEJ = { important: 0, kolory: 0 };

test('zasady arkuszy: !important i kolory spoza tokenów nie przybywają; w JS bez kolorów wpisanych w style', () => {
  const { important, kolory } = policzArkusze();
  assert.ok(important <= NAJWIECEJ.important, `!important poza display i cursor: ${important} – użyj mocniejszego selektora (np. :root:root …)`);
  assert.ok(kolory.length <= NAJWIECEJ.kolory, `kolory poza tokenami: ${kolory.length} (najwyżej ${NAJWIECEJ.kolory}) – dodaj token w :root i użyj var(--…)`);
  // JS: przypisanie koloru-literału do stylu elementu interfejsu (kolory z danych projektu idą przez zmienne).
  const zle = [];
  for (const p of fs.readdirSync(path.join(KORZEN, 'js'), { recursive: true }).filter((x) => x.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(KORZEN, 'js', p), 'utf8');
    for (const m of s.matchAll(/\.style\.(background|backgroundColor|color|borderColor|outlineColor)\s*=\s*['"`](#[0-9a-fA-F]{3,8}|rgba?\()/g)) zle.push(`${p}: ${m[0]}`);
  }
  assert.deepEqual(zle, [], 'kolor wpisany w styl elementu w JS – użyj klasy albo var(--…)');
  // HTML: bez atrybutu style (#295) – wygląd tylko w arkuszach.
  for (const p of ['index.html', 'katalog-komponentow.html']) assert.doesNotMatch(fs.readFileSync(path.join(KORZEN, p), 'utf8'), /\sstyle="/, `${p}: styl wpisany w HTML`);
});

test('strażnik wyłapuje przycisk w wyglądzie przeglądarki (kalibracja)', async (t) => {
  const { strona } = await otworz(t, { widok: { width: 1200, height: 800 } });
  await strona.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
    d.innerHTML = '<button id="goly">Goły</button><button id="pol" style="background:#fff">Pół</button>';
    document.body.append(d);
  });
  const w = await sprawdzStyle(strona, 'próba');
  assert.equal(w.filter((x) => /#goly/.test(x)).length, 1, 'cały wygląd domyślny');
  assert.equal(w.filter((x) => /#pol/.test(x)).length, 1, 'resztki: wypukła ramka przeglądarki');
});

for (const tryb of ['komputer', 'telefon']) {
  test(`strażnik: ekrany, panele i okna bez przycisków i pól w wyglądzie przeglądarki (${tryb})`, async (t) => {
    const { strona, bledy } = await otworz(t, tryb === 'telefon' ? { telefon: true } : { widok: { width: 1400, height: 900 } });
    const w = [];
    const sp = async (g) => w.push(...await sprawdzStyle(strona, g));
    await sp('projekty');
    for (const s of ['profil', 'ai', 'wyglad', 'bezpieczenstwo', 'miejsce', 'czcionki']) {
      await strona.evaluate((x) => { location.hash = `#/konto/${x}`; }, s);
      await strona.waitForTimeout(300);
      await sp(`konto/${s}`);
      if (s !== 'ai') continue;
      await strona.waitForSelector('#dostep-ai[data-gotowy]');
      for (const z of ['czat', 'lacznik', 'kopiuj', 'zwykly']) {
        await strona.click(`[data-sekcja-ai="${z}"]`);
        await sp(`AI/${z}`);
        const dodaj = strona.locator(`.sekcja-kluczy-ai[data-sposob="${z}"] [data-dodaj-klucz-ai]`);
        if (await dodaj.count() && await dodaj.first().isVisible()) {
          await dodaj.first().click();
          await strona.waitForSelector('#dlg-klucz-ai[open]');
          await sp(`AI/${z}/Dodaj klucz`);
          await strona.evaluate(() => document.querySelector('#dlg-klucz-ai').close());
        }
      }
    }
    await strona.evaluate(() => { location.hash = '#/'; });
    await strona.waitForTimeout(400);
    await nowyProjekt(strona, 'Strażnik');
    await sp('edytor');
    for (const [n, kod] of [['tekst', 'dodajTekst'], ['prostokąt', 'dodajProstokat']]) {
      await strona.evaluate((k) => { const e = window.seriodruk.edytor; e.odznacz(); const o = e[k](); e.canvas.setActiveObject(o); e.canvas.requestRenderAll(); }, kod);
      await strona.waitForTimeout(250);
      await sp(`edytor/zaznaczony ${n}`);
    }
    // Wszystkie okna z index.html, po kolei.
    for (const id of await strona.$$eval('dialog[id]', (d) => d.map((x) => x.id))) {
      const ok = await strona.evaluate((i) => { const d = document.getElementById(i); if (d.open) return false; try { d.showModal(); return true; } catch { return false; } }, id);
      if (!ok) continue;
      await sp(`okno #${id}`);
      await strona.evaluate((i) => document.getElementById(i).close(), id);
    }
    assert.deepEqual([...new Set(w)], []);
    assert.deepEqual(bledy, []);
  });
}
