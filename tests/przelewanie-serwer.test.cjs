// #436: przelewanie wątku bez edytora (js/przelewanie.js – droga serwera i MCP) daje podział identyczny znak w znak
// z edytorem (rozlej na płótnie po wczytaniu strony). Przypadki: różne czcionki, NBSP, nagłówek hasła przy końcu ramki,
// wdowy 3, łamanie całego akapitu, polskie zasady, za długi tekst (raport przepełnienia), podzielone akapity.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const OPIS = 'Dobra nowina o zbawieniu przez Jezusa Chrystusa; także nazwa czterech ksiąg o Jego życiu i nauczaniu.';

// W przeglądarce: wątek z `ile` ramek na kolejnych stronach, cały tekst w pierwszej. Zwraca podział z modułu
// (na kopii projektu) i z edytora (strona 1 wczytana, przelana i zapisana) oraz raport modułu.
async function porownaj(strona, przypadek) {
  return strona.evaluate(async (p) => {
    window.__dbg = Boolean(p.dbg);
    const { stan, edytor: e } = window.seriodruk;
    const { nowaStrona } = await import('./js/projekt.js');
    const { przelejWatek, opisRaportu } = await import('./js/przelewanie.js');
    const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
    const { zapiszBiezacyCel, odlaczPlotno, zaladujCel } = await import('./js/app/zapis.js');
    const projekt = stan.projekt;
    // Ramka wzorcowa z edytora (prawdziwy zapis JSON), potem kopie na kolejnych stronach.
    await przejdzDoStrony(0);
    const o = e.dodajTekst(p.tekst);
    o.set({ id: 'r0', left: 15, top: 20, width: p.szer || 60, fontSize: p.rozmiar || 3, fontFamily: p.czcionka || 'Inter', ramka_h: p.wys || 60, zasady_pl: p.zasady ?? true, wdowy: p.wdowy ?? 3, lamanie_akapitu: p.lamanie ?? true, watek: 'w1', watek_nr: 0 });
    for (const [od, dl, styl] of p.style || []) o.setSelectionStyles(styl, od, od + dl);
    o.initDimensions();
    e.zatwierdz?.();
    zapiszBiezacyCel();
    odlaczPlotno(); // zmiany w zapisie poniżej – płótno ich nie nadpisze
    // Pojedyncza ramka nie jest wątkiem (edytor zdejmuje z niej `watek`) – wątek powstaje w zapisie, jak przy ramkach z AI.
    Object.assign(projekt.strony[0].obiekty.find((x) => x.id === 'r0'), { watek: 'w1', watek_nr: 0 });
    const wzor = JSON.parse(JSON.stringify(projekt.strony[0].obiekty.find((x) => x.id === 'r0')));
    for (let i = 1; i < (p.ile || 3); i += 1) {
      let s = projekt.strony[i];
      if (!s) { s = nowaStrona(`Strona ${i + 1}`, projekt.strony[0].sekcja); projekt.strony.push(s); }
      s.obiekty = [{ ...JSON.parse(JSON.stringify(wzor)), id: `r${i}`, text: '', styles: [], watek_nr: i, lacznik: '\n' }];
    }
    if (p.rozkladowki) projekt.sekcje.find((x) => x.id === projekt.strony[0].sekcja || x === projekt.sekcje[0]).uklad = 'rozkladowki';
    // Element oblewany tekstem na drugiej stronie wątku (ramka tej strony go opływa).
    if (p.przeszkoda) projekt.strony[1].obiekty.push({ ...new fabric.Rect({ id: 'ob1', left: 30, top: 35, width: 25, height: 20, fill: '#cccccc' }).toObject(['id']), oblewanie: 'obok', oblewanie_odstep: 2 });
    // Pierwsza ramka z całym tekstem – tak jak zapisał go edytor przed przelaniem.
    const zapis = projekt.strony[0].obiekty.find((x) => x.id === 'r0');
    const przed = JSON.parse(JSON.stringify(projekt));
    // 1) Moduł na kopii projektu.
    const kopia = JSON.parse(JSON.stringify(przed));
    const { raport } = await przelejWatek(kopia, 'w1');
    const czesci = (pr) => pr.strony.flatMap((s) => s.obiekty.filter((x) => x.watek === 'w1')).sort((a, b) => a.watek_nr - b.watek_nr)
      .map((x) => ({ text: x.text, lacznik: x.lacznik ?? null, styles: JSON.stringify(x.styles || []), ...(window.__dbg ? { id: x.id, nr: x.watek_nr, h: x.ramka_h, strona: pr.strony.findIndex((s) => s.obiekty.includes(x)) } : {}) }));
    const modul = czesci(kopia);
    // 2) Edytor: wczytanie strony 1 (ramki z innych stron w pamięci), przelanie i zapis.
    void zapis;
    stan.indeks = 0;
    await zaladujCel(); // strona 1 wczytana od nowa z zapisu (płótno było odłączone)
    e.przelejWatki();
    zapiszBiezacyCel();
    const edytor = czesci(stan.projekt);
    // Po wczytaniu innej strony edytor nie zmienia już niczego.
    await przejdzDoStrony(1);
    e.przelejWatki();
    zapiszBiezacyCel();
    const poDrugiej = czesci(stan.projekt);
    return { modul, edytor, poDrugiej, raport, opis: opisRaportu('w1', raport) };
  }, przypadek);
}

