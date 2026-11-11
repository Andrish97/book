const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Punkt strony (mm) → punkt ekranu.
const naEkranie = (strona, x, y) => strona.evaluate(([mx, my]) => {
  const c = window.seriodruk.edytor.canvas;
  const v = c.viewportTransform;
  const r = c.upperCanvasEl.getBoundingClientRect();
  return [r.left + mx * v[0] + v[4], r.top + my * v[3] + v[5]];
}, [x, y]);
const klik = async (strona, x, y) => strona.mouse.click(...(await naEkranie(strona, x, y)));
const dwuklik = async (strona, x, y) => strona.mouse.dblclick(...(await naEkranie(strona, x, y)));
const przeciagnij = async (strona, z, na) => {
  await strona.mouse.move(...(await naEkranie(strona, ...z)));
  await strona.mouse.down();
  await strona.mouse.move(...(await naEkranie(strona, ...na)), { steps: 6 });
  await strona.mouse.up();
};
const krok = (strona) => strona.waitForTimeout(450); // osobny krok historii
// Mysz trafia w całe piksele ekranu, czyli z dokładnością ok. 0,4 mm strony.
const blisko = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

// Stan grupy i jej elementów: położenia na arkuszu (lewy górny róg ramki otaczającej), nie względem grupy.
const stan = (strona) => strona.evaluate(() => {
  const e = window.seriodruk.edytor;
  const z = (x) => Math.round(x * 100) / 100;
  const wszystkie = e.canvas.getObjects();
  const g = wszystkie.find((o) => o.type === 'group');
  const ramka = (o) => { o.setCoords(); const r = o.getBoundingRect(); return [z(r.left), z(r.top), z(r.width), z(r.height)]; };
  const a = e.aktywny;
  return {
    kolejnosc: wszystkie.map((o) => o.nazwa || o.type),
    grupa: g ? { id: g.id, ramka: ramka(g), kat: z(g.angle || 0), interaktywna: Boolean(g.interactive || g.subTargetCheck) } : null,
    dzieci: g ? Object.fromEntries(g.getObjects().map((d) => [d.nazwa || d.type, ramka(d)])) : {},
    kolejnoscWGrupie: g ? g.getObjects().map((d) => d.nazwa || d.type) : [],
    otwarta: e.otwartaGrupa?.id || null,
    aktywny: a ? (a.nazwa || a.type) : null,
    pisze: Boolean(a?.isEditing),
    tekst: g?.getObjects().find((d) => d.type === 'textbox')?.text,
  };
});

// Strona: prostokąt „Tło”, nad nim grupa (prostokąt „Czerwony” + tekst „Napis”), na wierzchu elipsa „Kółko”.
const przygotuj = (strona, { kat = 0 } = {}) => strona.evaluate((obrot) => {
  const e = window.seriodruk.edytor;
  const tlo = e.dodajProstokat(); tlo.set({ left: 10, top: 150, width: 60, height: 30, fill: '#dddddd', strokeWidth: 0, nazwa: 'Tło' }); tlo.setCoords();
  const a = e.dodajProstokat(); a.set({ left: 20, top: 20, width: 30, height: 20, fill: '#ff0000', strokeWidth: 0, nazwa: 'Czerwony' }); a.setCoords();
  const b = e.dodajTekst('Napis'); b.set({ left: 60, top: 22, width: 40, nazwa: 'Napis' }); b.setCoords();
  e.canvas.setActiveObject(new window.fabric.ActiveSelection([a, b], { canvas: e.canvas }));
  e.grupuj();
  const g = e.aktywny;
  if (obrot) { g.rotate(obrot); g.setCoords(); }
  const k = e.dodajElipse(); k.set({ left: 100, top: 150, nazwa: 'Kółko' }); k.setCoords();
  e.canvas.discardActiveObject();
  e.zatwierdz();
  return g.id;
}, kat);

