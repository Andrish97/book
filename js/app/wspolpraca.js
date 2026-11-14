// Współpraca między kontami (decyzja #86): okno „Współpraca” (zapraszanie, osoby z dostępem, role, opuszczenie
// projektu), skrzynka „Zaproszenia” na liście projektów, przyjmowanie zaproszenia z linku #/zaproszenie/<kod>
// i powiadomienia na żywo o nowych zaproszeniach. Lekka część aplikacji – działa bez edytora.
//
// Celowo prościej niż w Familiadzie: bez znajomych, społeczności i subskrybentów. Jest projekt, właściciel
// i osoby, które on zaprosił – z rolą „może edytować” albo „może oglądać”.

import * as wsp from '../wspolpraca-chmura.js';
import { komunikatBledu } from '../chmura.js';
import { $, powiadom, potwierdz, kiedy } from '../ui.js';
import { ikona } from '../ikony.js';
import { zPostepem } from '../postep.js';
import { stan, trasa } from './kontekst.js';

const KROTKO = { edycja: 'edytuje', odczyt: 'ogląda', wlasciciel: 'właściciel' };
export const opisRoli = (rola) => wsp.ROLE[rola] || rola;
export const krotkoRola = (rola) => KROTKO[rola] || rola;
const dlaMnie = (rola) => (rola === 'edycja' ? 'możesz edytować' : 'możesz oglądać');
const inicjal = (tekst) => (String(tekst || '?').trim()[0] || '?').toUpperCase();

// Zależności z ekranu projektów i tras – podawane z zewnątrz, żeby ten moduł nie wciągał ich przy starcie.
let zalezne = {
  pokazProjekty: async () => {},
  otworzProjektPoId: async () => {},
  zapewnijNaKoncie: async () => {},
  usunKopieLokalna: async () => {},
};
export function ustawZaleznosci(z) { zalezne = { ...zalezne, ...z }; }

// ======================================================================
// Okno „Współpraca”
// ======================================================================

let otwarty = null; // { id, nazwa, wlasciciel (czy ja), rola }

// projekt: { id, nazwa, wspolpraca_chmury? } – otwarty projekt albo wpis z listy.
export async function otworzWspolprace(projekt) {
  if (!projekt) return;
  if (!stan.uzytkownik) { powiadom('Współpraca wymaga zalogowania.', true); return; }
  const udzial = projekt.wspolpraca_chmury || projekt.wspolpraca || null;
  otwarty = { id: projekt.id, nazwa: projekt.nazwa, wlasciciel: !udzial, rola: udzial?.rola || 'wlasciciel' };
  const dlg = $('#dlg-wspolpraca');
  $('#wspolpraca-projekt').textContent = `„${projekt.nazwa || 'Bez nazwy'}”`;
  $('#form-zaproszenia').hidden = !otwarty.wlasciciel;
  $('#wspolpraca-gotowe').hidden = true;
  $('#wspolpraca-stopka').hidden = otwarty.wlasciciel;
  $('#wspolpraca-opis').textContent = otwarty.wlasciciel
    ? 'Zaproś osoby do tego projektu. „Może edytować” – zmienia projekt razem z Tobą, na żywo; „Cofnij” każdy ma swoje. „Może oglądać” – tylko podgląd. Dostęp możesz w każdej chwili zmienić albo odebrać.'
    : `${udzial.nazwa || 'Właściciel'} udostępnia Ci ten projekt – ${udzial.rola === 'edycja' ? 'możesz go edytować razem z innymi, na żywo' : 'możesz go oglądać'}. Zapraszać i zmieniać dostęp może właściciel.`;
  $('#wspolpraca-email').value = '';
  $('#wspolpraca-rola').value = 'edycja';
  $('#wspolpraca-osoby').replaceChildren(Object.assign(document.createElement('li'), { className: 'szkielet-wiersza', textContent: 'Wczytuję…' }));
  if (!dlg.open) dlg.showModal();
  if (otwarty.wlasciciel) {
    try { await zalezne.zapewnijNaKoncie(projekt); } catch (e) { powiadom(komunikatBledu(e), true); }
  }
  await odswiezOsoby();
}

export function zamknijWspolprace() {
  $('#dlg-wspolpraca').close();
}

