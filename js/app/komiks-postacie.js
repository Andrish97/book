// Okno „Postacie i miejsca” trybu Komiks (#368, plan komiksu A9): karty postaci (imię, wygląd, znak rozpoznawczy,
// charakter, obraz wzorcowy, kolor dymka) i miejsc (opis, pora dnia, światło, obraz). Jedno okno: lista kart albo
// formularz jednej karty. Dane w zwykłych tabelach projektu (js/postacie.js) – widać je też w oknie Dane, a AI
// składa z nich opisy do obrazów. Kolor dymka postaci dostają dymki z [Ustaw dymki].

import { karty, zapiszKarte, usunKarte, RODZAJE_KART } from '../postacie.js';
import { przyjmijPlik, poNazwie } from '../obrazy-projektu.js';
import { adresZasobu } from '../zasoby.js';
import { zapiszBiezacyCel, zaplanujZapis } from './zapis.js';
import { $, powiadom, potwierdz } from '../ui.js';
import { stan } from './kontekst.js';
import { t, biezacyJezyk } from '../jezyk.js';
import { STYLE_RYSUNKOW, STYL_DOMYSLNY, stylProjektu, opisWzorcaPostaci, opisWzorcaMiejsca } from '../komiks-ai.js';
import { generujIWstaw } from './generuj-obraz.js';
import { JAKOSCI_OBRAZU, szacujObraz, opisKosztu } from '../ai-koszty.js';

const el = (tag, wl = {}, ...dzieci) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(wl)) {
    if (k === 'tekst') e.textContent = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v);
  }
  e.append(...dzieci.filter(Boolean));
  return e;
};

// Pola formularza: [pole karty, klucz etykiety, klucz podpowiedzi, wieloliniowe]
const POLA = {
  postacie: [['imie', 'komiks.imie', 'komiks.imiePrzyklad'], ['wyglad', 'komiks.wyglad', 'komiks.wygladPrzyklad', true],
    ['znak', 'komiks.znak', 'komiks.znakPrzyklad'], ['charakter', 'komiks.charakter', 'komiks.charakterPrzyklad']],
  miejsca: [['nazwa', 'komiks.miejsce', 'komiks.miejscePrzyklad'], ['opis', 'komiks.opisMiejsca', 'komiks.opisMiejscaPrzyklad', true],
    ['pora', 'komiks.pora', 'komiks.poraPrzyklad'], ['swiatlo', 'komiks.swiatlo', 'komiks.swiatloPrzyklad']],
};

function okno() {
  let dlg = $('#dlg-postacie');
  if (!dlg) {
    dlg = el('dialog', { id: 'dlg-postacie', class: 'okno-postaci' });
    document.body.append(dlg);
  }
  return dlg;
}

const miniatura = (nazwa) => {
  const id = nazwa ? poNazwie(stan.projekt, nazwa) : null;
  const adres = id ? adresZasobu(stan.projekt.zasoby[id]) : null;
  return adres ? el('img', { src: adres, alt: '' }) : el('span', { class: 'bez-obrazu', 'aria-hidden': 'true' });
};