test('grupa: podwójne kliknięcie otwiera – element da się przesunąć, zmienić liczbami i napisać w nim tekst; Esc i kliknięcie obok zamykają; cofanie po jednym kroku', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Grupa');
  const id = await przygotuj(strona);
  await krok(strona);
  let s = await stan(strona);
  assert.deepEqual(s.kolejnosc, ['Tło', 'group', 'Kółko']);
  assert.deepEqual(s.dzieci.Czerwony, [20, 20, 30, 20]);
  const ramkaNapisu = s.dzieci.Napis;

  // Jedno kliknięcie zaznacza całą grupę; podwójne otwiera ją i zaznacza element pod kursorem.
  await klik(strona, 30, 30);
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta], ['group', null]);
  assert.match(await strona.textContent('.wlasciwosci'), /Pojedynczy element grupy zmienisz bez rozgrupowywania/);
  await dwuklik(strona, 30, 30);
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta], ['Czerwony', id]);
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Prostokąt w grupie');
  assert.match(await strona.textContent('.wlasciwosci'), /Zmieniasz jeden element grupy/);
  assert.equal(await strona.locator('.wlasciwosci button:has-text("Rozgrupuj")').count(), 0);
  assert.equal(await strona.locator('.wlasciwosci :text("Wyrównaj do marginesów")').count(), 1, 'element grupy też da się wyrównać do marginesów');
  // Na płótnie otwartą grupę widać: pomarańczowa ramka z podpisem nad lewym górnym rogiem.
  const podpis = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const c = e.canvas;
    const v = c.viewportTransform;
    const g = c.getObjects().find((o) => o.type === 'group');
    const r = g.getBoundingRect();
    const dpr = c.getRetinaScaling();
    c.renderAll();
    return [...c.lowerCanvasEl.getContext('2d').getImageData(Math.round((v[4] + r.left * v[0] + 3) * dpr), Math.round((v[5] + r.top * v[3] - 17) * dpr), 1, 1).data].slice(0, 3).join(',');
  });
  assert.equal(await podpis(), '234,88,12');

  // Przeciągnięcie elementu: przesuwa się on, drugi element zostaje; ramka grupy obejmuje oba; grupa zostaje otwarta.
  await strona.keyboard.down('Control'); // bez przyciągania
  await przeciagnij(strona, [30, 30], [30, 60]);
  await strona.keyboard.up('Control');
  s = await stan(strona);
  assert.ok(blisko(s.dzieci.Czerwony[0], 20) && blisko(s.dzieci.Czerwony[1], 50), `prostokąt zjechał o 30 mm: ${s.dzieci.Czerwony}`);
  assert.deepEqual(s.dzieci.Napis, ramkaNapisu, 'tekst został na miejscu');
  // Ramka grupy to teraz: od góry tekstu (22 mm) do dołu przesuniętego prostokąta (70 mm).
  assert.ok(blisko(s.grupa.ramka[1], 22) && blisko(s.grupa.ramka[1] + s.grupa.ramka[3], 70), `ramka grupy objęła nowe położenie: ${s.grupa.ramka}`);
  assert.deepEqual([s.aktywny, s.otwarta, s.grupa.id], ['Czerwony', id, id]);
  assert.deepEqual(s.kolejnosc, ['Tło', 'group', 'Kółko'], 'grupa nie zmieniła miejsca w stosie');
  const poPrzeciagnieciu = s.dzieci.Czerwony;
  await krok(strona);

  // Położenie i rozmiar liczbami – w milimetrach arkusza, nie względem grupy.
  const pole = (nazwa) => strona.locator(`.wlasciwosci label:has-text("${nazwa}") input`).first();
  assert.ok(blisko(Number(await pole('X').inputValue()), 20) && blisko(Number(await pole('Y').inputValue()), 50), 'pola pokazują położenie na arkuszu');
  await pole('X').fill('35');
  await pole('X').press('Enter');
  s = await stan(strona);
  assert.equal(s.dzieci.Czerwony[0], 35);
  assert.ok(blisko(s.dzieci.Czerwony[1], 50));
  assert.equal(s.otwarta, id);
  await krok(strona);
  await pole('Szerokość').fill('45');
  await pole('Szerokość').press('Enter');
  s = await stan(strona);
  assert.deepEqual([s.dzieci.Czerwony[0], s.dzieci.Czerwony[2]], [35, 45]);
  await krok(strona);

  // Cofanie: jedna zmiana = jeden krok; po cofnięciu ten sam element jest znów zaznaczony w otwartej grupie.
  await strona.evaluate(() => document.activeElement?.blur()); // skrót ma trafić do strony, nie do pola z liczbą
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group'); return g && Math.abs(g.getObjects()[0].getScaledWidth() - 30) < 0.01; });
  s = await stan(strona);
  assert.deepEqual([s.dzieci.Czerwony[0], s.dzieci.Czerwony[2]], [35, 30], 'cofnięta tylko szerokość');
  assert.deepEqual([s.aktywny, s.otwarta, s.grupa.id], ['Czerwony', id, id]);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const e = window.seriodruk.edytor; const g = e.canvas.getObjects().find((o) => o.type === 'group'); return g && Math.abs(e.polozenieNaArkuszu(g.getObjects()[0]).x - 35) > 1; });
  s = await stan(strona);
  assert.deepEqual(s.dzieci.Czerwony, poPrzeciagnieciu, 'cofnięte położenie z pola X; przeciągnięcie zostało');
  await krok(strona);

  // Skalowanie uchwytem: prawy dolny róg prostokąta (50, 70) ciągnięty na zewnątrz – rośnie tylko ten element.
  await przeciagnij(strona, [50, 70], [65, 80]);
  s = await stan(strona);
  const poSkalowaniu = s.dzieci.Czerwony;
  assert.ok(blisko(poSkalowaniu[0], 20) && blisko(poSkalowaniu[1], 50) && poSkalowaniu[2] > 40 && blisko(poSkalowaniu[2] / poSkalowaniu[3], 1.5, 0.02), `prostokąt urósł z zachowaniem proporcji: ${poSkalowaniu}`);
  assert.deepEqual(s.dzieci.Napis, ramkaNapisu);
  assert.ok(blisko(s.grupa.ramka[1] + s.grupa.ramka[3], poSkalowaniu[1] + poSkalowaniu[3], 0.05), `ramka grupy sięga dołu powiększonego prostokąta: ${s.grupa.ramka}`);
  assert.deepEqual([s.aktywny, s.otwarta], ['Czerwony', id]);
  await krok(strona);

  // Kliknięcie drugiego elementu grupy zaznacza go; pisanie w nim zmienia tekst.
  await klik(strona, 70, 25);
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta], ['Napis', id]);
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Tekst w grupie');
  await strona.evaluate(() => window.seriodruk.edytor.edytujTekst());
  await strona.keyboard.insertText('Nowy napis w grupie');
  s = await stan(strona);
  assert.deepEqual([s.pisze, s.tekst, s.otwarta], [true, 'Nowy napis w grupie', id]);
  // Pierwszy Esc kończy pisanie, drugi zamyka grupę – zaznaczona jest cała.
  await strona.keyboard.press('Escape');
  s = await stan(strona);
  assert.deepEqual([s.pisze, s.aktywny, s.otwarta], [false, 'Napis', id]);
  await strona.keyboard.press('Escape');
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta, s.grupa.interaktywna], ['group', null, false]);
  assert.deepEqual(s.dzieci.Czerwony, poSkalowaniu, 'po zamknięciu elementy są tam, gdzie były');
  assert.ok(blisko(s.grupa.ramka[0], 20) && blisko(s.grupa.ramka[1], 22) && blisko(s.grupa.ramka[1] + s.grupa.ramka[3], poSkalowaniu[1] + poSkalowaniu[3], 0.05), `ramka grupy = ramka jej elementów: ${s.grupa.ramka}`);
  assert.notEqual(await podpis(), '234,88,12', 'po zamknięciu ramka otwartej grupy znika');

  // Zapis: grupa z tym samym identyfikatorem, na tym samym miejscu w stosie, ze zmienionymi elementami.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  let zapis = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.map((o) => [o.nazwa || o.type, o.id, o.interactive ?? null, (o.objects || []).map((d) => d.text || d.nazwa)]));
  assert.deepEqual(zapis, [['Tło', zapis[0][1], null, []], ['group', id, false, ['Czerwony', 'Nowy napis w grupie']], ['Kółko', zapis[2][1], null, []]]);

  // Kliknięcie poza grupą zamyka ją (nic nie jest zaznaczone); kliknięcie innego elementu – zaznacza tamten.
  await dwuklik(strona, 30, 60);
  assert.equal((await stan(strona)).otwarta, id);
  await klik(strona, 130, 100);
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta, s.grupa.interaktywna], [null, null, false]);
  await dwuklik(strona, 30, 60);
  await klik(strona, 30, 165);
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta], ['Tło', null]);

  // Zapis w trakcie pracy w otwartej grupie: w projekcie grupa jest zwykłą grupą; po wczytaniu jest zamknięta.
  await strona.evaluate((gid) => window.seriodruk.edytor.otworzGrupe(gid, 0), id);
  assert.equal((await stan(strona)).otwarta, id);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  zapis = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.filter((o) => o.type === 'group').map((o) => [o.interactive, o.subTargetCheck]));
  assert.deepEqual(zapis, [[false, false]]);
  await strona.evaluate(() => window.seriodruk.przeladuj());
  s = await stan(strona);
  assert.deepEqual([s.otwarta, s.grupa.interaktywna, s.grupa.id], [null, false, id]);
  assert.deepEqual(s.dzieci.Czerwony, poSkalowaniu);
  assert.deepEqual(bledy, []);
});