async function odswiezOsoby() {
  if (!otwarty) return;
  const ul = $('#wspolpraca-osoby');
  let osoby = [];
  try {
    osoby = await zPostepem('Wczytywanie osób z dostępem…', () => wsp.osobyProjektu(otwarty.id));
  } catch (e) {
    ul.replaceChildren(Object.assign(document.createElement('li'), { className: 'podpowiedz', textContent: komunikatBledu(e) }));
    return;
  }
  ul.replaceChildren(...osoby.map((o) => wierszOsoby(o)));
}

function wierszOsoby(o) {
  const li = document.createElement('li');
  li.className = `osoba osoba-${o.typ}`;
  const znak = document.createElement('span');
  znak.className = 'awatar-maly';
  znak.textContent = o.typ === 'zaproszenie' ? '@' : inicjal(o.nazwa || o.email);
  if (o.typ !== 'zaproszenie') znak.style.background = wsp.kolorOsoby(o.id);
  const opis = document.createElement('div');
  const tytul = document.createElement('strong');
  tytul.textContent = o.typ === 'zaproszenie' ? o.email : `${o.nazwa || o.email}${o.ja ? ' (Ty)' : ''}`;
  const szczegoly = document.createElement('span');
  szczegoly.className = 'ciche';
  if (o.typ === 'zaproszenie') szczegoly.textContent = `zaproszenie wysłane ${kiedy(o.od)} · ${opisRoli(o.rola)} · ważne do ${new Date(o.wazne_do).toLocaleDateString('pl-PL')}`;
  else if (o.typ === 'wlasciciel') szczegoly.textContent = `${o.email} · właściciel`;
  else szczegoly.textContent = `${o.email} · ${opisRoli(o.rola)}`;
  opis.append(tytul, szczegoly);
  const akcje = document.createElement('div');
  akcje.className = 'osoba-akcje';
  if (otwarty.wlasciciel && o.typ === 'wspolpracownik') {
    const rola = document.createElement('select');
    rola.setAttribute('aria-label', `Rola: ${o.nazwa || o.email}`);
    rola.innerHTML = '<option value="edycja">może edytować</option><option value="odczyt">może oglądać</option>';
    rola.value = o.rola;
    rola.addEventListener('change', async () => {
      try { await wsp.zmienRole(otwarty.id, o.id, rola.value); powiadom(`${o.nazwa || o.email}: ${opisRoli(rola.value)}.`); } catch (e) { powiadom(komunikatBledu(e), true); }
      odswiezOsoby();
    });
    const odbierz = przycisk('Odbierz', 'niebezpieczny', async () => {
      if (!await potwierdz('Odebrać dostęp?', `${o.nazwa || o.email} straci dostęp do projektu „${otwarty.nazwa}” od razu. Zmiany, które już zapisał(a), zostają.`, 'Odbierz', true)) return;
      try { await wsp.usunZProjektu(otwarty.id, o.id); powiadom('Dostęp odebrany.'); } catch (e) { powiadom(komunikatBledu(e), true); }
      odswiezOsoby();
    });
    akcje.append(rola, odbierz);
  }
  if (otwarty.wlasciciel && o.typ === 'zaproszenie') {
    if (o.kod) akcje.append(przycisk('Kopiuj link', '', () => kopiuj(wsp.linkZaproszenia(o.kod), 'Link do zaproszenia skopiowany.')));
    akcje.append(przycisk('Wyślij ponownie', '', async () => {
      const m = await wsp.wyslijZaproszenieMailem(o.id);
      if (m.wyslano) powiadom(`Wysłano e-mail z zaproszeniem na adres ${o.email}.`);
      else powiadom(m.powod === 'brak-konfiguracji' ? 'Aplikacja nie wysyła jeszcze e-maili – skopiuj link i wyślij go sam.' : (m.blad || 'E-mail nie wyszedł.'), true);
    }));
    akcje.append(przycisk('Cofnij', 'niebezpieczny', async () => {
      try { await wsp.cofnijZaproszenie(o.id); powiadom('Zaproszenie cofnięte – link przestał działać.'); } catch (e) { powiadom(komunikatBledu(e), true); }
      odswiezOsoby();
    }));
  }
  li.append(znak, opis, akcje);
  return li;
}

function przycisk(tekst, klasa, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `przycisk ${klasa}`.trim();
  b.textContent = tekst;
  b.addEventListener('click', fn);
  return b;
}

