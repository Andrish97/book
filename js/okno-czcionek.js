// Okno „Czcionki”: własne pliki czcionek projektu i lista czcionek wbudowanych.

import { $, powiadom, potwierdz, odmiana, pobierz } from './ui.js';
import { uid } from './projekt.js';
import { wstawIkony } from './ikony.js';
import {
  CZCIONKI, ROZSZERZENIA_CZCIONEK, dodajCzcionkiDoProjektu, zarejestrujCzcionkiProjektu, nazwaOdmiany, uzyteCzcionki,
} from './czcionki.js';
import { mojeCzcionki, zapamietaj, zapomnij, dodajRodzineDoProjektu, kluczOdmiany } from './moje-czcionki.js';

const probki = new Map(); // rodzina ze zbioru → nazwa, pod którą przeglądarka zna jej próbkę

export class OknoCzcionek {
  // projekt() → bieżący projekt; przedZmiana() – płótno oddaje treść do projektu;
  // poZmianie(rodzina) – zapis i ponowne wczytanie strony (tekst trzeba zmierzyć od nowa);
  // wlasciciel() – czyje są „Moje czcionki”; poZmianieZbioru() – po zmianie tego zbioru.
  constructor({ projekt, przedZmiana, poZmianie, wlasciciel = () => 'lokalny', poZmianieZbioru = () => {} }) {
    this.zrodlo = { projekt, przedZmiana, poZmianie, wlasciciel, poZmianieZbioru };
    this.okno = $('#dlg-czcionki');
    this.plik = $('#pliki-czcionki');
    this.plik.accept = ROZSZERZENIA_CZCIONEK.map((r) => `.${r}`).join(',');
    $('#czcionki-zamknij').addEventListener('click', () => this.okno.close());
    $('#czcionki-wgraj').addEventListener('click', () => this.wybierzPliki());
    $('#czcionki-pobierz-zestaw').addEventListener('click', () => this.pobierzZestaw());
    this.plik.addEventListener('change', async (e) => { const pliki = [...e.target.files]; e.target.value = ''; await this.dodaj(pliki); });
    $('#czcionki-wlasne').addEventListener('click', (e) => { const b = e.target.closest('[data-usun]'); if (b) this.usun(b.dataset.usun); });
    $('#czcionki-wlasne').addEventListener('change', (e) => { const i = e.target.closest('input[data-rodzina]'); if (i) this.zmienRodzine(i.dataset.rodzina, i.value); });
    $('#czcionki-moje').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.dodaj) this.dodajZMoich(b.dataset.dodaj);
      else if (b?.dataset.zapomnij) this.usunZMoich(b.dataset.zapomnij);
    });
  }

  otworz() { this.rysuj(); this.okno.showModal(); }

  wybierzPliki() { this.plik.click(); }

  rysuj() {
    const p = this.zrodlo.projekt();
    const uzyte = uzyteCzcionki(p);
    const lista = $('#czcionki-wlasne');
    lista.replaceChildren();
    const wlasne = [...(p.czcionki || [])].sort((a, b) => a.rodzina.localeCompare(b.rodzina, 'pl') || a.waga - b.waga || a.kursywa - b.kursywa);
    for (const c of wlasne) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="probka"></span>
        <label class="pole"><span>Rodzina</span><input data-rodzina="${c.id}" maxlength="60" aria-label="Nazwa rodziny czcionki"></label>
        <span class="opis"></span>
        <button type="button" class="przycisk-ikona" data-usun="${c.id}" data-ikona="kosz" title="Usuń czcionkę z projektu" aria-label="Usuń czcionkę"></button>`;
      const probka = li.querySelector('.probka');
      probka.textContent = 'Zażółć gęślą jaźń 0123';
      Object.assign(probka.style, { fontFamily: `"${c.rodzina}"`, fontWeight: c.waga, fontStyle: c.kursywa ? 'italic' : 'normal' });
      li.querySelector('input').value = c.rodzina;
      li.querySelector('.opis').textContent = `${nazwaOdmiany(c)} · ${p.zasoby[c.id]?.nazwa || 'plik'}${uzyte.has(c.rodzina) ? ' · używana' : ''}`;
      lista.append(li);
    }
    $('#czcionki-pusto').hidden = wlasne.length > 0;
    this.rysujMoje();
    this.rysujZestaw(uzyte);
    wstawIkony(this.okno);
  }

  // Oficjalny zestaw czcionek aplikacji: próbka każdej rodziny i pobieranie jej plików.
  rysujZestaw(uzyte) {
    const lista = $('#czcionki-zestaw');
    if (lista.children.length) { for (const li of lista.children) li.querySelector('.opis').textContent = this._opisZestawu(li.dataset.rodzina, uzyte); return; }
    for (const c of CZCIONKI) {
      const li = document.createElement('li');
      li.dataset.rodzina = c.nazwa;
      li.innerHTML = '<span class="nazwa-rodziny"></span><span class="probka"></span><span class="opis"></span><button type="button" class="przycisk-ikona" data-ikona="pobierz"></button>';
      li.querySelector('.nazwa-rodziny').textContent = c.nazwa;
      const pobierz = li.querySelector('button');
      pobierz.title = `Pobierz pliki czcionki ${c.nazwa}`;
      pobierz.setAttribute('aria-label', pobierz.title);
      const probka = li.querySelector('.probka');
      probka.textContent = 'Zażółć gęślą jaźń';
      probka.style.fontFamily = `"${c.nazwa}"`;
      li.querySelector('.opis').textContent = this._opisZestawu(c.nazwa, uzyte);
      li.querySelector('button').addEventListener('click', () => this.pobierzZestaw([c.nazwa]));
      lista.append(li);
    }
  }

  _opisZestawu(rodzina, uzyte) {
    const c = CZCIONKI.find((x) => x.nazwa === rodzina);
    const odmiany = [c.pogrubiona ? 'zwykła i pogrubiona' : 'jedna grubość', c.kursywa ? 'prosta i kursywa' : 'bez kursywy'].join(', ');
    return `${c.rodzaj} · ${odmiany}${uzyte.has(rodzina) ? ' · używana w tym projekcie' : ''}`;
  }

  // Pliki TTF oficjalnego zestawu (całego albo jednej rodziny) jako archiwum ZIP.
  async pobierzZestaw(rodziny) {
    try {
      const { zestawCzcionek } = await import('./eksport.js');
      const wynik = await zestawCzcionek(rodziny);
      this.ostatniZestaw = wynik; // do testów
      pobierz(wynik.nazwa, URL.createObjectURL(wynik.blob));
    } catch (e) { powiadom(`Nie udało się przygotować plików czcionek: ${e.message}`, true); }
  }

  // „Moje czcionki”: rodziny wgrane w innych projektach, których w tym jeszcze nie ma.
  async rysujMoje() {
    const p = this.zrodlo.projekt();
    const wProjekcie = new Set((p.czcionki || []).map((c) => c.rodzina));
    let moje = [];
    try { moje = (await mojeCzcionki(this.zrodlo.wlasciciel())).filter((c) => !wProjekcie.has(c.rodzina)); } catch { /* przeglądarka bez pamięci lokalnej */ }
    const rodziny = new Map();
    for (const c of moje) rodziny.set(c.rodzina, [...(rodziny.get(c.rodzina) || []), c]);
    const lista = $('#czcionki-moje');
    lista.replaceChildren();
    for (const [rodzina, odmiany] of rodziny) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="probka"></span>
        <span class="opis"></span>
        <button type="button" class="przycisk" data-rola="dodaj">Dodaj do projektu</button>
        <button type="button" class="przycisk-ikona" data-rola="zapomnij" data-ikona="kosz" title="Usuń z moich czcionek (projekty zachowują swoje kopie)" aria-label="Usuń z moich czcionek"></button>`;
      li.dataset.rodzina = rodzina;
      const probka = li.querySelector('.probka');
      probka.textContent = rodzina;
      const wzor = odmiany.find((c) => c.waga === 400 && !c.kursywa) || odmiany[0];
      this._probka(wzor).then((nazwa) => { if (nazwa) Object.assign(probka.style, { fontFamily: `"${nazwa}"`, fontWeight: wzor.waga, fontStyle: wzor.kursywa ? 'italic' : 'normal' }); });
      li.querySelector('.opis').textContent = `${odmiany.map(nazwaOdmiany).join(', ')} · ${odmiany.length} ${odmiana(odmiany.length, 'plik', 'pliki', 'plików')}`;
      li.querySelector('[data-rola="dodaj"]').dataset.dodaj = rodzina;
      li.querySelector('[data-rola="zapomnij"]').dataset.zapomnij = rodzina;
      lista.append(li);
    }
    $('#czcionki-moje-pusto').hidden = rodziny.size > 0;
    wstawIkony(lista);
  }

  // Próbka pisma dla czcionki, której nie ma w projekcie: osobna nazwa, żeby nie mieszała się z czcionkami projektu.
  async _probka(c) {
    if (probki.has(c.id)) return probki.get(c.id);
    const nazwa = `probka-pisma-${probki.size + 1}`;
    try {
      const face = new FontFace(nazwa, await (await fetch(c.dataUrl)).arrayBuffer(), { weight: String(c.waga), style: c.kursywa ? 'italic' : 'normal' });
      await face.load();
      document.fonts.add(face);
      probki.set(c.id, nazwa);
      return nazwa;
    } catch { return null; }
  }

  // Dodaje do projektu rodzinę z „Moich czcionek” (wszystkie jej odmiany).
  async dodajZMoich(rodzina) {
    this.zrodlo.przedZmiana();
    const ile = await dodajRodzineDoProjektu(this.zrodlo.wlasciciel(), this.zrodlo.projekt(), rodzina, uid);
    if (!ile) { powiadom(`Nie znaleziono czcionki „${rodzina}” w moich czcionkach.`, true); return; }
    powiadom(`Dodano do projektu czcionkę „${rodzina}” (${ile} ${odmiana(ile, 'odmiana', 'odmiany', 'odmian')}).`);
    await this.zrodlo.poZmianie(rodzina);
    await this.zrodlo.poZmianieZbioru();
    if (this.okno.open) this.rysuj();
  }

  async usunZMoich(rodzina) {
    await zapomnij(this.zrodlo.wlasciciel(), rodzina);
    powiadom(`Usunięto „${rodzina}” z moich czcionek. Projekty, które jej używają, zachowują swoją kopię.`);
    await this.zrodlo.poZmianieZbioru();
    if (this.okno.open) this.rysuj();
  }

  // Dodaje pliki; zwraca wpisy dodanych czcionek.
  async dodaj(pliki) {
    if (!pliki.length) return [];
    this.zrodlo.przedZmiana();
    const { dodane, odrzucone } = await dodajCzcionkiDoProjektu(this.zrodlo.projekt(), pliki, uid);
    if (odrzucone.length) powiadom(`Nie udało się wczytać: ${odrzucone.join(', ')}. Obsługiwane pliki: TTF, OTF, WOFF, WOFF2.`, true);
    if (dodane.length) {
      const rodziny = [...new Set(dodane.map((c) => c.rodzina))];
      powiadom(`Dodano ${dodane.length} ${odmiana(dodane.length, 'plik czcionki', 'pliki czcionek', 'plików czcionek')}: ${rodziny.join(', ')}.`);
      await this.zrodlo.poZmianie(rodziny[0]);
      try { await zapamietaj(this.zrodlo.wlasciciel(), this.zrodlo.projekt(), dodane); } catch { /* zbiór jest tylko ułatwieniem */ }
      this.zrodlo.poZmianieZbioru();
    }
    if (this.okno.open) this.rysuj();
    return dodane;
  }

  async usun(id) {
    const p = this.zrodlo.projekt();
    const c = p.czcionki.find((x) => x.id === id);
    if (!c) return;
    const ostatnia = p.czcionki.filter((x) => x.rodzina === c.rodzina).length === 1;
    const wUzyciu = ostatnia && uzyteCzcionki(p).has(c.rodzina);
    if (wUzyciu && !await potwierdz(`Usunąć czcionkę „${c.rodzina}”?`, 'Teksty, które jej używają, pokażą się czcionką zastępczą, dopóki nie wybierzesz innej.', 'Usuń czcionkę', true)) return;
    this.zrodlo.przedZmiana();
    p.czcionki = p.czcionki.filter((x) => x !== c);
    delete p.zasoby[id];
    await zarejestrujCzcionkiProjektu(p);
    await this.zrodlo.poZmianie(null);
    this.rysuj();
    this.zrodlo.poZmianieZbioru();
  }

  // Poprawka nazwy rodziny (gdy plik nie podaje jej dobrze). Teksty z dawną nazwą przechodzą na nową.
  async zmienRodzine(id, nazwa) {
    const p = this.zrodlo.projekt();
    const c = p.czcionki.find((x) => x.id === id);
    const nowa = nazwa.replace(/["{}]/g, '').trim();
    if (!c || !nowa || nowa === c.rodzina) { this.rysuj(); return; }
    this.zrodlo.przedZmiana();
    const stara = c.rodzina;
    const staryKlucz = kluczOdmiany(c);
    c.rodzina = nowa;
    // „Moje czcionki” idą za poprawioną nazwą.
    try { await zapomnij(this.zrodlo.wlasciciel(), stara, staryKlucz); await zapamietaj(this.zrodlo.wlasciciel(), p, [c]); } catch { /* zbiór jest tylko ułatwieniem */ }
    if (!p.czcionki.some((x) => x.rodzina === stara)) {
      const popraw = (obiekty) => {
        for (const o of obiekty || []) {
          if (o.fontFamily === stara) o.fontFamily = nowa;
          for (const s of Array.isArray(o.styles) ? o.styles : []) if (s.style?.fontFamily === stara) s.style.fontFamily = nowa;
          if (Array.isArray(o.objects)) popraw(o.objects);
        }
      };
      for (const s of p.strony) popraw(s.obiekty);
      for (const w of p.wzorce) popraw(w.obiekty);
      for (const s of p.style || []) if (s.fontFamily === stara) s.fontFamily = nowa;
    }
    await zarejestrujCzcionkiProjektu(p);
    await this.zrodlo.poZmianie(null);
    this.rysuj();
    this.zrodlo.poZmianieZbioru();
  }
}