test('grupa w warstwach: kliknięcie elementu rozwiniętej grupy otwiera grupę i zaznacza go; kopia, kolejność i usunięcie elementu w grupie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Grupa w warstwach 2');
  const id = await przygotuj(strona);
  await strona.click('#zakladki-panelu label:has-text("Warstwy")');
  await strona.click('#lista-warstw .warstwa-rozwin');
  const wiersze = () => strona.evaluate(() => [...document.querySelectorAll('#lista-warstw li.warstwa')].map((li) => `${li.classList.contains('w-grupie') ? '  ' : ''}${li.querySelector('.warstwa-nazwa').textContent}${li.classList.contains('zaznaczona') ? ' *' : ''}${li.classList.contains('otwarta') ? ' (otwarta)' : ''}`));
  assert.deepEqual(await wiersze(), ['Kółko', 'Grupa', '  Napis', '  Czerwony', 'Tło']);

  await strona.click('#lista-warstw li.w-grupie:has-text("Czerwony") .warstwa-nazwa');
  let s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta], ['Czerwony', id]);
  assert.deepEqual(await wiersze(), ['Kółko', 'Grupa (otwarta)', '  Napis', '  Czerwony *', 'Tło']);
  await strona.click('#lista-warstw li.w-grupie:has-text("Napis") .warstwa-nazwa');
  assert.deepEqual(await wiersze(), ['Kółko', 'Grupa (otwarta)', '  Napis *', '  Czerwony', 'Tło']);
  // Tab chodzi po elementach otwartej grupy.
  await strona.locator('canvas.upper-canvas').focus().catch(() => {});
  await strona.evaluate(() => window.seriodruk.edytor.zaznaczSasiedni(1));
  assert.deepEqual([(await stan(strona)).aktywny, (await stan(strona)).otwarta], ['Czerwony', id]);

  // Kolejność: element idzie na wierzch wśród elementów grupy – grupa zostaje na swoim miejscu.
  await strona.evaluate(() => window.seriodruk.edytor.warstwa('wierzch'));
  s = await stan(strona);
  assert.deepEqual([s.kolejnoscWGrupie, s.kolejnosc, s.otwarta], [['Napis', 'Czerwony'], ['Tło', 'group', 'Kółko'], id]);
  await krok(strona);

  // Duplikuj (Ctrl+D): kopia zostaje w grupie, 5 mm obok, i jest zaznaczona.
  await strona.evaluate(() => window.seriodruk.edytor.duplikuj());
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group').getObjects().length === 3);
  s = await stan(strona);
  assert.deepEqual([s.kolejnosc, s.otwarta, s.aktywny], [['Tło', 'group', 'Kółko'], id, 'Czerwony']);
  const kopia = await strona.evaluate(() => { const e = window.seriodruk.edytor; const p = e.polozenieNaArkuszu(e.aktywny); return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, e.aktywny.id !== e.otwartaGrupa.getObjects()[1].id]; });
  assert.deepEqual(kopia, [25, 25, true]);
  await krok(strona);

  // Usuń: znika zaznaczony element, grupa zostaje (zamknięta i zaznaczona).
  await strona.evaluate(() => window.seriodruk.edytor.usun());
  s = await stan(strona);
  assert.deepEqual([s.kolejnoscWGrupie, s.aktywny, s.otwarta, s.kolejnosc], [['Napis', 'Czerwony'], 'group', null, ['Tło', 'group', 'Kółko']]);
  assert.deepEqual(s.dzieci.Czerwony, [20, 20, 30, 20]);
  await krok(strona);
  // Cofnięcie usunięcia przywraca kopię.
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group')?.getObjects().length === 3);

  // Kopiuj element grupy i wklej: wklejka jest osobnym elementem strony, w tym samym miejscu + 5 mm.
  await strona.evaluate((gid) => window.seriodruk.edytor.otworzGrupe(gid, 1), id);
  assert.equal((await stan(strona)).aktywny, 'Czerwony');
  await strona.evaluate(async () => { const e = window.seriodruk.edytor; await e.kopiuj(); await e.wklej(); });
  s = await stan(strona);
  assert.deepEqual([s.kolejnosc, s.otwarta, s.aktywny], [['Tło', 'group', 'Kółko', 'Czerwony'], null, 'Czerwony']);
  const wklejka = await strona.evaluate(() => { const a = window.seriodruk.edytor.aktywny; return [a.left, a.top, Boolean(a.parent)]; });
  assert.deepEqual(wklejka, [25, 25, false]);

  // Kliknięcie zwykłego elementu na liście zamyka grupę.
  await strona.click('#lista-warstw li.w-grupie:has-text("Napis") .warstwa-nazwa');
  assert.equal((await stan(strona)).otwarta, id);
  await strona.click('#lista-warstw li[data-id]:has-text("Kółko") .warstwa-nazwa');
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta], ['Kółko', null]);
  assert.deepEqual(bledy, []);
});

