// Okno „Dane”: tabele projektu z lekkim edytorem (komórki, wiersze, kolumny,
// wklejanie z arkusza, import CSV i Excela) oraz okno ustawień serii.
//
// Zmiany trafiają od razu do projektu; aplikacja zapisuje je tak jak resztę.

import { nowaTabela, normalizujTabele, nowaSeria } from './projekt.js';
import { wczytajPlik, parsujTekst, doCsv, doXlsx, zmienNazwePola, zmienNazweTabeliWPolach } from './tabele.js';
import { kolumnySerii, brakujaceKolumny, szablonSerii, powtorzenia, opisKroku, spozaListy } from './kontrola.js';
import { blokiSerii, bilansSerii, tabeleSerii, polePoTabelach, kolumnyZmiany, zapisZmiany, wierszPomijany, ZNACZNIK_POMIJANIA } from './serie.js';
import { POLA_DOKUMENTU } from './pola.js';
import { $, powiadom, potwierdz, pobierz, bezpiecznaNazwa, odmiana, zapytajONazwe } from './ui.js';
import { wstawIkony } from './ikony.js';

// Długa tabela rysuje się porcjami: kolejne wiersze dochodzą przy przewijaniu.
const PORCJA_WIERSZY = 400;

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
    $('#dane-opis').textContent = [
      serie.length ? `Używana w ${serie.length === 1 ? 'serii' : 'seriach'}: ${serie.join(', ')}.` : 'Nie jest jeszcze używana w żadnej serii – serię ustawiasz we właściwościach strony.',
    ].filter(Boolean).join(' ');

    // Przełącznik wyglądu z arkusza jest tylko przy tabeli, która taki wygląd ma.
    const maWyglad = Boolean(t.wyglad?.some(Boolean));
    $('#dane-wyglad-pole').hidden = !maWyglad;
    $('#dane-wyglad').checked = maWyglad && !t.wyglad_wyl;

    const html = ['<thead><tr><th class="rog"></th>'];
    t.kolumny.forEach((k, i) => {
      html.push(`<th><div class="naglowek-kolumny"><span class="nazwa-kolumny" contenteditable="plaintext-only" spellcheck="false" data-k="${i}" title="Nazwa kolumny – w tekście wpisujesz ją w nawiasach klamrowych"></span><button type="button" class="pilnuj-kolumne" data-k="${i}" aria-pressed="${Boolean(t.unikalne?.includes(k))}" title="Pilnuj, żeby wartości w tej kolumnie się nie powtarzały" aria-label="Pilnuj powtórzeń w kolumnie">≠</button><button type="button" class="lista-kolumny" data-k="${i}" aria-pressed="${Boolean(t.listy?.[k]?.length)}" title="Lista dozwolonych wartości kolumny – w szablonie danych komórki dostaną listę rozwijaną" aria-label="Lista dozwolonych wartości kolumny">☰</button><button type="button" class="usun-kolumne" data-k="${i}" title="Usuń kolumnę" aria-label="Usuń kolumnę">×</button></div></th>`);
    });
    html.push('</tr></thead><tbody></tbody>');
    this.siatka.innerHTML = html.join('');
    this.siatka.querySelectorAll('.nazwa-kolumny').forEach((el) => { el.textContent = t.kolumny[Number(el.dataset.k)]; });
    this._narysowane = 0;
    this._dopiszWiersze(PORCJA_WIERSZY);
    this._oznaczPowtorzenia();
    this._opiszPomijane();
  }

  // Dorysowuje wiersze tabeli, aż będzie ich co najmniej `doIlu` (albo wszystkie).
  _dopiszWiersze(doIlu) {
    const t = this.tabela();
    const cel = Math.min(t.wiersze.length, doIlu);
    if (cel <= this._narysowane) return;
    const html = [];
    for (let w = this._narysowane; w < cel; w += 1) {
      html.push(`<tr${wierszPomijany(t.wiersze[w]) ? ' class="pomijany" title="Wiersz pomijany: zajmuje miejsce w bloku serii, ale strona dla niego nie powstaje"' : ''}><th class="nr"><span>${w + 1}</span><button type="button" class="usun-wiersz" data-w="${w}" title="Usuń wiersz" aria-label="Usuń wiersz ${w + 1}">×</button></th>`);
      for (let k = 0; k < t.kolumny.length; k += 1) html.push(`<td contenteditable="plaintext-only" spellcheck="false" data-w="${w}" data-k="${k}"></td>`);
      html.push('</tr>');
    }
    const od = this._narysowane;
    this._narysowane = cel;
    const tbody = this.siatka.tBodies[0];
    tbody.insertAdjacentHTML('beforeend', html.join(''));
    for (let w = od; w < cel; w += 1) {
      const komorki = tbody.rows[w].cells;
      for (let k = 0; k < t.kolumny.length; k += 1) this._pokazKomorke(komorki[k + 1], w, k);
    }
    if (od > 0 && (t.unikalne?.length || t.listy)) this._oznaczPowtorzenia();
  }

  // Powtórzone wartości w kolumnach pilnowanych i wartości spoza listy dozwolonych: podświetlone komórki
  // i opis pod tabelą.
  _oznaczPowtorzenia() {
    const t = this.tabela();
    for (const td of this.siatka.querySelectorAll('td.powtorzona, td.spoza-listy')) td.classList.remove('powtorzona', 'spoza-listy');
    const spoza = [];
    for (const kolumna of Object.keys(t.listy || {})) {
      const k = t.kolumny.indexOf(kolumna);
      const znalezione = spozaListy(t, kolumna);
      for (const s of znalezione) for (const w of s.wiersze) this._komorka(w, k)?.classList.add('spoza-listy');
      if (znalezione.length) spoza.push(`„${kolumna}”: ${znalezione.slice(0, 4).map((s) => `„${s.wartosc}” (${odmiana(s.wiersze.length, 'wiersz', 'wiersze', 'wiersze')} ${s.wiersze.map((w) => w + 1).join(', ')})`).join('; ')}${znalezione.length > 4 ? ` i ${znalezione.length - 4} więcej` : ''}`);
    }
    const uwaga = $('#dane-spoza-listy');
    uwaga.hidden = !spoza.length;
    uwaga.textContent = spoza.length ? `Wartości spoza listy – ${spoza.join('. ')}.` : '';
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

  _oznaczPomijany(tr, w) {
    const pomijany = wierszPomijany(this.tabela().wiersze[w]);
    tr.classList.toggle('pomijany', pomijany);
    tr.title = pomijany ? 'Wiersz pomijany: zajmuje miejsce w bloku serii, ale strona dla niego nie powstaje' : '';
    this._opiszPomijane();
  }

  // Ile wierszy tabeli jest pomijanych – jedno zdanie pod nazwą tabeli.
  _opiszPomijane() {
    const t = this.tabela();
    const ile = t ? t.wiersze.filter(wierszPomijany).length : 0;
    const el = $('#dane-pomijane');
    el.hidden = !ile;
    el.textContent = ile ? `${ile} ${odmiana(ile, 'wiersz pomijany', 'wiersze pomijane', 'wierszy pomijanych')} (${ZNACZNIK_POMIJANIA} w pierwszej komórce): ${odmiana(ile, 'zajmuje', 'zajmują', 'zajmuje')} miejsce w bloku serii, ale ${odmiana(ile, 'strona dla niego nie powstaje', 'strony dla nich nie powstają', 'strony dla nich nie powstają')}.` : '';
  }

  // Wstawia wiersz pomijany nad wierszem `przed` (bez wskazania – na początku tabeli).
  _wstawPomijany(przed = 0) {
    const t = this.tabela();
    const w = Math.min(Math.max(0, przed), t.wiersze.length);
    t.wiersze.splice(w, 0, t.kolumny.map((_, k) => (k === 0 ? ZNACZNIK_POMIJANIA : '')));
    t.wyglad?.splice(w, 0, null);
    return w;
  }

  // Treść komórki i jej wygląd: komórka wygląda tak, jak jej wartość będzie wyglądać na stronie
  // (wygląd całej komórki i części tekstu – z arkusza albo ustawiony tutaj).
  _pokazKomorke(td, w, k) {
    const t = this.tabela();
    const tekst = t.wiersze[w][k];
    const wyglad = t.wyglad && !t.wyglad_wyl ? t.wyglad[w]?.[k] : null;
    const css = (x) => ({ fontWeight: x?.pogrubienie ? '700' : '', fontStyle: x?.kursywa ? 'italic' : '', color: x?.kolor || '' });
    Object.assign(td.style, css(wyglad));
    if (!wyglad?.czesci?.length) { td.textContent = tekst; return; }
    td.textContent = '';
    let poz = 0;
    for (const c of wyglad.czesci) {
      if (c.od > poz) td.append(tekst.slice(poz, c.od));
      const s = document.createElement('span');
      s.textContent = tekst.slice(c.od, c.do);
      Object.assign(s.style, Object.fromEntries(Object.entries(css(c)).filter(([, v]) => v)));
      td.append(s);
      poz = c.do;
    }
    if (poz < tekst.length) td.append(tekst.slice(poz));
  }

  _komorka(w, k) {
    if (w >= (this._narysowane || 0)) this._dopiszWiersze(w + PORCJA_WIERSZY);
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
    // Samo {stara} poprawiamy tylko tam, gdzie bierze dane z tej tabeli: na stronach serii, w których
    // ta nazwa wskazuje właśnie ją, a poza seriami i we wzorcach – gdy żadna inna tabela nie ma takiej kolumny.
    const p = this.projekt();
    const jedyna = !p.tabele.some((x) => x !== t && x.kolumny.includes(stara));
    const zTejTabeli = new Set(p.strony.filter((s) => {
      const seria = p.serie.find((x) => x.id === s.seria);
      const tabele = seria ? tabeleSerii(p, seria) : [];
      return tabele.length ? polePoTabelach(stara, tabele)?.tabela === t : jedyna;
    }));
    t.kolumny[k] = nowa;
    if (t.unikalne) t.unikalne = t.unikalne.map((u) => (u === stara ? nowa : u));
    if (t.listy?.[stara]) { t.listy[nowa] = t.listy[stara]; delete t.listy[stara]; }
    // Tabele dodatkowe, które zmieniają wiersz razem z tą kolumną, idą za nową nazwą.
    for (const x of p.serie) if (x.tabela === t.id) for (const d of x.dodatkowe || []) if (kolumnyZmiany(d.zmiana).includes(stara)) d.zmiana = zapisZmiany(kolumnyZmiany(d.zmiana).map((z) => (z === stara ? nowa : z)));
    el.textContent = nowa;
    const n = zmienNazwePola(p, stara, nowa, (cel) => (p.strony.includes(cel) ? zTejTabeli.has(cel) : jedyna))
      + zmienNazwePola(p, `${t.nazwa}.${stara}`, `${t.nazwa}.${nowa}`);
    if (n) powiadom(`Zmieniono {${stara}} na {${nowa}} w ${n} ${odmiana(n, 'elemencie', 'elementach', 'elementach')}.`);
    this._zmieniono();
  }

  _zdarzeniaTabel() {
    const s = this.siatka;
    // Przewijanie blisko końca narysowanej części dorysowuje następną porcję wierszy.
    const opak = s.closest('.dane-siatka-opak');
    opak.addEventListener('scroll', () => {
      if (this.tabela() && opak.scrollTop + opak.clientHeight > opak.scrollHeight - 600) this._dopiszWiersze(this._narysowane + PORCJA_WIERSZY);
    }, { passive: true });
    s.addEventListener('input', (e) => {
      const td = e.target.closest('td');
      if (!td) return;
      const tab = this.tabela();
      const [nw, nk] = [Number(td.dataset.w), Number(td.dataset.k)];
      tab.wiersze[nw][nk] = td.textContent.replace(/\n$/, '');
      // Po zmianie tekstu wygląd części (zakresy znaków) przestaje pasować – zostaje wygląd całej komórki.
      const x = tab.wyglad?.[nw]?.[nk];
      if (x?.czesci) {
        delete x.czesci;
        if (!Object.keys(x).length) {
          tab.wyglad[nw][nk] = null;
          if (!tab.wyglad[nw].some(Boolean)) tab.wyglad[nw] = null;
          if (!tab.wyglad.some(Boolean)) { delete tab.wyglad; delete tab.wyglad_wyl; }
        }
      }
      // Znacznik [pomiń] wpisany (albo usunięty) w pierwszej komórce od razu zmienia wygląd wiersza.
      if (td.dataset.k === '0') this._oznaczPomijany(td.closest('tr'), Number(td.dataset.w));
      if (this.tabela().unikalne?.length || this.tabela().listy) this._oznaczPowtorzenia();
      this.poZmianie();
    });
    s.addEventListener('focusout', (e) => {
      const el = e.target.closest('.nazwa-kolumny');
      if (el) this._zmienNazweKolumny(el);
    });
    // Wiersz, w którym ostatnio stał kursor – nad nim staje wstawiany wiersz pomijany.
    s.addEventListener('focusin', (e) => {
      const td = e.target.closest('td');
      if (!td) return;
      this._ostatniWiersz = { tabela: this.idTabeli, w: Number(td.dataset.w) };
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
      const lista = e.target.closest('.lista-kolumny');
      if (lista) {
        // Lista dozwolonych wartości: wpisywane po średniku; samo „-” usuwa listę.
        const nazwa = t.kolumny[Number(lista.dataset.k)];
        const odp = await zapytajONazwe(`Dozwolone wartości kolumny „${nazwa}”`, 'Wartości po średniku, np. tak; nie. Samo „-” usuwa listę.', (t.listy?.[nazwa] || []).join('; '));
        if (odp === null) return;
        const wartosci = [...new Set(odp.split(/[;\n]/).map((v) => v.trim()).filter((v) => v && v !== '-'))];
        t.listy = { ...t.listy };
        if (wartosci.length) t.listy[nazwa] = wartosci; else delete t.listy[nazwa];
        if (!Object.keys(t.listy).length) delete t.listy;
        lista.setAttribute('aria-pressed', String(wartosci.length > 0));
        this._oznaczPowtorzenia();
        this._zmieniono();
        return;
      }
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
        if (t.listy) { delete t.listy[t.kolumny[k]]; if (!Object.keys(t.listy).length) delete t.listy; }
        for (const x of this.projekt().serie) if (x.tabela === t.id) for (const d of x.dodatkowe || []) if (d.zmiana) { d.zmiana = zapisZmiany(kolumnyZmiany(d.zmiana).filter((z) => z !== t.kolumny[k])); if (!d.zmiana) delete d.zmiana; }
        t.kolumny.splice(k, 1);
        for (const w of t.wiersze) w.splice(k, 1);
        for (const w of t.wyglad || []) w?.splice(k, 1);
      } else if (wiersz) { t.wiersze.splice(Number(wiersz.dataset.w), 1); t.wyglad?.splice(Number(wiersz.dataset.w), 1); } else return;
      this.rysujTabele();
      this._zmieniono();
    });

    $('#dane-nazwa').addEventListener('change', (e) => {
      const t = this.tabela();
      const stara = t.nazwa;
      t.nazwa = e.target.value.trim().replace(/[{}:\n]/g, ' ').trim() || t.nazwa;
      e.target.value = t.nazwa;
      if (stara !== t.nazwa) zmienNazweTabeliWPolach(this.projekt(), stara, t.nazwa);
      this._zmieniono();
    });
    // Wygląd przeniesiony z arkusza można wyłączyć – zostaje zapisany, ale strony go nie pokazują.
    $('#dane-wyglad').addEventListener('change', (e) => {
      const t = this.tabela();
      if (e.target.checked) delete t.wyglad_wyl; else t.wyglad_wyl = true;
      this.rysujTabele();
      this._zmieniono();
    });
    $('#dane-wiersz').addEventListener('click', () => {
      this._dodajWiersz();
      this.rysujTabele();
      this._komorka(this.tabela().wiersze.length - 1, 0)?.focus();
      this._zmieniono();
    });
    $('#dane-pomijany').addEventListener('click', () => {
      const gdzie = this._ostatniWiersz?.tabela === this.idTabeli ? this._ostatniWiersz.w : 0;
      const w = this._wstawPomijany(gdzie);
      this._ostatniWiersz = { tabela: this.idTabeli, w: w + 1 }; // kolejny pomijany stanie pod tym, nad tym samym wierszem danych
      this.rysujTabele();
      this._komorka(w, 0)?.scrollIntoView({ block: 'nearest' });
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
      for (const x of p.serie) x.dodatkowe = (x.dodatkowe || []).filter((d) => d.tabela !== t.id);
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
        if (nowa.wyglad) stara.wyglad = nowa.wyglad; else { delete stara.wyglad; delete stara.wyglad_wyl; }
        if (stara.unikalne) stara.unikalne = stara.unikalne.filter((u) => nowa.kolumny.includes(u));
        if (stara.listy) { for (const k of Object.keys(stara.listy)) if (!nowa.kolumny.includes(k)) delete stara.listy[k]; if (!Object.keys(stara.listy).length) delete stara.listy; }
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
    // W projekcie z rozkładówkami nowa seria od razu pilnuje, żeby strony lewe wychodziły po lewej, a prawe po prawej.
    seria.pilnuj_stron = p.sekcje.some((s) => s.uklad === 'rozkladowki');
    if (!seria.tabela) seria.tryb = 'stala';
    p.serie.push(seria);
    return seria;
  }

  // Opis serii jednym zdaniem: ile stron liczy blok i ile ich wyjdzie w wydruku.
  opisSerii(seria) {
    const p = this.projekt();
    const bloki = blokiSerii(p).filter((b) => b.seria === seria);
    if (!bloki.length) return 'Żadna strona nie należy jeszcze do tej serii.';
    return bilansSerii(p, seria).map((b) => {
      const { dlugosc: n, powielen: ile, stron } = b;
      const koniec = (b.ostatniePelne ? '' : ' (seria kończy się na ostatnim wierszu danych – ostatnie powielenie jest niepełne)')
        + (b.puste.length ? `; do tego ${b.puste.length} ${odmiana(b.puste.length, 'pusta strona', 'puste strony', 'pustych stron')}, żeby lewe strony zostały po lewej` : '')
        + (b.zamianaOd !== null ? `; uwaga: od strony ${b.zamianaOd} strony bloku wychodzą po przeciwnej stronie rozkładówki` : '');
      if (b.pominietych) return `${n} ${odmiana(n, 'strona', 'strony', 'stron')} w bloku, ${stron} ${odmiana(stron, 'strona', 'strony', 'stron')} w wydruku – ${b.pominietych} ${odmiana(b.pominietych, 'wiersz pomijany', 'wiersze pomijane', 'wierszy pomijanych')}${koniec}`;
      return `${n} ${odmiana(n, 'strona', 'strony', 'stron')} × ${ile} ${odmiana(ile, 'powielenie', 'powielenia', 'powieleń')} = ${stron} ${odmiana(stron, 'strona', 'strony', 'stron')} w wydruku${koniec}`;
    }).join('; ');
  }

  // Braki danych serii jednym zdaniem (pusty tekst, gdy wszystko jest): tabele dodatkowe, którym zabraknie wierszy.
  brakiSerii(seria, projekt = this.projekt()) {
    return bilansSerii(projekt, seria).flatMap((b) => b.dodatkowe.filter((d) => d.potrzeba > d.jest).map((d) => {
      const brak = d.potrzeba - d.jest;
      return `Brakuje danych: tabela „${d.tabela.nazwa}” ma ${d.jest} ${odmiana(d.jest, 'wiersz', 'wiersze', 'wierszy')}, a potrzeba ${d.potrzeba} (${brak} za mało). Od strony ${d.brakOd} jej pola będą puste.`;
    })).join(' ');
  }

  // Wiersz ustawień tabeli dodatkowej w oknie serii.
  _wierszDodatkowej(d = {}) {
    const p = this.projekt();
    const wiersz = document.createElement('div');
    wiersz.className = 'wiersz-dodatkowej';
    wiersz.innerHTML = `
      <label class="pole"><span>Tabela</span><select data-pole="tabela"></select></label>
      <label class="pole"><span>Nowy wiersz</span><select data-pole="kiedy"></select></label>
      <label class="pole waskie"><span>Nowy wiersz co … stron</span><input data-pole="co" type="number" min="1" max="2000" step="1" inputmode="numeric"></label>
      <label class="pole waskie" title="Gdy pierwszy okres jest krótszy – np. rok zaczyna się w środę, więc pierwszy tydzień ma 5 dni"><span>Pierwszy wiersz przez … stron</span><input data-pole="pierwszy" type="number" min="1" max="2000" step="1" inputmode="numeric" placeholder="tyle samo"></label>
      <button type="button" class="przycisk-ikona" data-usun-dodatkowa title="Usuń tę tabelę z serii" aria-label="Usuń tabelę dodatkową">×</button>`;
    const sel = wiersz.querySelector('select');
    for (const t of p.tabele) sel.add(new Option(`${t.nazwa} (${t.wiersze.length} ${odmiana(t.wiersze.length, 'wiersz', 'wiersze', 'wierszy')})`, t.id));
    sel.value = d.tabela || '';
    wiersz.querySelector('[data-pole="co"]').value = d.co || 7;
    wiersz.querySelector('[data-pole="pierwszy"]').value = d.pierwszy || '';
    this._ustawKiedy(wiersz, kolumnyZmiany(d.zmiana));
    return wiersz;
  }

  // Lista „Nowy wiersz”: co stałą liczbę stron albo gdy zmieni się wartość w wybranej kolumnie tabeli głównej
  // (np. miesiąc w tabeli dni – miesiące mają 28–31 stron, więc stały krok tu nie działa). Po wybraniu kolumny
  // pojawia się lista „albo kolumna” – kolejne kolumny, których zmiana też zaczyna nowy wiersz (np. rok obok miesiąca).
  // wybrane: kolumny do ustawienia (przy otwarciu okna); null – zostaje to, co jest wybrane w oknie.
  _ustawKiedy(wiersz, wybrane = null) {
    const sel = wiersz.querySelector('[data-pole="kiedy"]');
    const idGlownej = $('#dlg-seria form').elements.tabela.value || '';
    const glowna = this.projekt().tabele.find((t) => t.id === idGlownej);
    const kolumny = glowna?.kolumny || [];
    const klucz = `${idGlownej}|${kolumny.join('\n')}`;
    if (wiersz.dataset.glowna !== klucz) {
      const obecna = wybrane ? (wybrane[0] ? `k:${wybrane[0]}` : '') : sel.value;
      wiersz.dataset.glowna = klucz;
      sel.replaceChildren(new Option('co stałą liczbę stron', ''), ...kolumny.map((k) => new Option(`gdy zmieni się kolumna „${k}”`, `k:${k}`)));
      sel.value = [...sel.options].some((o) => o.value === obecna) ? obecna : '';
    }
    for (const pole of ['co', 'pierwszy']) wiersz.querySelector(`[data-pole="${pole}"]`).closest('label').hidden = Boolean(sel.value);
    // Kolejne kolumny: tyle list, ile wybranych kolumn, i jedna pusta na następną.
    const stare = [...wiersz.querySelectorAll('[data-pole="kiedy-wiecej"]')];
    const pierwsza = sel.value.startsWith('k:') ? sel.value.slice(2) : '';
    const dalsze = pierwsza ? [...new Set(wybrane ? wybrane.slice(1) : stare.map((x) => x.value))].filter((k) => k && k !== pierwsza && kolumny.includes(k)) : [];
    const wolne = kolumny.filter((k) => k !== pierwsza && !dalsze.includes(k));
    const uklad = pierwsza ? [...dalsze, ...(wolne.length ? [''] : [])] : [];
    const odcisk = `${klucz}|${pierwsza}|${uklad.join('\n')}`;
    if (wiersz.dataset.wiecej === odcisk) return;
    wiersz.dataset.wiecej = odcisk;
    const aktywna = stare.indexOf(document.activeElement);
    for (const x of stare) x.closest('label').remove();
    let po = sel.closest('label');
    const nowe = uklad.map((wartosc) => {
      const pole = document.createElement('label');
      pole.className = 'pole';
      pole.innerHTML = '<span>albo kolumna</span><select data-pole="kiedy-wiecej"></select>';
      const lista = pole.querySelector('select');
      lista.replaceChildren(new Option(wartosc ? '— usuń tę kolumnę —' : '— żadna więcej —', ''), ...[...(wartosc ? [wartosc] : []), ...wolne].map((k) => new Option(`„${k}”`, k)));
      lista.value = wartosc;
      po.after(pole);
      po = pole;
      return lista;
    });
    if (aktywna >= 0) (nowe[aktywna] || nowe.at(-1) || sel).focus();
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
    f.elements.dopelnij.checked = Boolean(seria.dopelnij);
    f.elements.pilnuj_stron.checked = Boolean(seria.pilnuj_stron);
    $('#seria-dodatkowe-lista').replaceChildren(...(seria.dodatkowe || []).map((d) => this._wierszDodatkowej(d)));
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
    for (const w of f.querySelectorAll('.wiersz-dodatkowej')) this._ustawKiedy(w);
    const dlugi = maTabele && f.elements.tryb.value === 'tabela' && f.elements.uklad.value === 'dlugi';
    $('#seria-pole-dopelnij').hidden = !dlugi;
    $('#seria-opis-konca').hidden = !dlugi || f.elements.dopelnij.checked;
    // Lewa i prawa strona: ustawienie jest tylko w projekcie, który ma sekcję z rozkładówkami.
    $('#seria-pole-strony').hidden = !p.sekcje.some((s) => s.uklad === 'rozkladowki');
    $('#seria-dodaj-tabele').disabled = p.tabele.filter((t) => t.id !== proba.tabela).length === 0;
    // Bilans liczony na kopii projektu z serią w wersji z formularza.
    const probny = { ...p, serie: p.serie.map((s) => (s.id === proba.id ? proba : s)) };
    const bilans = bilansSerii(probny, proba);
    $('#seria-podsumowanie').textContent = bloki.length
      ? bilans.map((b) => {
        const opis = b.pominietych
          ? `Blok ${b.dlugosc} ${odmiana(b.dlugosc, 'strony', 'stron', 'stron')}: w wydruku ${b.stron} ${odmiana(b.stron, 'strona', 'strony', 'stron')}. ${b.pominietych} ${odmiana(b.pominietych, 'wiersz tabeli jest pomijany', 'wiersze tabeli są pomijane', 'wierszy tabeli jest pomijanych')} (${ZNACZNIK_POMIJANIA}) – ${odmiana(b.pominietych, 'zajmuje', 'zajmują', 'zajmuje')} miejsce w bloku, ale ${odmiana(b.pominietych, 'jego strona', 'ich strony', 'ich strony')} nie ${odmiana(b.pominietych, 'powstaje', 'powstają', 'powstają')}.`
          : `Blok ${b.dlugosc} ${odmiana(b.dlugosc, 'strony', 'stron', 'stron')} × ${b.powielen} = ${b.stron} ${odmiana(b.stron, 'strona', 'strony', 'stron')} w wydruku.`;
        const koniec = (b.ostatniePelne ? '' : ' Seria kończy się na ostatnim wierszu danych – ostatnie powielenie bloku jest niepełne.')
          + (b.puste.length ? ` Do tego ${b.puste.length} ${odmiana(b.puste.length, 'pusta strona', 'puste strony', 'pustych stron')} (${odmiana(b.puste.length, 'strona', 'strony', 'strony')} ${b.puste.join(', ')}), żeby lewe strony zostały po lewej, a prawe po prawej.` : '')
          + (b.zamianaOd !== null ? ` Uwaga: od strony ${b.zamianaOd} strony bloku wychodzą po przeciwnej stronie rozkładówki – zaznacz „Pilnuj lewej i prawej strony”.` : '');
        const dodatkowe = b.dodatkowe.map((d) => ` Tabela „${d.tabela.nazwa}”: ${opisKroku(d)} – potrzeba ${d.potrzeba} ${odmiana(d.potrzeba, 'wiersza', 'wierszy', 'wierszy')}, ${d.jest >= d.potrzeba ? `jest ${d.jest}` : `a jest tylko ${d.jest}`}.`).join('');
        return opis + koniec + dodatkowe;
      }).join(' ')
      : 'Żadna strona nie należy jeszcze do tej serii.';
    const braki = bloki.length ? this.brakiSerii(proba, probny) : '';
    $('#seria-braki').hidden = !braki;
    $('#seria-braki').textContent = braki;
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
      dopelnij: f.elements.dopelnij.checked,
      pilnuj_stron: f.elements.pilnuj_stron.checked,
      dodatkowe: [...f.querySelectorAll('.wiersz-dodatkowej')].map((w) => {
        const co = Math.min(2000, Math.max(1, Math.round(Number(w.querySelector('[data-pole="co"]').value)) || 1));
        const pierwszy = Math.round(Number(w.querySelector('[data-pole="pierwszy"]').value));
        const kiedy = w.querySelector('[data-pole="kiedy"]')?.value || '';
        // Jedna kolumna to napis, kilka – lista (kolumna wybrana w liście „albo kolumna”).
        const zmiana = kiedy.startsWith('k:') ? zapisZmiany(kolumnyZmiany([kiedy.slice(2), ...[...w.querySelectorAll('[data-pole="kiedy-wiecej"]')].map((x) => x.value)])) : undefined;
        return { tabela: w.querySelector('select').value, co, ...(pierwszy >= 1 && pierwszy < co ? { pierwszy } : {}), ...(zmiana ? { zmiana } : {}) };
      }).filter((d) => d.tabela && d.tabela !== (f.elements.tabela.value || null)),
    };
  }

  _zdarzeniaSerii() {
    const dlg = $('#dlg-seria');
    const f = dlg.querySelector('form');
    f.addEventListener('input', () => this._odswiezSerie());
    f.addEventListener('change', () => this._odswiezSerie());
    $('#seria-dodaj-tabele').addEventListener('click', () => {
      const p = this.projekt();
      const { seria, proba } = this._seriaZOkna();
      const zajete = new Set([proba.tabela, ...proba.dodatkowe.map((d) => d.tabela)]);
      const wolna = p.tabele.find((t) => !zajete.has(t.id)) || p.tabele.find((t) => t.id !== proba.tabela);
      if (!wolna) return;
      // Domyślnie: nowy wiersz raz na powielenie bloku, a dla bloku jednej strony – co 7 stron (tydzień).
      const dlugosc = blokiSerii(p).find((b) => b.seria === seria)?.strony.length || 1;
      $('#seria-dodatkowe-lista').append(this._wierszDodatkowej({ tabela: wolna.id, co: dlugosc > 1 ? dlugosc : 7 }));
      this._odswiezSerie();
    });
    $('#seria-dodatkowe-lista').addEventListener('click', (e) => {
      if (!e.target.closest('[data-usun-dodatkowa]')) return;
      e.target.closest('.wiersz-dodatkowej').remove();
      this._odswiezSerie();
    });
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
        const blob = await doXlsx([{ nazwa: s.nazwa, wiersze: [s.kolumny, ...s.wiersze], listy: s.listy }, { nazwa: 'Instrukcja', wiersze: s.instrukcja }]);
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
