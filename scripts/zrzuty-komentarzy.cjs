// Zrzuty instrukcji do komentarzy (#131D): k-komentarz-narzedzie.png (narzędzie „Komentarz” na pasku narzędzi,
// przycisk z licznikiem na górnym pasku i pinezki na stronie) i komentarze.png (panel z wątkiem, odpowiedzią
// i wzmianką). Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyKomentarzy na końcu; tu można
// je zrobić osobno, gdy pełny komplet nie mieści się w pamięci maszyny.
//
// Użycie:  node scripts/zrzuty-komentarzy.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

const ANNA = { id: '11111111-1111-4111-8111-111111111111', email: 'anna@przyklad.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' };
const BARTEK = { id: '22222222-2222-4222-8222-222222222222', email: 'bartek@przyklad.pl', haslo: 'Dobre#Haslo2', potwierdzone: true, nazwa: 'Bartek' };

async function zrobZrzutyKomentarzy(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d, baza } = await otworz({ after: (f) => sprzatanie.push(f) }, { konta: [ANNA, BARTEK] });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(d, 'Kalendarz rodzinny');
    await d.evaluate(async () => {
      const { stan, przeladuj } = window.seriodruk;
      stan.projekt.strony[0].obiekty = [
        { type: 'rect', version: '5.3.0', left: -3, top: -3, width: 154, height: 120, fill: '#2f6f5e', id: 'foto' },
        { type: 'textbox', version: '5.3.0', left: 15, top: 130, width: 118, text: 'Styczeń 2027', fontSize: 12, fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#1a1a1a', id: 'tyt' },
        { type: 'textbox', version: '5.3.0', left: 15, top: 150, width: 118, text: 'Zimowy spacer nad jeziorem', fontSize: 5, fontFamily: 'Inter', fill: '#444444', id: 'opis' },
      ];
      stan.projekt.strony[0].tlo = null;
      await przeladuj();
    });
    await d.waitForFunction(() => document.querySelector('#stan-zapisu')?.textContent === 'Zapisano', null, { timeout: 15000 });
    for (let i = 0; i < 100 && !baza.projekty.length; i += 1) await d.waitForTimeout(100);
    const id = baza.projekty[0].id;
    const strona = await d.evaluate(() => window.seriodruk.stan.projekt.strony[0].id);
    baza.wspolpracownicy.push({ projekt_id: id, uzytkownik: BARTEK.id, rola: 'edycja', dodano: new Date().toISOString() });
    const anna = baza.konta.find((k) => k.id === ANNA.id);
    const bartek = baza.konta.find((k) => k.id === BARTEK.id);
    const w1 = baza.wspolpraca('dodaj_komentarz', { p_projekt: id, p_strona: strona, p_element: 'tyt', p_tresc: '@Anna czy tytuł nie powinien być większy?' }, bartek);
    baza.wspolpraca('dodaj_komentarz', { p_projekt: id, p_watek: w1.id, p_tresc: 'Dobry pomysł – powiększę do 16 pt.' }, anna);
    const w2 = baza.wspolpraca('dodaj_komentarz', { p_projekt: id, p_strona: strona, p_x: 120, p_y: 30, p_tresc: 'Tu wolałabym zdjęcie z sankami.' }, bartek);

    // Panel komentarzy (otwierany przyciskiem z licznikiem na górnym pasku) z rozwiniętym wątkiem.
    await d.click('.przycisk-komentarzy[data-akcja="komentarze"]');
    await d.waitForSelector('#dlg-komentarze[open] .watek-komentarza');
    await d.click(`.watek-komentarza[data-id="${w1.id}"] [data-op="otworz"]`);
    await d.waitForSelector('.pinezki-komentarzy .pinezka-komentarza.wybrana');
    await d.waitForTimeout(400);
    await kadr(d, 'komentarze.png', { obszar: '#dlg-komentarze', margines: 0 });
    await d.click('#komentarze-zamknij');
    await d.evaluate(() => window.seriodruk.edytor.odznacz());
    await d.mouse.move(640, 790);
    await d.waitForTimeout(400);
    // Narzędzie „Komentarz” na pasku narzędzi, licznik na górnym pasku, pinezki na stronie.
    await d.waitForSelector('.pinezki-komentarzy .pinezka-komentarza[data-watek]');
    await kadr(d, 'k-komentarz-narzedzie.png', {
      obszar: ['#pasek-narzedzi', '.przycisk-komentarzy', `.pinezki-komentarzy .pinezka-komentarza[data-watek="${w2.id}"]`],
      zaznacz: ['[data-akcja="komentarz"]', '.przycisk-komentarzy'],
    });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyKomentarzy };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyKomentarzy(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