test('grupa obrócona i na rozkładówce: element przesuwany strzałkami i liczbami trafia tam, gdzie wskazują milimetry arkusza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Grupa na rozkładówce');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  for (let i = 1; i < 3; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(1));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.strony.length === 2);

  // Grupa na prawej stronie rozkładówki (strona ma 148 mm szerokości), obrócona o 30° i powiększona 1,5×.
  const id = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const a = e.dodajProstokat(); a.set({ left: 180, top: 40, width: 30, height: 20, fill: '#ff0000', strokeWidth: 0, nazwa: 'Czerwony' }); a.setCoords();
    const b = e.dodajProstokat(); b.set({ left: 220, top: 70, width: 20, height: 20, fill: '#0000ff', strokeWidth: 0, nazwa: 'Niebieski' }); b.setCoords();
    e.canvas.setActiveObject(new window.fabric.ActiveSelection([a, b], { canvas: e.canvas }));
    e.grupuj();
    const g = e.aktywny;
    g.set({ scaleX: 1.5, scaleY: 1.5 });
    g.rotate(30);
    g.setCoords();
    e.zatwierdz();
    return g.id;
  });
  const srodki = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.type === 'group');
    const z = (x) => Math.round(x * 100) / 100;
    return Object.fromEntries(g.getObjects().map((d) => { const c = d.getCenterPoint(); return [d.nazwa, [z(c.x), z(c.y)]]; }));
  });
  const przed = await srodki();
  await krok(strona);

  await strona.evaluate((gid) => window.seriodruk.edytor.otworzGrupe(gid, 0), id);
  assert.equal((await stan(strona)).aktywny, 'Czerwony');
  // Strzałka w prawo: 1 mm w prawo na arkuszu, choć grupa jest obrócona i przeskalowana.
  await strona.evaluate(() => window.seriodruk.edytor.przesun(10, 0));
  let po = await srodki();
  assert.ok(blisko(po.Czerwony[0], przed.Czerwony[0] + 10, 0.02) && blisko(po.Czerwony[1], przed.Czerwony[1], 0.02), `10 mm w prawo: ${przed.Czerwony} → ${po.Czerwony}`);
  assert.deepEqual(po.Niebieski, przed.Niebieski, 'drugi element stoi');
  await krok(strona);
  // Pola X, Y i Obrót pokazują wartości na arkuszu; wpisana liczba to położenie rogu elementu na arkuszu.
  const pole = (nazwa) => strona.locator(`.wlasciwosci label:has-text("${nazwa}") input`).first();
  assert.equal(Number(await pole('Obrót').inputValue()), 30);
  assert.equal(Number(await pole('Szerokość').inputValue()), 45, 'szerokość na arkuszu: 30 mm × 1,5');
  await pole('Y').fill('100');
  await pole('Y').press('Enter');
  const rog = await strona.evaluate(() => { const e = window.seriodruk.edytor; const p = e.polozenieNaArkuszu(e.aktywny); return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]; });
  assert.equal(rog[1], 100);
  assert.equal(Number(await pole('Y').inputValue()), 100);
  po = await srodki();
  assert.deepEqual(po.Niebieski, przed.Niebieski);
  const wOtwartej = po;

  // Zamknięcie przyciskiem z panelu: elementy stoją tam, gdzie stały; grupa ma ten sam kąt i identyfikator.
  await strona.click('.wlasciwosci button:has-text("Wróć do całej grupy")');
  let s = await stan(strona);
  assert.deepEqual([s.otwarta, s.aktywny, s.grupa.kat, s.grupa.id], [null, 'group', 30, id]);
  po = await srodki();
  for (const n of ['Czerwony', 'Niebieski']) assert.ok(blisko(po[n][0], wOtwartej[n][0], 0.02) && blisko(po[n][1], wOtwartej[n][1], 0.02), `${n}: ${wOtwartej[n]} → ${po[n]}`);

  // Zapis na rozkładówce: grupa należy do prawej strony; po wyjściu i powrocie elementy są na tych samych miejscach.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((x) => x.obiekty.map((o) => [o.type, o.id, o.angle])));
  assert.deepEqual(zapis, [[], [], [['group', id, 30]]]);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(2));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 2 && window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'group'));
  po = await srodki();
  for (const n of ['Czerwony', 'Niebieski']) assert.ok(blisko(po[n][0], wOtwartej[n][0], 0.02) && blisko(po[n][1], wOtwartej[n][1], 0.02), `po wczytaniu ${n}: ${wOtwartej[n]} → ${po[n]}`);
  s = await stan(strona);
  assert.deepEqual([s.otwarta, s.grupa.id, s.grupa.interaktywna], [null, id, false]);

  // Tabela i element wzorca się nie otwierają – tabela ma własne pisanie w komórkach.
  const tabela = await strona.evaluate(() => { const e = window.seriodruk.edytor; const tab = e.dodajTabele({ wiersze: 2, kolumny: 2 }); return e.otworzGrupe(tab) === null; });
  assert.equal(tabela, true);
  assert.deepEqual(bledy, []);
});