async function kopiuj(tekst, komunikat) {
  try {
    await navigator.clipboard.writeText(tekst);
    powiadom(komunikat);
  } catch {
    const pole = $('#wspolpraca-link');
    pole.value = tekst;
    $('#wspolpraca-gotowe').hidden = false;
    pole.select();
    powiadom('Zaznaczyłem link – skopiuj go skrótem Ctrl+C.');
  }
}

function trescMaila(nazwaProjektu, rola, link) {
  const kto = stan.uzytkownik?.user_metadata?.nazwa || stan.uzytkownik?.email || '';
  return {
    temat: `Zaproszenie do projektu „${nazwaProjektu}” w Seriodruku`,
    tresc: `Cześć!\n\n${kto ? `${kto} zaprasza` : 'Zapraszam'} Cię do wspólnej pracy nad projektem „${nazwaProjektu}” w Seriodruku (${opisRoli(rola)}).\n\nOtwórz link, zaloguj się albo załóż konto – projekt pojawi się na Twojej liście:\n${link}\n\nLink jest ważny 14 dni i działa jeden raz.`,
  };
}

async function zapros(e) {
  e.preventDefault();
  if (!otwarty?.wlasciciel) return;
  const pole = $('#wspolpraca-email');
  const email = pole.value.trim();
  if (!email || !pole.checkValidity()) { powiadom('Wpisz adres e-mail osoby, którą zapraszasz.', true); pole.focus(); return; }
  const b = $('#wspolpraca-zapros');
  b.disabled = true;
  try {
    const rola = $('#wspolpraca-rola').value;
    const z = await wsp.zaprosDoProjektu(otwarty.id, email, rola);
    const link = wsp.linkZaproszenia(z.kod);
    $('#wspolpraca-link').value = link;
    $('#wspolpraca-gotowe-opis').textContent = 'Wysyłam e-mail z zaproszeniem…';
    const gdzie = z.konto
      ? 'Zaproszenie czeka też u tej osoby w aplikacji (Projekty → Zaproszenia).'
      : 'Po założeniu konta projekt pojawi się na liście tej osoby.';
    // E-mail idzie z poczty aplikacji (Brevo); gdy poczta nie jest skonfigurowana – link do wysłania samemu.
    wsp.wyslijZaproszenieMailem(z.id).then((m) => {
      $('#wspolpraca-gotowe-opis').textContent = m.wyslano
        ? `Wysłano e-mail z zaproszeniem na adres ${z.email}. ${gdzie}`
        : `${m.powod === 'brak-konfiguracji' ? 'Aplikacja nie wysyła jeszcze e-maili' : `E-mail nie wyszedł${m.blad ? ` (${m.blad})` : ''}`} – wyślij link sam: skopiuj go albo użyj swojej poczty. ${gdzie}`;
    }).catch(() => { $('#wspolpraca-gotowe-opis').textContent = `Wyślij link sam: skopiuj go albo użyj swojej poczty. ${gdzie}`; });
    const mail = trescMaila(otwarty.nazwa, rola, link);
    $('#wspolpraca-mail').href = `mailto:${encodeURIComponent(z.email)}?subject=${encodeURIComponent(mail.temat)}&body=${encodeURIComponent(mail.tresc)}`;
    const udostepnij = $('#wspolpraca-udostepnij');
    udostepnij.hidden = !navigator.share;
    udostepnij.onclick = () => navigator.share({ title: mail.temat, text: mail.tresc }).catch(() => {});
    $('#wspolpraca-gotowe').hidden = false;
    pole.value = '';
    powiadom(`Zaproszono ${z.email}.`);
  } catch (err) {
    powiadom(komunikatBledu(err), true);
  } finally {
    b.disabled = false;
  }
  odswiezOsoby();
}

$('#form-zaproszenia').addEventListener('submit', zapros);

export const kopiujLinkZaproszenia = () => kopiuj($('#wspolpraca-link').value, 'Link do zaproszenia skopiowany.');

