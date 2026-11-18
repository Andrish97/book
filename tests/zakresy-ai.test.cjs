// Drobniejsze zakresy kluczy AI (#252): przy nowym kluczu i w okienku edycji można odebrać AI strony, wzorce i style,
// tabele i serie, obrazy, eksport. Pilnuje baza (ai_zakres_brak) – tu jej odpowiednik w atrapie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi, zamknijAi, PNG_2X2 } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('zakresy klucza AI: bez obrazów i stron – baza odmawia z wyjaśnieniem; po zmianie w okienku edycji – pozwala', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zakresy');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await zapisano(strona);

  await oknoAi(strona);
  // Zakresy widać tylko przy kluczu do zmian.
  assert.equal(await strona.isVisible('#dostep-ai-uprawnienia'), true);
  assert.equal(await strona.locator('#dostep-ai-uprawnienia input:checked').count(), 5, 'domyślnie wszystko');
  await strona.selectOption('#dostep-ai-rola', 'odczyt');
  assert.equal(await strona.isVisible('#dostep-ai-uprawnienia'), false);
  await strona.selectOption('#dostep-ai-rola', 'edycja');
  await strona.uncheck('#dostep-ai-uprawnienia input[value="obrazy"]');
  await strona.uncheck('#dostep-ai-uprawnienia input[value="strony"]');
  await strona.fill('#dostep-ai-opis', 'Bez obrazów');
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  await zamknijAi(strona);

  const obraz = () => baza.ai('ai_wgraj_obraz', { p_klucz: klucz, p_nazwa: 'a.png', p_typ: 'image/png', p_dane: PNG_2X2.toString('base64') });
  assert.match(obraz().blad, /nie pozwala wgrywać, wymieniać ani usuwać obrazów.*Ustawienia konta → Sztuczna inteligencja → Edytuj/);
  const p = baza.ai('ai_projekt', { p_klucz: klucz });
  const s = p.projekt.strony[0];
  assert.match(baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: p.wersja, p_zmiany: { strony: [{ ...s, id: 'nowa-strona' }] } }).blad, /nie pozwala dodawać, usuwać ani przestawiać stron/);
  assert.match(baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: p.wersja, p_zmiany: { usun_strony: [s.id] } }).blad, /nie pozwala/);
  // Zmiana istniejącej strony i wzorce – wolno.
  const zmiana = baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: p.wersja, p_zmiany: { strony: [{ ...s, obiekty: [] }] } });
  assert.ok(!zmiana.blad, JSON.stringify(zmiana));

  // Lista mówi, czego klucz nie może; okienko edycji przywraca obrazy.
  await oknoAi(strona, { zaznacz: false, tryb: 'lista' });
  await strona.click('[data-sekcja-ai="lacznik"]');
  const wiersz = strona.locator('#dostep-ai-lista-lacznik li', { hasText: 'Bez obrazów' });
  await strona.waitForFunction(() => /bez: stron, obrazów/.test(document.querySelector('#dostep-ai-lista-lacznik').textContent));
  await wiersz.locator('button', { hasText: 'Edytuj' }).click();
  await strona.waitForSelector('#dlg-edytuj-klucz-ai[open]');
  assert.equal(await strona.isChecked('#dlg-edytuj-klucz-ai .uprawnienia-klucza input[value="obrazy"]'), false);
  await strona.check('#dlg-edytuj-klucz-ai .uprawnienia-klucza input[value="obrazy"]');
  await strona.locator('#dlg-edytuj-klucz-ai button', { hasText: 'Zapisz zmiany' }).click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-edytuj-klucz-ai').open);
  await strona.waitForFunction(() => /bez: stron ·/.test(document.querySelector('#dostep-ai-lista-lacznik').textContent));
  assert.ok(!obraz().blad, 'po zmianie obrazy wolno');
  assert.deepEqual(bledy, []);
});