test('grupa otwarta: kilka elementów naraz – Shift+kliknięcie, przesuwanie, wyrównanie, kopia i usuwanie; element spoza grupy nie wchodzi do zaznaczenia', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Grupa – kilka naraz');
  const id = await przygotuj(strona);
  // Przycięcie grupy (tak jak po rozłożeniu przyciętego rysunku SVG) ma zostać na swoim miejscu.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.type === 'group');
    g.clipPath = new window.fabric.Rect({ originX: 'center', originY: 'center', left: 0, top: 0, width: 200, height: 100, strokeWidth: 0 });
    g.dirty = true;
  });
  const kadr = () => strona.evaluate(() => {
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group');
    if (!g.clipPath) return null;
    const p = g.clipPath.getRelativeCenterPoint().transform(g.calcTransformMatrix());
    return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
  });
  const kadrPrzed = await kadr();
  const zaznaczone = () => strona.evaluate(() => window.seriodruk.edytor.canvas.getActiveObjects().map((o) => o.nazwa || o.type).sort());

  await dwuklik(strona, 35, 30);
  assert.deepEqual([(await stan(strona)).aktywny, (await stan(strona)).otwarta], ['Czerwony', id]);
  // Shift+kliknięcie drugiego elementu grupy: zaznaczone oba, grupa zostaje otwarta.
  await strona.keyboard.down('Shift');
  await klik(strona, 65, 25);
  await strona.keyboard.up('Shift');
  let s = await stan(strona);
  assert.deepEqual([await zaznaczone(), s.otwarta], [['Czerwony', 'Napis'], id]);
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Zaznaczone elementy: 2');
  assert.match(await strona.textContent('.wlasciwosci'), /To elementy otwartej grupy/);
  const napisPrzed = s.dzieci.Napis;

  // Przeciągnięcie przesuwa oba razem.
  await przeciagnij(strona, [35, 30], [45, 42]);
  s = await stan(strona);
  assert.deepEqual([await zaznaczone(), s.otwarta, s.kolejnosc], [['Czerwony', 'Napis'], id, ['Tło', 'group', 'Kółko']]);
  assert.ok(blisko(s.dzieci.Czerwony[0], 30) && blisko(s.dzieci.Czerwony[1], 32), `prostokąt przesunięty: ${s.dzieci.Czerwony}`);
  assert.ok(blisko(s.dzieci.Napis[0], napisPrzed[0] + 10) && blisko(s.dzieci.Napis[1], napisPrzed[1] + 12), `tekst przesunięty razem: ${s.dzieci.Napis}`);
  await krok(strona);
  // Strzałki przesuwają zaznaczone o milimetry arkusza.
  await strona.evaluate(() => window.seriodruk.edytor.przesun(5, 0));
  let s2 = await stan(strona);
  assert.ok(blisko(s2.dzieci.Czerwony[0], s.dzieci.Czerwony[0] + 5, 0.01) && blisko(s2.dzieci.Napis[0], s.dzieci.Napis[0] + 5, 0.01), `strzałka: ${s2.dzieci.Czerwony} i ${s2.dzieci.Napis}`);
  // Wyrównanie do siebie: do góry.
  await strona.evaluate(() => window.seriodruk.edytor.wyrownaj('gora'));
  s2 = await stan(strona);
  assert.ok(blisko(s2.dzieci.Czerwony[1], s2.dzieci.Napis[1], 0.01), `górne krawędzie równo: ${s2.dzieci.Czerwony[1]} i ${s2.dzieci.Napis[1]}`);
  assert.deepEqual([await zaznaczone(), s2.otwarta], [['Czerwony', 'Napis'], id]);
  await krok(strona);

  // Duplikuj: kopie obu elementów zostają w grupie i są zaznaczone.
  await strona.evaluate(() => window.seriodruk.edytor.duplikuj());
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group').getObjects().length === 4);
  s = await stan(strona);
  assert.deepEqual([s.kolejnoscWGrupie, await zaznaczone(), s.otwarta, s.kolejnosc], [['Czerwony', 'Napis', 'Czerwony', 'Napis'], ['Czerwony', 'Napis'], id, ['Tło', 'group', 'Kółko']]);
  await krok(strona);
  // Usuń: znikają obie kopie, grupa zostaje zamknięta i zaznaczona, z ramką wokół tego, co zostało.
  await strona.evaluate(() => window.seriodruk.edytor.usun());
  s = await stan(strona);
  assert.deepEqual([s.kolejnoscWGrupie, s.aktywny, s.otwarta], [['Czerwony', 'Napis'], 'group', null]);
  const suma = (r1, r2) => [Math.min(r1[0], r2[0]), Math.min(r1[1], r2[1]), Math.max(r1[0] + r1[2], r2[0] + r2[2]), Math.max(r1[1] + r1[3], r2[1] + r2[3])];
  const [x1, y1, x2, y2] = suma(s.dzieci.Czerwony, s.dzieci.Napis);
  assert.ok(blisko(s.grupa.ramka[0], x1, 0.05) && blisko(s.grupa.ramka[1], y1, 0.05) && blisko(s.grupa.ramka[2], x2 - x1, 0.05) && blisko(s.grupa.ramka[3], y2 - y1, 0.05), `ramka grupy ${s.grupa.ramka} wokół elementów ${[x1, y1, x2, y2]}`);
  assert.deepEqual(await kadr(), kadrPrzed, 'przycięcie grupy zostało w tym samym miejscu arkusza');
  await krok(strona);

  // Ctrl+A w otwartej grupie zaznacza jej elementy, nie elementy strony.
  await strona.evaluate((gid) => window.seriodruk.edytor.otworzGrupe(gid, 0), id);
  await strona.evaluate(() => window.seriodruk.edytor.zaznaczWszystko());
  assert.deepEqual([await zaznaczone(), (await stan(strona)).otwarta], [['Czerwony', 'Napis'], id]);
  // Esc wraca do całej grupy.
  await strona.keyboard.press('Escape');
  s = await stan(strona);
  assert.deepEqual([s.aktywny, s.otwarta, s.grupa.interaktywna], ['group', null, false]);

  // Shift+kliknięcie elementu spoza grupy: zaznaczenie zostaje przy elemencie grupy, grupa jest dalej otwarta.
  await strona.evaluate((gid) => window.seriodruk.edytor.otworzGrupe(gid, 0), id);
  await strona.keyboard.down('Shift');
  await klik(strona, 110, 160);
  await strona.keyboard.up('Shift');
  s = await stan(strona);
  assert.deepEqual([await zaznaczone(), s.otwarta], [['Czerwony'], id]);
  // Zapis i ponowne wczytanie: grupa cała, z przycięciem.
  await strona.keyboard.press('Escape');
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  s = await stan(strona);
  assert.deepEqual([s.kolejnosc, s.kolejnoscWGrupie, s.grupa.id, s.grupa.interaktywna], [['Tło', 'group', 'Kółko'], ['Czerwony', 'Napis'], id, false]);
  assert.deepEqual(await kadr(), kadrPrzed);
  assert.deepEqual(bledy, []);
});

