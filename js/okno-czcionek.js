// Okno „Czcionki”: własne pliki czcionek projektu i lista czcionek wbudowanych.

import { $, powiadom, potwierdz, odmiana } from './ui.js';
import { uid } from './projekt.js';
import { wstawIkony } from './ikony.js';
import {
  CZCIONKI, ROZSZERZENIA_CZCIONEK, dodajCzcionkiDoProjektu, zarejestrujCzcionkiProjektu, nazwaOdmiany, uzyteCzcionki,
} from './czcionki.js';

export class OknoCzcionek {
  // projekt() → bieżący projekt; przedZmiana() – płótno oddaje treść do projektu;
  // poZmianie(rodzina) – zapis i ponowne wczytanie strony (tekst trzeba zmierzyć od nowa).
  constructor({ projekt, przedZmiana, poZmianie }) {
    this.zrodlo = { projekt, przedZmiana, poZmianie };
    this.okno = $('#dlg-czcionki');
    this.plik = $('#pliki-czcionki');
    this.plik.accept = ROZSZERZENIA_CZCIONEK.map((r) => `.${r}`).join(',');
    $('#czcionki-zamknij').addEventListener('click', () => this.okno.close());
    $('#czcionki-wgraj').addEventListener('click', () => this.wybierzPliki());
    this.plik.addEventListener('change', async (e) => { const pliki = [...e.target.files]; e.target.value = ''; await this.dodaj(pliki); });
    $('#czcionki-wlasne').addEventListener('click', (e) => { const b = e.target.closest('[data-usun]'); if (b) this.usun(b.dataset.usun); });
    $('#czcionki-wlasne').addEventListener('change', (e) => { const i = e.target.closest('input[data-rodzina]'); if (i) this.zmienRodzine(i.dataset.rodzina, i.value); });
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
    $('#czcionki-wbudowane').textContent = `${CZCIONKI.map((c) => c.nazwa).join(', ')}. Wszystkie na licencji SIL Open Font License – wolno ich używać w druku komercyjnym.`;
    wstawIkony(this.okno);
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
  }

  // Poprawka nazwy rodziny (gdy plik nie podaje jej dobrze). Teksty z dawną nazwą przechodzą na nową.
  async zmienRodzine(id, nazwa) {
    const p = this.zrodlo.projekt();
    const c = p.czcionki.find((x) => x.id === id);
    const nowa = nazwa.replace(/["{}]/g, '').trim();
    if (!c || !nowa || nowa === c.rodzina) { this.rysuj(); return; }
    this.zrodlo.przedZmiana();
    const stara = c.rodzina;
    c.rodzina = nowa;
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
  }
}