const tekstHasel = (n) => Array.from({ length: n }, (_, i) => `Hasło${i} Dz 1:${i}\n${OPIS}`).join('\n');
const styleHasel = (tekst) => [...tekst.matchAll(/^(\S+) (\S+ \S+)$/gm)].flatMap((m) => [
  [m.index, m[1].length, { fontWeight: 600, fontSize: 3.4 }],
  [m.index + m[1].length + 1, m[2].length, { fontWeight: 300, fontSize: 2.4, fill: '#888888' }],
]);

for (const [nazwa, przypadek] of [
  ['słowniczek: nagłówki haseł, wdowy 3, łamanie akapitu (Inter)', (() => { const t = tekstHasel(14); return { tekst: t, style: styleHasel(t), wys: 52 }; })()],
  ['inna czcionka (Lora), NBSP i dłuższe akapity', { tekst: `Rozdział pierwszy\n${'Tekst z twardymi spacjami płynie przez kolejne ramki i strony książki, a wiersze łamią się według polskich zasad. '.repeat(9)}`, czcionka: 'Lora', rozmiar: 3.3, wys: 45, style: [[0, 18, { fontWeight: 'bold', fontSize: 4.5 }]] }],
  ['rozkładówki (wyrównanie łamów) i element oblewany na innej stronie', (() => { const t = tekstHasel(16); return { tekst: t, style: styleHasel(t), wys: 50, ile: 4, rozkladowki: true, przeszkoda: true }; })()],
  ['bez polskich zasad i bez łamania akapitu', { tekst: tekstHasel(10), zasady: false, lamanie: false, wdowy: 0, wys: 48 }],
]) {
  test(`przelewanie bez edytora = edytor: ${nazwa}`, async (t) => {
    const { strona, bledy } = await otworz(t);
    await nowyProjekt(strona, 'Przelewanie');
    const w = await porownaj(strona, przypadek);
    assert.deepEqual(w.modul, w.edytor, 'podział znak w znak jak w edytorze');
    assert.deepEqual(w.poDrugiej, w.edytor, 'edytor po wczytaniu innej strony niczego nie zmienia');
    assert.ok(w.modul.filter((c) => c.text).length > 1, `tekst płynie przez kilka ramek:\n${w.opis}`);
    assert.deepEqual(bledy, []);
  });
}

test('raport: za długi tekst (przepełnienie), podzielone akapity, pierwsze i ostatnie słowa', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Raport');
  const t1 = tekstHasel(40);
  const w = await porownaj(strona, { tekst: t1, style: styleHasel(t1), wys: 40, ile: 2 });
  assert.deepEqual(w.modul, w.edytor);
  assert.ok(w.raport.przepelnienie && w.raport.przepelnienie.wierszy > 0, w.opis);
  assert.match(w.opis, /NIE MIEŚCI SIĘ: \d+ wierszy poza ostatnią ramką – od „/);
  assert.equal(w.raport.ramki.length, 2);
  assert.match(w.raport.ramki[0].poczatek, /^Hasło0 Dz 1:0 Dobra/);
  // Mieszczący się tekst z akapitem przeciętym granicą ramek (bez zasad i wdów – podział dozwolony, ale zgłoszony).
  assert.deepEqual(bledy, []);
});

test('raport: akapit przecięty granicą ramek, cały tekst się mieści', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Raport 2');
  const w2 = await porownaj(strona, { tekst: `${'Długi akapit bez podziału na hasła, który na pewno nie zmieści się w jednej ramce. '.repeat(7)}`, wys: 30, ile: 3, wdowy: 0 });
  assert.equal(w2.raport.przepelnienie, null, w2.opis);
  assert.ok(w2.raport.podzielone.length >= 1, w2.opis);
  assert.match(w2.opis, /Cały tekst się mieści\./);
  assert.deepEqual(bledy, []);
});
