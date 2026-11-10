// Okno „Dane”: tabele projektu z lekkim edytorem (komórki, wiersze, kolumny,
// wklejanie z arkusza, import CSV i Excela) oraz okno ustawień serii.
//
// Zmiany trafiają od razu do projektu; aplikacja zapisuje je tak jak resztę.

import { nowaTabela, normalizujTabele, nowaSeria } from './projekt.js';
import { wczytajPlik, parsujTekst, doCsv, doXlsx, zmienNazwePola } from './tabele.js';
import { kolumnySerii, brakujaceKolumny, szablonSerii, powtorzenia } from './kontrola.js';
import { blokiSerii, liczbaPowielen } from './serie.js';
import { POLA_DOKUMENTU } from './pola.js';
import { $, powiadom, potwierdz, pobierz, bezpiecznaNazwa, odmiana } from './ui.js';
import { wstawIkony } from './ikony.js';

const MAKS_WIERSZY_NA_EKRANIE = 1500;

export class Dane {
  // projekt: () => bieżący projekt; przedOtwarciem() – aplikacja przepisuje
  // płótno do projektu i odłącza je (okna zmieniają projekt bezpośrednio);
  // poZmianie() – zapisz i odśwież miniatury; poZamknieciu() – wczytaj otwartą
  // stronę od nowa.
  constructor({ projekt, przedOtwarciem, poZmianie, poZamknieciu }) {
    this.projekt = projekt;
    this.przedOtwarciem = przedOtwarciem;
    this.poZmianie = poZmianie;
    this.poZamknieciu = poZamknieciu;
    this.idTabeli = null;
    this.dlg = $('#dlg-dane');
    this.siatka = $('#dane-siatka');
    this._zdarzeniaTabel();
    this._zdarzeniaSerii();
  }

  // ---------- Tabele ----------

  tabela() {
    return this.projekt().tabele.find((t) => t.id === this.idTabeli) || null;
  }

  otworz(idTabeli = null) {
    const { tabele } = this.projekt();
    this.idTabeli = tabele.some((t) => t.id === idTabeli) ? idTabeli : (this.tabela()?.id || tabele[0]?.id || null);
    this.rysuj();
    if (!this.dlg.open) { this.przedOtwarciem(); this.dlg.showModal(); }
  }

  rysuj() {
    this.rysujListe();
    this.rysujTabele();
    wstawIkony(this.dlg);
  }

