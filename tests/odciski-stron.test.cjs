// #438: odcisk strony wydruku z tego, co na niej widać – zmiana jednej strony unieważnia tylko strony, które naprawdę
// wyglądają inaczej (seria: przesunięte powielenie bez numeru strony ma ten sam odcisk; dodanie strony nie rusza innych;
// pole zależne od innych stron unieważnia tylko strony, na których jego wartość się zmieniła).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('odciski stron: seria z przesunięciem, dodana strona, pola zależne od innych stron', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Odciski');
  const w = await strona.evaluate(async () => {
    const { rozwin } = await import('./js/serie.js');
    const { odciskStrony } = await import('./js/publikacja-linku.js');
    const { nowaStrona } = await import('./js/projekt.js');
    const p = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt));
    const sek = p.strony[0].sekcja;
    p.tabele.push({ id: 'dni', nazwa: 'Dni', kolumny: ['dzien'], wiersze: Array.from({ length: 8 }, (_, i) => [`Dzień ${i + 1}`]) });
    p.serie.push({ id: 's1', nazwa: 'Dni', tabela: 'dni', tryb: 'tabela', uklad: 'dlugi' });
    p.strony[0].seria = 's1';
    p.strony[0].obiekty = [{ type: 'textbox', id: 't', left: 10, top: 10, width: 80, text: '{dzien}', fontFamily: 'Inter', fontSize: 5 }];
    const koniec = nowaStrona('Koniec', sek);
    koniec.obiekty = [{ type: 'textbox', id: 'k', left: 10, top: 10, width: 80, text: 'Stron: {liczba_stron}', fontFamily: 'Inter', fontSize: 5 }];
    const stala = nowaStrona('Stała', sek);
    stala.obiekty = [{ type: 'textbox', id: 's', left: 10, top: 10, width: 80, text: 'Bez pól', fontFamily: 'Inter', fontSize: 5 }];
    p.strony.push(koniec, stala);
    const odciski = (pr) => { const c = rozwin(pr); return c.egzemplarze.map((e) => ({ klucz: e.klucz, strona: e.strona.id, odcisk: odciskStrony(pr, e, c) })); };
    const przed = odciski(p);
    // 1) Wiersz wstawiony w środek serii: dni przesuwają się o jedną stronę.
    const p2 = JSON.parse(JSON.stringify(p));
    p2.tabele[p2.tabele.length - 1].wiersze.splice(3, 0, ['Dzień nowy']);
    const po = odciski(p2);
    const stareSerii = new Set(przed.filter((x) => x.strona === p.strony[0].id).map((x) => x.odcisk));
    const nowe = po.filter((x) => x.strona === p.strony[0].id && !stareSerii.has(x.odcisk));
    // 2) Strona bez pól po dodaniu innej strony – ten sam odcisk; strona z {liczba_stron} – nowy.
    const p3 = JSON.parse(JSON.stringify(p));
    p3.strony.push(nowaStrona('Dodana', sek));
    const po3 = odciski(p3);
    const od = (lista, id) => lista.find((x) => x.strona === id).odcisk;
    // 3) Numer strony wydrukowany: przesunięcie zmienia dalsze strony serii.
    const p4 = JSON.parse(JSON.stringify(p));
    p4.strony[0].obiekty[0].text = '{dzien} – s. {nr}';
    const p5 = JSON.parse(JSON.stringify(p4));
    p5.tabele[p5.tabele.length - 1].wiersze.splice(3, 0, ['Dzień nowy']);
    const stare4 = new Set(odciski(p4).filter((x) => x.strona === p.strony[0].id).map((x) => x.odcisk));
    const nowe5 = odciski(p5).filter((x) => x.strona === p.strony[0].id && !stare4.has(x.odcisk));
    return {
      nowychPoWstawieniu: nowe.length,
      stalaBezZmian: od(przed, stala.id) === od(po3, stala.id),
      koniecNowy: od(przed, koniec.id) !== od(po3, koniec.id),
      stalaPoWstawieniu: od(przed, stala.id) === od(po, stala.id),
      koniecPoWstawieniu: od(przed, koniec.id) !== od(po, koniec.id),
      nowychZNumerami: nowe5.length,
    };
  });
  assert.equal(w.nowychPoWstawieniu, 1, 'po wstawieniu wiersza tylko jedna strona serii jest nowa (reszta tylko się przesunęła)');
  assert.equal(w.stalaBezZmian, true, 'dodanie strony nie unieważnia strony bez pól');
  assert.equal(w.koniecNowy, true, 'strona z {liczba_stron} – nowy odcisk po dodaniu strony');
  assert.equal(w.stalaPoWstawieniu, true);
  assert.equal(w.koniecPoWstawieniu, true, 'więcej stron serii – {liczba_stron} się zmienia');
  assert.equal(w.nowychZNumerami, 6, 'z wydrukowanym numerem strony przesunięte strony są naprawdę nowe (od wstawionego dnia do końca)');
  assert.deepEqual(bledy, []);
});