test('grupa w grupie: podwójne kliknięcie schodzi poziom niżej, Esc wraca poziom wyżej; warstwy pokazują zagnieżdżenie; grupowanie w otwartej grupie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Grupa w grupie');
  const wewn = await przygotuj(strona);
  // Grupa (Czerwony + Napis) i Kółko razem tworzą grupę zewnętrzną.
  const zewn = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const [g, k] = [e.canvas.getObjects().find((o) => o.type === 'group'), e.canvas.getObjects().find((o) => o.nazwa === 'Kółko')];
    g.nazwa = 'Środek';
    e.canvas.setActiveObject(new window.fabric.ActiveSelection([g, k], { canvas: e.canvas }));
    e.grupuj();
    e.aktywny.nazwa = 'Zewnętrzna';
    const { id } = e.aktywny;
    e.canvas.discardActiveObject();
    e.zatwierdz();
    return id;
  });
  const opis = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const z = (x) => Math.round(x * 100) / 100;
    const ramka = (o) => { o.setCoords(); const r = o.getBoundingRect(); return [z(r.left), z(r.top), z(r.width), z(r.height)]; };
    const drzewo = (o) => (o.type === 'group' ? { [o.nazwa || o.type]: o.getObjects().map(drzewo) } : (o.nazwa || o.type));
    const znajdz = (lista, nazwa) => { for (const o of lista) { if (o.nazwa === nazwa) return o; const d = o.getObjects ? znajdz(o.getObjects(), nazwa) : null; if (d) return d; } return null; };
    const wszystkie = e.canvas.getObjects();
    return {
      drzewo: wszystkie.map(drzewo), otwarta: e.otwartaGrupa?.nazwa || null, aktywny: e.aktywny ? (e.aktywny.nazwa || e.aktywny.type) : null,
      czerwony: ramka(znajdz(wszystkie, 'Czerwony')), srodek: ramka(znajdz(wszystkie, 'Środek')), zewn: ramka(znajdz(wszystkie, 'Zewnętrzna')),
      interaktywne: ['Zewnętrzna', 'Środek'].filter((n) => znajdz(wszystkie, n).interactive),
    };
  });
  let o = await opis();
  assert.deepEqual(o.drzewo, ['Tło', { Zewnętrzna: [{ Środek: ['Czerwony', 'Napis'] }, 'Kółko'] }]);

  // Pierwsze podwójne kliknięcie otwiera grupę zewnętrzną i zaznacza grupę w środku; drugie schodzi do jej elementu.
  await dwuklik(strona, 35, 30);
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny, o.interaktywne], ['Zewnętrzna', 'Środek', ['Zewnętrzna']]);
  assert.match(await strona.textContent('.wlasciwosci'), /To grupa w grupie/);
  await strona.waitForTimeout(400); // osobne podwójne kliknięcie
  await dwuklik(strona, 35, 30);
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny, o.interaktywne], ['Środek', 'Czerwony', ['Zewnętrzna', 'Środek']]);
  // Element z najgłębszego poziomu przesuwa się o milimetry arkusza; ramki obu grup liczą się od nowa.
  await strona.evaluate(() => window.seriodruk.edytor.przesun(-12, -8));
  await krok(strona);
  const przesuniety = await opis();
  assert.deepEqual(przesuniety.czerwony, [8, 12, 30, 20]);
  // Esc: poziom wyżej (zaznaczona grupa w środku), potem cała grupa.
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny, o.interaktywne], ['Zewnętrzna', 'Środek', ['Zewnętrzna']]);
  assert.deepEqual([o.srodek[0], o.srodek[1]], [8, 12], 'ramka grupy w środku objęła przesunięty element');
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny, o.interaktywne], [null, 'Zewnętrzna', []]);
  assert.deepEqual([o.zewn[0], o.zewn[1], o.czerwony], [8, 12, [8, 12, 30, 20]]);

  // Lista warstw: zawartość grupy z wcięciem dla grupy w grupie; kliknięcie elementu z głębi otwiera obie grupy.
  await strona.click('#zakladki-panelu label:has-text("Warstwy")');
  await strona.click('#lista-warstw .warstwa-rozwin');
  const wiersze = () => strona.evaluate(() => [...document.querySelectorAll('#lista-warstw li.warstwa')].map((li) => `${li.classList.contains('w-grupie') ? (li.style.paddingLeft ? '    ' : '  ') : ''}${li.querySelector('.warstwa-nazwa').textContent}${li.classList.contains('zaznaczona') ? ' *' : ''}${li.classList.contains('otwarta') ? ' (otwarta)' : ''}`));
  assert.deepEqual(await wiersze(), ['Zewnętrzna *', '  Kółko', '  Środek', '    Napis', '    Czerwony', 'Tło']);
  await strona.click('#lista-warstw li.w-grupie:has-text("Napis") .warstwa-nazwa');
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny], ['Środek', 'Napis']);
  assert.deepEqual(await wiersze(), ['Zewnętrzna (otwarta)', '  Kółko', '  Środek (otwarta)', '    Napis *', '    Czerwony', 'Tło']);
  // Kliknięcie elementu z poziomu wyżej zamyka tylko poziom niższy.
  await strona.click('#lista-warstw li.w-grupie:has-text("Kółko") .warstwa-nazwa');
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny, o.interaktywne], ['Zewnętrzna', 'Kółko', ['Zewnętrzna']]);
  await strona.click('#zakladki-panelu label:has-text("Właściwości")');
  await strona.evaluate(() => document.activeElement?.blur()); // skróty klawiszowe nie działają z kursorem w polu panelu

  // Zapis i wczytanie: zagnieżdżenie i położenia zostają; cofnięcie przywraca położenie sprzed przesunięcia.
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny], [null, 'Zewnętrzna']);
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  o = await opis();
  assert.deepEqual([o.drzewo, o.czerwony, o.otwarta], [['Tło', { Zewnętrzna: [{ Środek: ['Czerwony', 'Napis'] }, 'Kółko'] }], [8, 12, 30, 20], null]);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const e = window.seriodruk.edytor; const z = e.canvas.getObjects().find((x) => x.nazwa === 'Zewnętrzna'); const c = z?.getObjects()[0]?.getObjects?.()[0]; if (!c) return false; c.setCoords(); return Math.abs(c.getBoundingRect().left - 20) < 0.01; });

  // Grupowanie w otwartej grupie: dwa zaznaczone elementy stają się grupą w tej grupie; rozgrupowanie ją rozkłada.
  await strona.evaluate((gid) => { const e = window.seriodruk.edytor; e.otworzGrupe(gid, '0.0'); e.zaznaczWszystko(); e.grupuj(); e.aktywny.nazwa = 'Najgłębsza'; }, zewn);
  o = await opis();
  assert.deepEqual([o.drzewo, o.otwarta, o.aktywny], [['Tło', { Zewnętrzna: [{ Środek: [{ Najgłębsza: ['Czerwony', 'Napis'] }] }, 'Kółko'] }], 'Środek', 'Najgłębsza']);
  assert.deepEqual(o.czerwony, [20, 20, 30, 20]);
  await strona.evaluate(() => window.seriodruk.edytor.rozgrupuj());
  o = await opis();
  assert.deepEqual([o.drzewo, o.otwarta, o.czerwony], [['Tło', { Zewnętrzna: [{ Środek: ['Czerwony', 'Napis'] }, 'Kółko'] }], 'Środek', [20, 20, 30, 20]]);
  assert.ok(wewn && zewn);
  assert.deepEqual(bledy, []);
});