// Współpracownik opuszcza projekt: znika z jego listy (także kopia na tym urządzeniu).
export async function opuscProjekt(projekt = otwarty) {
  if (!projekt) return;
  const nazwa = projekt.nazwa || 'Bez nazwy';
  if (!await potwierdz(`Opuścić „${nazwa}”?`, 'Projekt zniknie z Twojej listy. Właściciel i pozostałe osoby dalej go mają; wrócić możesz tylko z nowym zaproszeniem.', 'Opuść projekt', true)) return;
  try {
    await wsp.usunZProjektu(projekt.id, stan.uzytkownik.id);
  } catch (e) {
    powiadom(komunikatBledu(e), true);
    return;
  }
  if ($('#dlg-wspolpraca').open) zamknijWspolprace();
  await zalezne.usunKopieLokalna(projekt.id);
  powiadom(`Opuszczono projekt „${nazwa}”.`);
  if (stan.projekt?.id === projekt.id) {
    stan.projekt = null;
    document.dispatchEvent(new CustomEvent('seriodruk:projekt', { detail: null }));
  }
  await zalezne.pokazProjekty();
}

// ======================================================================
// Zaproszenia do mnie: skrzynka na liście projektów
// ======================================================================

let mojeZaproszenia = [];

export async function odswiezZaproszenia() {
  if (!stan.uzytkownik) return [];
  try {
    mojeZaproszenia = await wsp.mojeZaproszenia();
  } catch {
    mojeZaproszenia = [];
  }
  const b = $('#przycisk-zaproszenia');
  b.hidden = mojeZaproszenia.length === 0;
  $('#liczba-zaproszen').textContent = mojeZaproszenia.length;
  b.title = mojeZaproszenia.length === 1 ? 'Masz zaproszenie do projektu' : `Masz zaproszenia do projektów (${mojeZaproszenia.length})`;
  if ($('#dlg-zaproszenia').open) rysujZaproszenia();
  return mojeZaproszenia;
}

export async function otworzZaproszenia() {
  await odswiezZaproszenia();
  rysujZaproszenia();
  const dlg = $('#dlg-zaproszenia');
  if (!dlg.open) dlg.showModal();
}

function rysujZaproszenia() {
  const ul = $('#zaproszenia-lista');
  $('#zaproszenia-pusto').hidden = mojeZaproszenia.length > 0;
  ul.replaceChildren(...mojeZaproszenia.map((z) => {
    const li = document.createElement('li');
    li.className = 'osoba';
    const znak = document.createElement('span');
    znak.className = 'awatar-maly';
    znak.textContent = inicjal(z.od);
    const opis = document.createElement('div');
    const tytul = document.createElement('strong');
    tytul.textContent = z.projekt || 'Projekt';
    const szczegoly = document.createElement('span');
    szczegoly.className = 'ciche';
    szczegoly.textContent = `${z.od} zaprasza · ${dlaMnie(z.rola)} · ${kiedy(z.utworzono)}`;
    opis.append(tytul, szczegoly);
    const akcje = document.createElement('div');
    akcje.className = 'osoba-akcje';
    akcje.append(
      przycisk('Odrzuć', '', async () => {
        try { await wsp.odrzucZaproszenie(z.kod); } catch (e) { powiadom(komunikatBledu(e), true); }
        await odswiezZaproszenia();
      }),
      przycisk('Przyjmij', 'glowny', () => przyjmij(z.kod, z.projekt)),
    );
    li.append(znak, opis, akcje);
    return li;
  }));
}

async function przyjmij(kod, nazwa) {
  try {
    const w = await zPostepem(`Dołączanie do „${nazwa || 'projektu'}”…`, () => wsp.przyjmijZaproszenie(kod));
    for (const id of ['#dlg-zaproszenia', '#dlg-zaproszenie']) if ($(id).open) $(id).close();
    powiadom(`Dołączono do projektu „${nazwa || 'Projekt'}” – ${dlaMnie(w.rola)}.`);
    await odswiezZaproszenia();
    await zalezne.otworzProjektPoId(w.projekt_id);
  } catch (e) {
    powiadom(komunikatBledu(e), true);
    await odswiezZaproszenia();
  }
}

// ======================================================================
// Zaproszenie z linku: #/zaproszenie/<kod>
// ======================================================================

