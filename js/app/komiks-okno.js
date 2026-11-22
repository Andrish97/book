// Okno „Komiks” (#377, uwagi D9–D10): cały komiks krok po kroku w jednym miejscu – 1. Historia (scenariusz ręcznie
// albo z AI), 2. Postacie i miejsca (karty, styl), 3. Kadry i obrazy (układ, rysowanie z AI, gotowe strony),
// 4. Dymki (ze scenariusza), 5. Gotowe (podgląd, PDF, webtoon). Przy każdym kroku krótki stan – co już jest. Okno
// zamyka się przed otwarciem okna kroku (jedno okno naraz).

import { karty } from '../postacie.js';
import { adresZasobu } from '../zasoby.js';
import { poNazwie } from '../obrazy-projektu.js';
import { STYL_DOMYSLNY } from '../komiks-ai.js';
import { $ } from '../ui.js';
import { ikona } from '../ikony.js';
import { stan, edytor } from './kontekst.js';
import { t } from '../jezyk.js';
import * as K from './komiks-narzedzia.js';
import { oknoPostaci } from './komiks-postacie.js';
import { oknoScenariusza } from './komiks-scenariusz-okno.js';

const el = (tag, wl = {}, ...dzieci) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(wl)) { if (k === 'tekst') e.textContent = v; else e.setAttribute(k, v); }
  e.append(...dzieci.filter(Boolean));
  return e;
};

// Stan komiksu do opisu kroków.
export function stanKomiksu(p = stan.projekt) {
  const tb = K.scenariuszProjektu();
  const iTekst = tb ? tb.kolumny.findIndex((k) => /^(tekst|text|текст)/i.test(k)) : -1;
  const wiersze = tb ? tb.wiersze.filter((w) => String(w[iTekst] ?? '').trim()) : [];
  const strony = K.stronyKomiksu(p);
  const kadry = strony.flatMap((s) => (s.obiekty || []).filter((o) => o.kadr_nr != null));
  const zObrazem = kadry.filter((o) => o.zasob).length + strony.filter((s) => (s.obiekty || []).some((o) => o.type === 'image')).length;
  const dymki = strony.reduce((a, s) => a + (s.obiekty || []).filter((o) => o.dymek).length, 0);
  const stronScen = tb ? new Set(tb.wiersze.map((w) => w[0]).filter(Boolean)).size : 0;
  return { kwestii: wiersze.length, stronScen, postacie: karty(p, 'postacie'), miejsca: karty(p, 'miejsca'), stron: strony.length, kadrow: kadry.length, zObrazem, dymki, styl: p.komiks_ai?.styl || STYL_DOMYSLNY };
}

function miniatury(lista) {
  const w = el('span', { class: 'miniatury-komiksu' });
  for (const k of lista.slice(0, 6)) {
    const id = k.obraz ? poNazwie(stan.projekt, k.obraz) : null;
    const a = id ? adresZasobu(stan.projekt.zasoby[id]) : null;
    const m = a ? el('img', { src: a, alt: '' }) : el('span', { class: 'bez-obrazu', 'aria-hidden': 'true', tekst: (k.imie || k.nazwa || '?').slice(0, 1) });
    m.title = k.imie || k.nazwa;
    w.append(m);
  }
  return w;
}