test('grupa otwarta: obraz kadruje się przeciąganiem, a kształt zmienia punkt po punkcie – także w grupie obróconej; element wraca na swoje miejsce w grupie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Grupa – kadr i punkty');
  const id = await strona.evaluate(async () => {
    const { edytor: e, stan: st } = window.seriodruk;
    const p = Object.assign(document.createElement('canvas'), { width: 200, height: 100 });
    const c = p.getContext('2d'); c.fillStyle = '#1d3557'; c.fillRect(0, 0, 100, 100); c.fillStyle = '#e63946'; c.fillRect(100, 0, 100, 100);
    const obraz = await e.dodajObraz(p.toDataURL('image/png'), 'dwa-kolory.png', st.projekt.zasoby);
    obraz.set({ left: 20, top: 30, scaleX: 0.3, scaleY: 0.3, nazwa: 'Obraz' }); obraz.setCoords(); // 60 × 30 mm
    const k = new window.fabric.Path('M 20 90 L 60 90 L 60 120 L 20 120 Z', { fill: '#a8dadc', stroke: '#457b9d', strokeWidth: 0.5, strokeUniform: true, nazwa: 'Kształt' });
    e._wstaw(k);
    const r = e.dodajProstokat(); r.set({ left: 90, top: 60, width: 20, height: 20, nazwa: 'Kwadrat' }); r.setCoords();
    e.canvas.setActiveObject(new window.fabric.ActiveSelection([obraz, k, r], { canvas: e.canvas }));
    e.grupuj();
    const g = e.aktywny;
    e.canvas.discardActiveObject();
    e.zatwierdz();
    return g.id;
  });
  const opis = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const z = (x) => Math.round(x * 100) / 100;
    const wszystkie = e.canvas.getObjects().filter((o) => !o.zWzorca);
    const g = wszystkie.find((o) => o.type === 'group');
    const rogi = (o) => { o.setCoords(); return o.getCoords().map((p) => [z(p.x), z(p.y)]); };
    const szukaj = (typ) => g.getObjects().find((o) => o.type === typ) || wszystkie.find((o) => o.type === typ);
    const [obraz, ksztalt] = [szukaj('image'), szukaj('path')];
    return {
      naArkuszu: wszystkie.map((o) => o.nazwa || o.type), wGrupie: g.getObjects().map((o) => o.nazwa || o.type),
      otwarta: e.otwartaGrupa?.id || null, aktywny: e.aktywny ? (e.aktywny.nazwa || e.aktywny.type) : null, kadruje: e.kadruje, punkty: e.edytujePunkty,
      obraz: { rogi: rogi(obraz), kadr: [z(obraz.cropX), z(obraz.cropY), z(obraz.width), z(obraz.height)] },
      ksztalt: rogi(ksztalt), grupa: (() => { g.setCoords(); const r = g.getBoundingRect(); return [z(r.left), z(r.top), z(r.width), z(r.height)]; })(),
    };
  });
  await strona.waitForTimeout(450);
  let o = await opis();
  assert.deepEqual([o.naArkuszu, o.wGrupie], [['group'], ['Obraz', 'Kształt', 'Kwadrat']]);
  const obrazPrzed = o.obraz;

  // Obraz w otwartej grupie: podwójne kliknięcie zaczyna kadrowanie; na ten czas obraz leży nad grupą.
  await dwuklik(strona, 50, 45);
  await strona.waitForTimeout(400);
  await dwuklik(strona, 50, 45);
  o = await opis();
  assert.deepEqual([o.kadruje, o.otwarta, o.naArkuszu, o.wGrupie], [true, id, ['group', 'Obraz', 'rect'], ['Kształt', 'Kwadrat']]);
  // Esc anuluje: obraz wraca do grupy na to samo miejsce w kolejności, bez zmiany.
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual([o.kadruje, o.otwarta, o.aktywny, o.naArkuszu, o.wGrupie, o.obraz], [false, id, 'Obraz', ['group'], ['Obraz', 'Kształt', 'Kwadrat'], obrazPrzed]);
  // Kadrowanie do prawej połowy: lewa krawędź ramki przeciągnięta na środek obrazu, Enter zatwierdza.
  await strona.click('.wlasciwosci button:has-text("Kadruj przeciąganiem")');
  await przeciagnij(strona, [20, 45], [50, 45]);
  await strona.keyboard.press('Enter');
  o = await opis();
  assert.deepEqual([o.kadruje, o.otwarta, o.aktywny, o.naArkuszu, o.wGrupie], [false, id, 'Obraz', ['group'], ['Obraz', 'Kształt', 'Kwadrat']]);
  assert.ok(blisko(o.obraz.kadr[0], 100, 3) && blisko(o.obraz.kadr[2], 100, 3), `przycięcie do prawej połowy: ${o.obraz.kadr}`);
  assert.ok(blisko(o.obraz.rogi[0][0], 50) && blisko(o.obraz.rogi[1][0], 80, 0.05) && blisko(o.obraz.rogi[0][1], 30, 0.05), `widoczna część została w miejscu: ${JSON.stringify(o.obraz.rogi)}`);
  await krok(strona);

  // Kształt w otwartej grupie: podwójne kliknięcie zaczyna edycję punktów; punkt przeciągnięty, Enter zatwierdza.
  await klik(strona, 40, 105);
  await strona.waitForTimeout(400);
  await dwuklik(strona, 40, 105);
  o = await opis();
  assert.deepEqual([o.punkty, o.otwarta, o.naArkuszu, o.wGrupie], [true, id, ['group', 'Kształt'], ['Obraz', 'Kwadrat']]);
  await przeciagnij(strona, [60, 120], [75, 135]);
  await strona.keyboard.press('Enter');
  o = await opis();
  assert.deepEqual([o.punkty, o.otwarta, o.aktywny, o.naArkuszu, o.wGrupie], [false, id, 'Kształt', ['group'], ['Obraz', 'Kształt', 'Kwadrat']]);
  const prawyDol = [Math.max(...o.ksztalt.map((p) => p[0])), Math.max(...o.ksztalt.map((p) => p[1]))];
  assert.ok(blisko(prawyDol[0], 75, 1) && blisko(prawyDol[1], 135, 1), `kształt sięga przeciągniętego punktu: ${prawyDol}`);
  // Esc zamyka grupę: ramka obejmuje przycięty obraz i powiększony kształt.
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual([o.otwarta, o.aktywny], [null, 'group']);
  assert.ok(blisko(o.grupa[0], 20, 1) && blisko(o.grupa[1], 30, 0.3) && blisko(o.grupa[0] + o.grupa[2], 110, 1) && blisko(o.grupa[1] + o.grupa[3], 135, 1.5), `ramka grupy: ${o.grupa}`);
  await krok(strona);
  // Cofnięcie edycji punktów i kadrowania – po jednym kroku.
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const g = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'group'); const k = g?.getObjects().find((x) => x.type === 'path'); if (!k) return false; k.setCoords(); return Math.abs(k.getBoundingRect().height - 30.5) < 1; });
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const g = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'group'); const i = g?.getObjects().find((x) => x.type === 'image'); return i && Math.abs(i.width - 200) < 0.5; });

  // Grupa obrócona: kadrowanie i edycja punktów nie przestawiają elementów; anulowanie zostawia wszystko jak było.
  await strona.evaluate((gid) => { const e = window.seriodruk.edytor; const g = e.canvas.getObjects().find((x) => x.id === gid); g.rotate(25); g.setCoords(); e.canvas.discardActiveObject(); e.zatwierdz(); }, id);
  await strona.waitForTimeout(450);
  const obrocona = await opis();
  await strona.evaluate((gid) => { const e = window.seriodruk.edytor; const img = e.otworzGrupe(gid, 0); e.kadruj(img); }, id);
  assert.equal((await opis()).kadruje, true);
  await strona.evaluate(() => window.seriodruk.edytor.zakonczKadrowanie(false));
  o = await opis();
  const rowne = (a, b, tol = 0.02) => a.flat(3).every((v, i) => Math.abs(v - b.flat(3)[i]) <= tol);
  // (Ramka grupy wczytanej z zapisu ma wymiary zaokrąglone do setnych – stąd luz przy jej porównaniu.)
  assert.ok(rowne(o.obraz.rogi, obrocona.obraz.rogi) && rowne([o.grupa], [obrocona.grupa], 0.1), `po anulowaniu kadrowania w obróconej grupie: ${JSON.stringify([o.obraz.rogi, o.grupa])} wobec ${JSON.stringify([obrocona.obraz.rogi, obrocona.grupa])}`);
  assert.deepEqual([o.wGrupie, o.otwarta, o.aktywny], [['Obraz', 'Kształt', 'Kwadrat'], id, 'Obraz']);
  // Przycięcie w obróconej grupie: prawy dolny róg obrazu zostaje w miejscu.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.kadruj(e.aktywny); const r = e.aktywny; r.set({ left: r.left + r.width / 2, width: r.width / 2 }); r.setCoords(); e.zakonczKadrowanie(true); });
  o = await opis();
  assert.ok(rowne([o.obraz.rogi[2]], [obrocona.obraz.rogi[2]], 0.05), `prawy dolny róg po przycięciu: ${o.obraz.rogi[2]} wobec ${obrocona.obraz.rogi[2]}`);
  assert.ok(blisko(o.obraz.kadr[0], 100, 0.5) && blisko(o.obraz.kadr[2], 100, 0.5), `kadr: ${o.obraz.kadr}`);
  await strona.evaluate((gid) => { const e = window.seriodruk.edytor; const k = e.otworzGrupe(gid, 1); e.edytujPunkty(k); e.zakonczPunkty(false); }, id);
  o = await opis();
  assert.ok(rowne(o.ksztalt, obrocona.ksztalt, 0.05), `kształt po anulowanej edycji punktów w obróconej grupie: ${JSON.stringify(o.ksztalt)} wobec ${JSON.stringify(obrocona.ksztalt)}`);
  assert.deepEqual([o.wGrupie, o.naArkuszu, o.otwarta], [['Obraz', 'Kształt', 'Kwadrat'], ['group'], id]);
  assert.deepEqual(bledy, []);
});