export async function pokazZaproszenieZLinku(kod) {
  trasa.ustaw('projekty', { zastap: true });
  await zalezne.pokazProjekty();
  let info;
  try {
    info = await wsp.zaproszenieZKodu(kod);
  } catch (e) {
    powiadom(`Nie udało się odczytać zaproszenia: ${komunikatBledu(e)}`, true);
    return;
  }
  const komunikaty = {
    brak: 'Tego zaproszenia już nie ma – mogło zostać cofnięte. Poproś o nowe.',
    wygaslo: 'To zaproszenie wygasło. Poproś właściciela o nowe.',
    przyjete: 'To zaproszenie zostało już wykorzystane.',
    odrzucone: 'To zaproszenie zostało odrzucone.',
  };
  if (info.stan === 'wlasciciel' || info.stan === 'juz_masz') {
    powiadom(info.stan === 'wlasciciel' ? 'To Twój projekt.' : `Masz już dostęp do „${info.projekt}”.`);
    await zalezne.otworzProjektPoId(info.projekt_id);
    return;
  }
  if (info.stan !== 'ok') { powiadom(komunikaty[info.stan] || 'Nie można przyjąć tego zaproszenia.', true); return; }
  $('#zaproszenie-tytul').textContent = `„${info.projekt}”`;
  const inny = info.email && stan.uzytkownik?.email && info.email.toLowerCase() !== stan.uzytkownik.email.toLowerCase();
  $('#zaproszenie-opis').textContent = `${info.od} zaprasza Cię do wspólnej pracy nad projektem – ${dlaMnie(info.rola)}.${inny ? ` Zaproszenie poszło na adres ${info.email}; przyjmiesz je kontem ${stan.uzytkownik.email}.` : ''}`;
  const dlg = $('#dlg-zaproszenie');
  $('#zaproszenie-przyjmij').onclick = () => przyjmij(kod, info.projekt);
  $('#zaproszenie-odrzuc').onclick = async () => {
    try { await wsp.odrzucZaproszenie(kod); powiadom('Zaproszenie odrzucone.'); } catch (e) { powiadom(komunikatBledu(e), true); }
    dlg.close();
    odswiezZaproszenia();
  };
  if (!dlg.open) dlg.showModal();
}

// ======================================================================
// Na żywo: nowe zaproszenie, przyjęte zaproszenie, odebrany dostęp
// ======================================================================

let znaneZaproszenia = new Set();
let timerListy = null;

export async function wlaczWspolprace(uzytkownik) {
  znaneZaproszenia = new Set((await odswiezZaproszenia()).map((z) => z.id));
  try {
    await wsp.sluchajZaproszen(uzytkownik, {
      naZaproszenie: async () => {
        const lista = await odswiezZaproszenia();
        const nowe = lista.filter((z) => !znaneZaproszenia.has(z.id));
        for (const z of lista) znaneZaproszenia.add(z.id);
        if (nowe.length) {
          const z = nowe[0];
          powiadom(`${z.od} zaprasza Cię do projektu „${z.projekt}”.`, false, { etykieta: 'Pokaż', fn: otworzZaproszenia });
        }
      },
      naDostep: () => {
        // Przyjęte zaproszenie albo zmiana dostępu: lista projektów i okno współpracy idą za tym.
        if ($('#dlg-wspolpraca').open) odswiezOsoby();
        clearTimeout(timerListy);
        timerListy = setTimeout(() => { if (!stan.projekt && document.body.dataset.ekran === 'projekty') zalezne.pokazProjekty({ cicho: true }); }, 600);
      },
    });
  } catch { /* bez kanału zaproszenia widać po odświeżeniu listy */ }
}

export async function wylaczWspolprace() {
  mojeZaproszenia = [];
  await wsp.przestanSluchacZaproszen();
}

// ---------- Projekt otwarty w edytorze: rola i przyciski tylko dla właściciela ----------
// body.wspolpracownik – projekt kogoś innego (bez linku podglądu i dostępu dla AI); body.tylko-ogladanie –
// rola „może oglądać”: tylko podgląd.
export function ustawTrybProjektu(projekt) {
  const udzial = projekt?.wspolpraca_chmury || null;
  document.body.classList.toggle('wspolpracownik', Boolean(udzial));
  document.body.classList.toggle('tylko-ogladanie', udzial?.rola === 'odczyt');
}

document.addEventListener('seriodruk:projekt', (e) => ustawTrybProjektu(e.detail));

export const ikonaWspolpracy = (rozmiar = 14) => ikona('uzytkownik', { rozmiar });