export function oknoKomiksu() {
  if (!K.wKomiksie()) return;
  let dlg = $('#dlg-komiks');
  if (!dlg) { dlg = el('dialog', { id: 'dlg-komiks', class: 'okno-komiksu' }); document.body.append(dlg); }
  const s = stanKomiksu();
  const krok = (nr, tytul, opis, stanTekst, przyciski, dodatek = null) => {
    const li = el('li', { class: 'krok-komiksu', 'data-krok': String(nr) },
      el('span', { class: 'nr-kroku', 'aria-hidden': 'true', tekst: String(nr) }),
      el('div', { class: 'tresc-kroku' }, el('h3', { tekst: tytul }), el('p', { class: 'ciche', tekst: opis }), stanTekst ? el('p', { class: 'stan-kroku', tekst: stanTekst }) : null, dodatek,
        el('div', { class: 'przyciski-kroku' }, ...przyciski.map(([tekst, ikonaN, fn, glowny, akcja]) => {
          const b = el('button', { type: 'button', class: `przycisk${glowny ? ' glowny' : ''}`, 'data-krok-akcja': akcja });
          b.innerHTML = `${ikona(ikonaN)}<span></span>`;
          b.querySelector('span').textContent = tekst;
          b.addEventListener('click', () => { dlg.close(); fn(); });
          return b;
        }))));
    return li;
  };
  const lista = el('ol', { class: 'kroki-komiksu' },
    krok(1, t('komiksOkno.historia'), t('komiksOkno.historiaOpis'),
      s.kwestii ? t('komiksOkno.historiaStan', { kwestii: s.kwestii, stron: s.stronScen }) : t('komiksOkno.historiaBrak'),
      [[t('komiksOkno.scenariusz'), 'tabela', () => oknoScenariusza(), !s.kwestii, 'scenariusz'], [t('komiksOkno.scenariuszAi'), 'iskry', () => K.oknoScenariuszaAi(), false, 'scenariusz-ai']]),
    krok(2, t('komiksOkno.postacie'), t('komiksOkno.postacieOpis'),
      s.postacie.length || s.miejsca.length ? t('komiksOkno.postacieStan', { postaci: s.postacie.length, miejsc: s.miejsca.length, styl: t(`komiks.styl_${s.styl}`) }) : t('komiksOkno.postacieBrak'),
      [[t('komiksOkno.postacieOtworz'), 'uzytkownik', () => oknoPostaci(), false, 'postacie']], miniatury([...s.postacie, ...s.miejsca])),
    krok(3, t('komiksOkno.obrazy'), t('komiksOkno.obrazyOpis'),
      t('komiksOkno.obrazyStan', { zObrazem: s.zObrazem, kadrow: s.kadrow, stron: s.stron }),
      [[t('komiksOkno.uklad'), 'kadry', () => K.oknoKadrow(), false, 'kadry'], [t('komiksOkno.rysuj'), 'iskry', () => K.oknoRysujKadry(), false, 'rysuj'], [t('komiksOkno.wgraj'), 'obraz', () => K.wybierzStrony(), false, 'wgraj']]),
    krok(4, t('komiksOkno.dymki'), t('komiksOkno.dymkiOpis'),
      s.dymki ? t('komiksOkno.dymkiStan', { dymki: s.dymki }) : t('komiksOkno.dymkiBrak'),
      [[t('komiks.ustawDymki'), 'dymek', () => K.ustawDymkiZWyborem(), Boolean(s.kwestii) && !s.dymki, 'dymki']]),
    krok(5, t('komiksOkno.gotowe'), t('komiksOkno.gotoweOpis'), '',
      [[t('komiksOkno.podglad'), 'oko', () => document.querySelector('[data-akcja="podglad"]')?.click(), false, 'podglad'], [t('komiksOkno.pdf'), 'pdf', () => document.querySelector('[data-akcja="pdf"]')?.click(), false, 'pdf'], [t('pasekNarzedzi.komiksWebtoon'), 'pobierz', () => K.eksportWebtoon(), false, 'webtoon']]),
  );
  const f = el('form', { method: 'dialog', class: 'formularz' }, el('h2', { tekst: t('komiksOkno.tytul') }), el('p', { class: 'ciche', tekst: t('komiksOkno.opis') }), lista,
    el('div', { class: 'przyciski-dialogu' }, el('button', { class: 'przycisk glowny', value: 'zamknij', tekst: t('komiks.gotowe') })));
  dlg.replaceChildren(f);
  edytor.canvas?.discardActiveObject();
  dlg.returnValue = '';
  dlg.showModal();
}
