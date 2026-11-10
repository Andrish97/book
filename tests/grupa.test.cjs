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
  assert.equal(await strona.locator('.wlasciwosci :text("Wyrównaj do marginesów")').count(), 0, 'do marginesów wyrównuje się cała grupa');
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
