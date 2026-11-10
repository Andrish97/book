// Menu „Widok” w rogu płótna: siatka, przyciąganie, linijki. Ustawienia należą
// do projektu (pole `widok`), więc idą razem z nim na inne urządzenia.

import { $ } from './ui.js';
import { normalizujWidok } from './projekt.js';

// widok: () => obiekt widoku bieżącego projektu; poZmianie(widok) – zastosuj i zapisz.
export class MenuWidoku {
  constructor({ widok, poZmianie }) {
    this.widok = widok;
    this.poZmianie = poZmianie;
    this.pola = {
      siatka: $('#widok-siatka'),
      do_siatki: $('#widok-do-siatki'),
      do_elementow: $('#widok-do-elementow'),
      linijki: $('#widok-linijki'),
      blokada_prowadnic: $('#widok-blokada-prowadnic'),
    };
    this.krok = $('#widok-krok');
    for (const [klucz, pole] of Object.entries(this.pola)) {
      pole.addEventListener('change', () => this.ustaw({ [klucz]: pole.checked }));
    }
    this.krok.addEventListener('change', () => {
      const v = Number(String(this.krok.value).replace(',', '.'));
      this.ustaw({ siatka_mm: v });
    });
  }

  // Zmienia ustawienia (także ze skrótów klawiszowych) i odświeża pola menu.
  ustaw(zmiany) {
    const w = this.widok();
    if (!w) return;
    Object.assign(w, normalizujWidok({ ...w, ...zmiany }));
    // Przyciąganie do siatki bez widocznej siatki myli – włączamy ją razem z nim.
    if (zmiany.do_siatki) w.siatka = true;
    this.odswiez();
    this.poZmianie(w);
  }

  przelacz(klucz) {
    const w = this.widok();
    if (w) this.ustaw({ [klucz]: !w[klucz] });
  }

  odswiez() {
    const w = this.widok();
    if (!w) return;
    for (const [klucz, pole] of Object.entries(this.pola)) pole.checked = Boolean(w[klucz]);
    this.krok.value = String(w.siatka_mm).replace('.', ',');
  }
}