function lista(dlg) {
  dlg.replaceChildren();
  const f = el('form', { method: 'dialog', class: 'formularz' });
  f.append(el('h2', { tekst: t('komiks.postacieIMiejsca') }), el('p', { class: 'ciche', tekst: t('komiks.postacieOpis') }));
  // Styl rysunków projektu (C1, #374) – dopisywany do każdego obrazu z AI w komiksie. Kafelki z przykładowym obrazkiem
  // tej samej sceny w każdym stylu (img/style/, E5) – widać różnicę bez czytania opisu.
  const wybrany = stan.projekt.komiks_ai?.styl || STYL_DOMYSLNY;
  const style = el('div', { class: 'style-rysunkow', role: 'radiogroup', 'aria-label': t('komiks.stylRysunkow') });
  for (const id of Object.keys(STYLE_RYSUNKOW)) {
    const r = el('input', { type: 'radio', name: 'styl', value: id });
    r.checked = id === wybrany;
    r.addEventListener('change', () => { stan.projekt.komiks_ai = { ...(stan.projekt.komiks_ai || {}), styl: id }; zaplanujZapis(); });
    style.append(el('label', { class: 'styl-rysunkow' }, r, el('img', { src: `img/style/${id}.webp`, alt: '', width: '80', height: '80', loading: 'lazy' }), el('span', { tekst: t(`komiks.styl_${id}`) })));
  }
  f.append(el('fieldset', { class: 'pole wybor-stylu' }, el('legend', { tekst: t('komiks.stylRysunkow') }), style, el('span', { class: 'ciche', tekst: t('komiks.stylRysunkowOpis') })));
  for (const rodzaj of ['postacie', 'miejsca']) {
    const lst = karty(stan.projekt, rodzaj);
    const siatka = el('div', { class: 'karty-komiksu', 'data-rodzaj': rodzaj });
    for (const k of lst) {
      const nazwa = rodzaj === 'postacie' ? k.imie : k.nazwa;
      const opis = rodzaj === 'postacie' ? (k.znak || k.wyglad) : (k.opis || k.pora);
      const b = el('button', { type: 'button', class: 'karta-komiksu', 'data-wiersz': String(k.wiersz) },
        miniatura(k.obraz), el('b', { tekst: nazwa }), opis ? el('span', { class: 'ciche', tekst: opis }) : null);
      if (rodzaj === 'postacie' && k.kolor) b.style.setProperty('--kolor-karty', k.kolor);
      b.addEventListener('click', () => formularz(dlg, rodzaj, k));
      siatka.append(b);
    }
    const dodaj = el('button', { type: 'button', class: 'karta-komiksu dodaj', 'data-akcja-karty': `dodaj-${rodzaj}` },
      el('span', { class: 'plus', 'aria-hidden': 'true', tekst: '+' }), el('b', { tekst: t(rodzaj === 'postacie' ? 'komiks.dodajPostac' : 'komiks.dodajMiejsce') }));
    dodaj.addEventListener('click', () => formularz(dlg, rodzaj, null));
    siatka.append(dodaj);
    f.append(el('h3', { tekst: t(rodzaj === 'postacie' ? 'komiks.postacie' : 'komiks.miejsca') }), siatka);
  }
  f.append(el('div', { class: 'przyciski-dialogu' }, el('button', { class: 'przycisk glowny', value: 'zamknij', tekst: t('komiks.gotowe') })));
  dlg.append(f);
}