  rysujListe() {
    const p = this.projekt();
    const lista = $('#dane-tabele');
    lista.replaceChildren();
    for (const t of p.tabele) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-current', String(t.id === this.idTabeli));
      b.innerHTML = '<strong></strong><small></small>';
      b.querySelector('strong').textContent = t.nazwa;
      b.querySelector('small').textContent = `${t.wiersze.length} ${odmiana(t.wiersze.length, 'wiersz', 'wiersze', 'wierszy')} · ${t.kolumny.length} ${odmiana(t.kolumny.length, 'kolumna', 'kolumny', 'kolumn')}`;
      b.addEventListener('click', () => { this.idTabeli = t.id; this.rysuj(); });
      li.append(b);
      lista.append(li);
    }
  }

  rysujTabele() {
    const t = this.tabela();
    $('#dane-pusto').hidden = Boolean(t);
    $('#dane-edytor').hidden = !t;
    if (!t) return;
    $('#dane-nazwa').value = t.nazwa;
    const serie = this.projekt().serie.filter((s) => s.tabela === t.id).map((s) => `„${s.nazwa}”`);
    const pokazane = Math.min(t.wiersze.length, MAKS_WIERSZY_NA_EKRANIE);
    $('#dane-opis').textContent = [
      serie.length ? `Używana w ${serie.length === 1 ? 'serii' : 'seriach'}: ${serie.join(', ')}.` : 'Nie jest jeszcze używana w żadnej serii – serię ustawiasz we właściwościach strony.',
      t.wiersze.length > pokazane ? `Pokazuję pierwsze ${pokazane} z ${t.wiersze.length} wierszy; reszta jest w projekcie.` : '',
    ].filter(Boolean).join(' ');

    const html = ['<thead><tr><th class="rog"></th>'];
    t.kolumny.forEach((k, i) => {
      html.push(`<th><div class="naglowek-kolumny"><span class="nazwa-kolumny" contenteditable="plaintext-only" spellcheck="false" data-k="${i}" title="Nazwa kolumny – w tekście wpisujesz ją w nawiasach klamrowych"></span><button type="button" class="pilnuj-kolumne" data-k="${i}" aria-pressed="${Boolean(t.unikalne?.includes(k))}" title="Pilnuj, żeby wartości w tej kolumnie się nie powtarzały" aria-label="Pilnuj powtórzeń w kolumnie">≠</button><button type="button" class="usun-kolumne" data-k="${i}" title="Usuń kolumnę" aria-label="Usuń kolumnę">×</button></div></th>`);
    });
    html.push('</tr></thead><tbody>');
    for (let w = 0; w < pokazane; w += 1) {
      html.push(`<tr><th class="nr"><span>${w + 1}</span><button type="button" class="usun-wiersz" data-w="${w}" title="Usuń wiersz" aria-label="Usuń wiersz ${w + 1}">×</button></th>`);
      for (let k = 0; k < t.kolumny.length; k += 1) html.push(`<td contenteditable="plaintext-only" spellcheck="false" data-w="${w}" data-k="${k}"></td>`);
      html.push('</tr>');
    }
    html.push('</tbody>');
    this.siatka.innerHTML = html.join('');
    this.siatka.querySelectorAll('.nazwa-kolumny').forEach((el) => { el.textContent = t.kolumny[Number(el.dataset.k)]; });
    this.siatka.querySelectorAll('td').forEach((td) => { td.textContent = t.wiersze[Number(td.dataset.w)][Number(td.dataset.k)]; });
    this._oznaczPowtorzenia();
  }

  // Powtórzone wartości w kolumnach pilnowanych: podświetlone komórki i opis pod tabelą.
  _oznaczPowtorzenia() {
    const t = this.tabela();
    for (const td of this.siatka.querySelectorAll('td.powtorzona')) td.classList.remove('powtorzona');
    const opisy = [];
    for (const kolumna of t.unikalne || []) {
      const k = t.kolumny.indexOf(kolumna);
      const znalezione = powtorzenia(t, kolumna);
      for (const p of znalezione) for (const w of p.wiersze) this._komorka(w, k)?.classList.add('powtorzona');
      if (znalezione.length) opisy.push(`„${kolumna}”: ${znalezione.slice(0, 4).map((p) => `„${p.wartosc}” (wiersze ${p.wiersze.map((w) => w + 1).join(', ')})`).join('; ')}${znalezione.length > 4 ? ` i ${znalezione.length - 4} więcej` : ''}`);
    }
    const el = $('#dane-powtorzenia');
    el.hidden = !opisy.length;
    el.textContent = opisy.length ? `Powtórzone wartości – ${opisy.join('. ')}.` : '';
  }

  _komorka(w, k) {
    return this.siatka.querySelector(`td[data-w="${w}"][data-k="${k}"]`);
  }

  _zmieniono() {
    this.rysujListe();
    this.poZmianie();
  }

  _dodajWiersz() {
    const t = this.tabela();
    t.wiersze.push(t.kolumny.map(() => ''));
  }

  // Wstawia wiersze komórek od komórki (w, k); tabela rośnie w razie potrzeby.
  wklej(wiersze, w, k) {
    const t = this.tabela();
    wiersze.forEach((komorki, dw) => {
      while (t.wiersze.length <= w + dw) this._dodajWiersz();
      komorki.forEach((wartosc, dk) => {
        while (t.kolumny.length <= k + dk) this._dodajKolumne();
        t.wiersze[w + dw][k + dk] = wartosc;
      });
    });
    Object.assign(t, normalizujTabele(t));
  }

  _dodajKolumne() {
    const t = this.tabela();
    let n = t.kolumny.length + 1;
    while (t.kolumny.includes(`kolumna_${n}`)) n += 1;
    t.kolumny.push(`kolumna_${n}`);
    for (const w of t.wiersze) w.push('');
  }

  _zmienNazweKolumny(el) {
    const t = this.tabela();
    const k = Number(el.dataset.k);
    const stara = t.kolumny[k];
    const nowa = el.textContent.replace(/[{}:\n]/g, ' ').trim();
    if (!nowa || nowa === stara) { el.textContent = stara; return; }
    if (t.kolumny.includes(nowa)) {
      el.textContent = stara;
      powiadom(`Kolumna „${nowa}” już jest w tej tabeli.`, true);
      return;
    }
    if (POLA_DOKUMENTU.some(([nazwa]) => nazwa === nowa)) {
      powiadom(`Uwaga: „${nowa}” to także nazwa pola dokumentu. Na stronach tej tabeli pole {${nowa}} pokaże wartość z kolumny.`);
    }
    t.kolumny[k] = nowa;
    if (t.unikalne) t.unikalne = t.unikalne.map((u) => (u === stara ? nowa : u));
    el.textContent = nowa;
    const n = zmienNazwePola(this.projekt(), stara, nowa);
    if (n) powiadom(`Zmieniono {${stara}} na {${nowa}} w ${n} ${odmiana(n, 'elemencie', 'elementach', 'elementach')}.`);
    this._zmieniono();
  }

  _zdarzeniaTabel() {
    const s = this.siatka;
    s.addEventListener('input', (e) => {
      const td = e.target.closest('td');
      if (!td) return;
      this.tabela().wiersze[Number(td.dataset.w)][Number(td.dataset.k)] = td.textContent.replace(/\n$/, '');
      if (this.tabela().unikalne?.length) this._oznaczPowtorzenia();
      this.poZmianie();
    });
    s.addEventListener('focusout', (e) => {
      const el = e.target.closest('.nazwa-kolumny');
      if (el) this._zmienNazweKolumny(el);
    });
    s.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return; // Shift+Enter: nowa linia w komórce
      const naglowek = e.target.closest('.nazwa-kolumny');
      if (naglowek) { e.preventDefault(); naglowek.blur(); return; }
      const td = e.target.closest('td');
      if (!td) return;
      e.preventDefault();
      const w = Number(td.dataset.w) + 1;
      const k = Number(td.dataset.k);
      if (w >= this.tabela().wiersze.length) { this._dodajWiersz(); this.rysujTabele(); this._zmieniono(); }
      this._komorka(w, k)?.focus();
    });
    // Dane skopiowane z Excela albo Arkuszy Google (komórki rozdzielone tabulatorami).
    s.addEventListener('paste', (e) => {
      const td = e.target.closest('td');
      const tekst = e.clipboardData?.getData('text/plain') ?? '';
      if (!td || !/[\t\n]/.test(tekst.replace(/\r?\n$/, ''))) return;
      e.preventDefault();
      const [w, k] = [Number(td.dataset.w), Number(td.dataset.k)];
      this.wklej(parsujTekst(tekst, '\t'), w, k);
      this.rysujTabele();
      this._komorka(w, k)?.focus();
      this._zmieniono();
    });
    s.addEventListener('click', async (e) => {
      const t = this.tabela();
      const kolumna = e.target.closest('.usun-kolumne');
      const wiersz = e.target.closest('.usun-wiersz');
      const pilnuj = e.target.closest('.pilnuj-kolumne');
      if (pilnuj) {
        const nazwa = t.kolumny[Number(pilnuj.dataset.k)];
        const bylo = t.unikalne?.includes(nazwa);
        t.unikalne = bylo ? t.unikalne.filter((u) => u !== nazwa) : [...(t.unikalne || []), nazwa];
        if (!t.unikalne.length) delete t.unikalne;
        pilnuj.setAttribute('aria-pressed', String(!bylo));
        this._oznaczPowtorzenia();
        this._zmieniono();
        return;
      }
      if (kolumna) {
        if (t.kolumny.length <= 1) { powiadom('Tabela musi mieć przynajmniej jedną kolumnę.', true); return; }
        const k = Number(kolumna.dataset.k);
        if (!await potwierdz(`Usunąć kolumnę „${t.kolumny[k]}”?`, 'Pola z tej kolumny przestaną się wypełniać.', 'Usuń kolumnę', true)) return;
        if (t.unikalne) t.unikalne = t.unikalne.filter((u) => u !== t.kolumny[k]);
        t.kolumny.splice(k, 1);
        for (const w of t.wiersze) w.splice(k, 1);
      } else if (wiersz) t.wiersze.splice(Number(wiersz.dataset.w), 1);
      else return;
      this.rysujTabele();
      this._zmieniono();
    });

    $('#dane-nazwa').addEventListener('change', (e) => {
      const t = this.tabela();
      t.nazwa = e.target.value.trim() || t.nazwa;
      e.target.value = t.nazwa;
      this._zmieniono();
    });
    $('#dane-wiersz').addEventListener('click', () => {
      this._dodajWiersz();
      this.rysujTabele();
      this._komorka(this.tabela().wiersze.length - 1, 0)?.focus();
      this._zmieniono();
    });
    $('#dane-kolumna').addEventListener('click', () => {
      this._dodajKolumne();
      this.rysujTabele();
      const el = this.siatka.querySelector(`.nazwa-kolumny[data-k="${this.tabela().kolumny.length - 1}"]`);
      el?.focus();
      if (el) window.getSelection().selectAllChildren(el);
      this._zmieniono();
    });
    $('#dane-csv').addEventListener('click', () => {
      const t = this.tabela();
      pobierz(`${bezpiecznaNazwa(t.nazwa)}.csv`, URL.createObjectURL(new Blob([doCsv(t)], { type: 'text/csv;charset=utf-8' })));
    });
    $('#dane-usun').addEventListener('click', async () => {
      const t = this.tabela();
      const p = this.projekt();
      const serie = p.serie.filter((x) => x.tabela === t.id);
      const opis = serie.length ? `Serie, które z niej korzystają (${serie.map((x) => `„${x.nazwa}”`).join(', ')}), zostaną bez danych.` : 'Tej operacji nie da się cofnąć.';
      if (!await potwierdz(`Usunąć tabelę „${t.nazwa}”?`, opis, 'Usuń tabelę', true)) return;
      p.tabele = p.tabele.filter((x) => x !== t);
      for (const x of serie) x.tabela = null;
      this.idTabeli = p.tabele[0]?.id || null;
      this.rysuj();
      this.poZmianie();
    });
    $('#dane-nowa').addEventListener('click', () => {
      const p = this.projekt();
      const t = nowaTabela(`Tabela ${p.tabele.length + 1}`, ['kolumna_1', 'kolumna_2'], [['', '']]);
      p.tabele.push(t);
      this.idTabeli = t.id;
      this.rysuj();
      this.poZmianie();
    });
    for (const id of ['#dane-importuj', '#dane-importuj-2']) $(id).addEventListener('click', () => $('#plik-dane').click());
    $('#plik-dane').addEventListener('change', async (e) => {
      const plik = e.target.files[0];
      if (plik) await this.importuj(plik);
      e.target.value = '';
    });
    $('#dane-zamknij').addEventListener('click', () => this.dlg.close());
    this.dlg.addEventListener('close', () => this.poZamknieciu());
  }

  // Import pliku. Tabela o tej samej nazwie dostaje nowe dane (serie zostają
  // z nią powiązane) – tak aktualizuje się dane poprawione w arkuszu.
  async importuj(plik) {
    const p = this.projekt();
    let wczytane;
    try { wczytane = await wczytajPlik(plik); } catch (e) { powiadom(`Nie udało się wczytać pliku: ${e.message}`, true); return; }
    let ostatnia = null;
    for (const surowa of wczytane) {
      const nowa = normalizujTabele({ ...surowa, id: undefined });
      const stara = p.tabele.find((t) => t.nazwa.trim().toLowerCase() === nowa.nazwa.trim().toLowerCase());
      if (stara && await potwierdz(`Zaktualizować tabelę „${stara.nazwa}”?`, `W projekcie jest już tabela o tej nazwie (${stara.wiersze.length} wierszy). Możesz podmienić jej dane na te z pliku (${nowa.wiersze.length} wierszy) albo dodać plik jako osobną tabelę.`, 'Podmień dane', false, 'Dodaj osobno')) {
        stara.kolumny = nowa.kolumny;
        stara.wiersze = nowa.wiersze;
        if (stara.unikalne) stara.unikalne = stara.unikalne.filter((u) => nowa.kolumny.includes(u));
        ostatnia = stara;
      } else {
        if (stara) nowa.nazwa = `${nowa.nazwa} (2)`;
        p.tabele.push(nowa);
        ostatnia = nowa;
      }
    }
    this.idTabeli = ostatnia.id;
    this.rysuj();
    this.poZmianie();
    powiadom(`Wczytano: ${ostatnia.wiersze.length} ${odmiana(ostatnia.wiersze.length, 'wiersz', 'wiersze', 'wierszy')}, ${ostatnia.kolumny.length} ${odmiana(ostatnia.kolumny.length, 'kolumna', 'kolumny', 'kolumn')}.`);
  }

  // ---------- Serie ----------

  // Tworzy serię (z pierwszą tabelą projektu, jeśli jakaś jest) i zwraca ją.
  nowaSeria() {
    const p = this.projekt();
    const seria = nowaSeria(`Seria ${p.serie.length + 1}`);
    seria.tabela = p.tabele[0]?.id || null;
    if (!seria.tabela) seria.tryb = 'stala';
    p.serie.push(seria);
    return seria;
  }

  // Opis serii jednym zdaniem: ile stron liczy blok i ile ich wyjdzie w wydruku.
  opisSerii(seria) {
    const p = this.projekt();
    const bloki = blokiSerii(p).filter((b) => b.seria === seria);
    if (!bloki.length) return 'Żadna strona nie należy jeszcze do tej serii.';
    return bloki.map((b) => {
      const n = b.strony.length;
      const ile = liczbaPowielen(p, seria, n);
      return `${n} ${odmiana(n, 'strona', 'strony', 'stron')} × ${ile} ${odmiana(ile, 'powielenie', 'powielenia', 'powieleń')} = ${n * ile} ${odmiana(n * ile, 'strona', 'strony', 'stron')} w wydruku`;
    }).join('; ');
  }

  otworzSerie(id) {
    const p = this.projekt();
    const seria = p.serie.find((s) => s.id === id);
    if (!seria) return;
    const dlg = $('#dlg-seria');
    const f = dlg.querySelector('form');
    dlg.dataset.id = id;
    f.elements.nazwa.value = seria.nazwa;
    const sel = f.elements.tabela;
    sel.replaceChildren(new Option('— bez tabeli —', ''));
    for (const t of p.tabele) sel.add(new Option(`${t.nazwa} (${t.wiersze.length} ${odmiana(t.wiersze.length, 'wiersz', 'wiersze', 'wierszy')})`, t.id));
    sel.value = seria.tabela || '';
    f.elements.tryb.value = seria.tryb;
    f.elements.ile.value = seria.ile;
    f.elements.uklad.value = seria.uklad;
    this._odswiezSerie();
    dlg.returnValue = '';
    this.przedOtwarciem();
    dlg.showModal();
  }

  _odswiezSerie() {
    const dlg = $('#dlg-seria');
    const f = dlg.querySelector('form');
    const maTabele = Boolean(f.elements.tabela.value);
    if (!maTabele) f.elements.tryb.value = 'stala';
    for (const r of f.querySelectorAll('input[name="tryb"]')) if (r.value === 'tabela') r.disabled = !maTabele;
    $('#seria-pole-ile').hidden = f.elements.tryb.value !== 'stala';
    $('#seria-pole-uklad').hidden = !(maTabele && f.elements.tryb.value === 'tabela');
    // Podsumowanie liczone z wartości z formularza, jeszcze przed zapisaniem.
    const seria = this.projekt().serie.find((s) => s.id === dlg.dataset.id);
    const proba = { ...seria, ...this._zFormularza(f) };
    const p = this.projekt();
    const bloki = blokiSerii(p).filter((b) => b.seria === seria);
    $('#seria-podsumowanie').textContent = bloki.length
      ? bloki.map((b) => { const n = b.strony.length; const ile = liczbaPowielen(p, proba, n); return `Blok ${n} ${odmiana(n, 'strony', 'stron', 'stron')} × ${ile} = ${n * ile} ${odmiana(n * ile, 'strona', 'strony', 'stron')} w wydruku.`; }).join(' ')
      : 'Żadna strona nie należy jeszcze do tej serii.';
    // Pola użyte na stronach serii i kolumny, których brakuje w wybranej tabeli.
    const potrzebne = kolumnySerii(p, proba);
    const brak = brakujaceKolumny(p, proba);
    $('#seria-pola-opis').textContent = potrzebne.length
      ? `Pola na stronach serii: ${potrzebne.map((k) => `{${k.nazwa}}`).join(', ')}.${brak.length ? ` W tabeli brakuje ${odmiana(brak.length, 'kolumny', 'kolumn', 'kolumn')}: ${brak.join(', ')}.` : (maTabele ? ' Tabela ma wszystkie potrzebne kolumny.' : '')}`
      : 'Na stronach tej serii nie ma jeszcze pól z danymi. Pole wstawiasz w tekście jako nazwę kolumny w nawiasach klamrowych, np. {dzien}.';
    $('#seria-dodaj-kolumny').hidden = !brak.length;
    $('#seria-dodaj-kolumny').textContent = maTabele ? 'Dodaj brakujące kolumny do tabeli' : 'Utwórz tabelę z tych pól';
    $('#seria-szablon').hidden = !bloki.length;
  }

  // Seria z okna, z wartościami wpisanymi w formularzu (jeszcze przed zapisaniem).
  _seriaZOkna() {
    const dlg = $('#dlg-seria');
    const seria = this.projekt().serie.find((s) => s.id === dlg.dataset.id);
    return { seria, proba: { ...seria, ...this._zFormularza(dlg.querySelector('form')) } };
  }

  _zFormularza(f) {
    return {
      nazwa: f.elements.nazwa.value.trim(),
      tabela: f.elements.tabela.value || null,
      tryb: f.elements.tryb.value === 'stala' ? 'stala' : 'tabela',
      ile: Math.min(2000, Math.max(1, Math.round(Number(f.elements.ile.value)) || 1)),
      uklad: f.elements.uklad.value === 'dlugi' ? 'dlugi' : 'szeroki',
    };
  }

  _zdarzeniaSerii() {
    const dlg = $('#dlg-seria');
    const f = dlg.querySelector('form');
    f.addEventListener('input', () => this._odswiezSerie());
    f.addEventListener('change', () => this._odswiezSerie());
    $('#seria-dodaj-kolumny').addEventListener('click', () => {
      const p = this.projekt();
      const { proba } = this._seriaZOkna();
      const brak = brakujaceKolumny(p, proba);
      let t = p.tabele.find((x) => x.id === proba.tabela);
      if (t) {
        // Pusta kolumna „kolumna_1” z nowej tabeli ustępuje miejsca prawdziwym.
        if (t.kolumny.length === 1 && /^kolumna_\d+$/.test(t.kolumny[0]) && t.wiersze.every((w) => w[0] === '')) { t.kolumny = []; t.wiersze = t.wiersze.map(() => []); }
        for (const k of brak) { t.kolumny.push(k); for (const w of t.wiersze) w.push(''); }
      } else {
        const ile = proba.tryb === 'stala' ? Math.min(proba.ile, 500) : 1;
        t = nowaTabela(proba.nazwa || 'Dane serii', brak, Array.from({ length: ile }, () => brak.map(() => '')));
        p.tabele.push(t);
        f.elements.tabela.add(new Option(`${t.nazwa} (${t.wiersze.length} ${odmiana(t.wiersze.length, 'wiersz', 'wiersze', 'wierszy')})`, t.id));
        f.elements.tabela.value = t.id;
      }
      this.poZmianie();
      this._odswiezSerie();
      powiadom(`Dodano ${odmiana(brak.length, 'kolumnę', 'kolumny', 'kolumn')}: ${brak.join(', ')}. Dane wpiszesz w oknie „Dane”.`);
    });
    $('#seria-szablon').addEventListener('click', async () => {
      const p = this.projekt();
      const { proba } = this._seriaZOkna();
      const s = szablonSerii(p, proba);
      try {
        const blob = await doXlsx([{ nazwa: s.nazwa, wiersze: [s.kolumny, ...s.wiersze] }, { nazwa: 'Instrukcja', wiersze: s.instrukcja }]);
        this.ostatniSzablon = blob; // do testów
        pobierz(`${bezpiecznaNazwa(p.nazwa)} - ${bezpiecznaNazwa(s.nazwa)} - szablon.xlsx`, URL.createObjectURL(blob));
      } catch (e) {
        powiadom(e.message, true);
      }
    });
    $('#seria-usun').addEventListener('click', async () => {
      const p = this.projekt();
      const seria = p.serie.find((s) => s.id === dlg.dataset.id);
      if (!await potwierdz(`Usunąć serię „${seria.nazwa}”?`, 'Strony zostają w projekcie, ale przestają się powielać.', 'Usuń serię', true)) return;
      p.serie = p.serie.filter((s) => s !== seria);
      for (const s of p.strony) if (s.seria === seria.id) delete s.seria;
      dlg.close('usun');
    });
    dlg.addEventListener('close', () => {
      const seria = this.projekt()?.serie.find((s) => s.id === dlg.dataset.id);
      if (dlg.returnValue === 'ok' && seria) {
        const nowe = this._zFormularza(f);
        Object.assign(seria, nowe, { nazwa: nowe.nazwa || seria.nazwa });
      }
      if (dlg.returnValue === 'ok' || dlg.returnValue === 'usun') this.poZmianie();
      this.poZamknieciu();
    });
  }
}