function formularz(dlg, rodzaj, karta) {
  dlg.replaceChildren();
  const k = { ...(karta || {}) };
  const f = el('form', { method: 'dialog', class: 'formularz', 'data-rodzaj': rodzaj });
  const tytul = karta ? (rodzaj === 'postacie' ? k.imie : k.nazwa) : t(rodzaj === 'postacie' ? 'komiks.nowaPostac' : 'komiks.noweMiejsce');
  f.append(el('h2', { tekst: tytul }));
  for (const [pole, etyk, przyklad, dlugie] of POLA[rodzaj]) {
    const wej = dlugie ? el('textarea', { name: pole, rows: '3' }) : el('input', { name: pole, type: 'text' });
    wej.value = k[pole] || '';
    wej.placeholder = t(przyklad);
    if (pole === RODZAJE_KART[rodzaj].pola[0]) wej.required = true;
    f.append(el('label', { class: 'pole' }, el('span', { tekst: t(etyk) }), wej));
  }
  // Obraz wzorcowy: plik z urządzenia trafia do obrazów projektu.
  const podglad = el('div', { class: 'obraz-karty' }, miniatura(k.obraz));
  const plik = el('input', { type: 'file', accept: 'image/*', hidden: true, name: 'plik' });
  const wybierz = el('button', { type: 'button', class: 'przycisk', 'data-akcja-karty': 'obraz', tekst: t(k.obraz ? 'komiks.zmienObraz' : 'komiks.wybierzObraz') });
  wybierz.addEventListener('click', () => plik.click());
  plik.addEventListener('change', async () => {
    const p = plik.files?.[0];
    if (!p) return;
    if (!p.type.startsWith('image/')) { powiadom(t('edytorStart.toNieJestPlik'), true); return; }
    const { nazwa } = await przyjmijPlik(stan.projekt, p, p.name);
    k.obraz = nazwa;
    podglad.replaceChildren(miniatura(nazwa));
    wybierz.textContent = t('komiks.zmienObraz');
  });
  // Obraz wzorcowy z opisu (C2, #374): Gemini rysuje postać (miejsce) z pól karty w stylu projektu.
  const zAi = el('button', { type: 'button', class: 'przycisk', 'data-akcja-karty': 'obraz-ai', tekst: t('komiks.narysujZOpisu') });
  zAi.title = t('komiks.narysujZOpisuKoszt', { zl: opisKosztu(szacujObraz({ ...JAKOSCI_OBRAZU.szkic, znakiOpisu: 500 }), biezacyJezyk()) });
  import('./sejf-ai.js').then(({ maKluczGemini }) => maKluczGemini()).then((ma) => { if (!ma) { zAi.disabled = true; zAi.title = t('aiMenu.brakKluczaOpis'); } }); // F3
  zAi.addEventListener('click', async () => {
    for (const [pole] of POLA[rodzaj]) k[pole] = f.elements[pole].value;
    if (!k[RODZAJE_KART[rodzaj].pola[0]]) { f.elements[RODZAJE_KART[rodzaj].pola[0]].reportValidity(); return; }
    zAi.disabled = true; zAi.textContent = t('aiObraz.trwa');
    try {
      const w = await generujIWstaw({ opis: rodzaj === 'postacie' ? opisWzorcaPostaci(k, biezacyJezyk()) : opisWzorcaMiejsca(k, biezacyJezyk()), jakosc: 'szkic', proporcja: rodzaj === 'postacie' ? '3:4' : '4:3', styl: stylProjektu(stan.projekt), naStrone: false, potwierdzono: true });
      k.obraz = w.nazwa;
      podglad.replaceChildren(miniatura(w.nazwa));
      wybierz.textContent = t('komiks.zmienObraz');
      powiadom(t('aiObraz.gotowe', { zl: opisKosztu(w.zl, biezacyJezyk()) }));
    } catch (er) { powiadom(er.message, true); } finally { zAi.disabled = false; zAi.textContent = t('komiks.narysujZOpisu'); }
  });
  f.append(el('div', { class: 'pole' }, el('span', { tekst: t('komiks.obrazWzorcowy') }), el('div', { class: 'rzad' }, podglad, wybierz, zAi, plik),
    el('span', { class: 'ciche', tekst: t(rodzaj === 'postacie' ? 'komiks.obrazPostaciOpis' : 'komiks.obrazMiejscaOpis') })));
  if (rodzaj === 'postacie') {
    const kolor = el('input', { type: 'color', name: 'kolor' });
    kolor.value = /^#[0-9a-f]{6}$/i.test(k.kolor) ? k.kolor : '#ffffff';
    f.append(el('label', { class: 'pole' }, el('span', { tekst: t('komiks.kolorDymka') }), kolor, el('span', { class: 'ciche', tekst: t('komiks.kolorDymkaOpis') })));
  }
  const przyciski = el('div', { class: 'przyciski-dialogu' });
  if (karta) {
    const usun = el('button', { type: 'button', class: 'przycisk niebezpieczny', 'data-akcja-karty': 'usun', tekst: t('komiks.usunKarte') });
    usun.addEventListener('click', async () => {
      if (!await potwierdz(t('komiks.usunKarte'), t('komiks.usunKartePytanie', { nazwa: tytul }), t('komiks.usunKarte'), true)) return;
      zapiszBiezacyCel();
      usunKarte(stan.projekt, rodzaj, karta.wiersz);
      zaplanujZapis();
      lista(dlg);
    });
    przyciski.append(usun);
  }
  const wstecz = el('button', { type: 'button', class: 'przycisk', tekst: t('komiks.wstecz') });
  wstecz.addEventListener('click', () => lista(dlg));
  przyciski.append(wstecz, el('button', { class: 'przycisk glowny', type: 'submit', value: 'zapisz', tekst: t('komiks.zapiszKarte') }));
  f.append(przyciski);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    for (const [pole] of POLA[rodzaj]) k[pole] = f.elements[pole].value;
    if (rodzaj === 'postacie') k.kolor = f.elements.kolor.value.toLowerCase() === '#ffffff' ? '' : f.elements.kolor.value.toLowerCase();
    zapiszBiezacyCel();
    zapiszKarte(stan.projekt, rodzaj, { ...k, wiersz: karta ? karta.wiersz : null }, { nazwa: t(rodzaj === 'postacie' ? 'komiks.postacie' : 'komiks.miejsca') });
    zaplanujZapis();
    lista(dlg);
  });
  dlg.append(f);
  f.querySelector('input, textarea')?.focus();
}

export function oknoPostaci() {
  if (!stan.projekt) return;
  const dlg = okno();
  lista(dlg);
  dlg.returnValue = '';
  if (!dlg.open) dlg.showModal();
}
