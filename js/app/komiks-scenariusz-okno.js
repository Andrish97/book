// Okno „Scenariusz” (#378, uwagi D6 i D10): scenariusz bez arkusza – strony, w nich kadry (ujęcie, miejsce, kto jest
// w kadrze, co widać), w kadrach kwestie (kto mówi, rodzaj dymka, tekst). Postacie i miejsca wybiera się z kart
// (js/postacie.js), ujęcia z listy. Zapis do tej samej tabeli (js/komiks-scenariusz.js) – dymki, rysowanie kadrów, AI
// i okno Dane (dla zaawansowanych) widzą to samo.

import { scenariuszZTabeli, scenariuszDoTabeli, nazwyUjec, nazwyEmocji } from '../komiks-scenariusz.js';
import { karty } from '../postacie.js';
import { $, powiadom } from '../ui.js';
import { ikona } from '../ikony.js';
import { stan } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { t, biezacyJezyk } from '../jezyk.js';
import * as K from './komiks-narzedzia.js';

const RODZAJE = ['mowa', 'mysl', 'krzyk', 'szept', 'narracja'];
const el = (tag, wl = {}, ...dzieci) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(wl)) { if (k === 'tekst') e.textContent = v; else if (k === 'value') e.value = v; else e.setAttribute(k, v); }
  e.append(...dzieci.filter((d) => d != null && d !== false));
  return e;
};
const wybor = (nazwa, opcje, wartosc, etykieta) => {
  const s = el('select', { name: nazwa, 'aria-label': etykieta });
  for (const [v, tekst] of opcje) s.append(el('option', { value: v, tekst }));
  if (wartosc && !opcje.some(([v]) => v === wartosc)) s.append(el('option', { value: wartosc, tekst: wartosc })); // wartość spoza listy zostaje
  s.value = wartosc || '';
  return s;
};
const przycisk = (tekst, ikonaN, fn, klasa = 'przycisk maly') => {
  const b = el('button', { type: 'button', class: klasa });
  b.innerHTML = `${ikona(ikonaN, { rozmiar: 16 })}<span></span>`;
  b.querySelector('span').textContent = tekst;
  b.addEventListener('click', fn);
  return b;
};

export async function oknoScenariusza() {
  if (!K.wKomiksie()) return;
  zapiszBiezacyCel();
  const tb = K.scenariuszProjektu() || await K.otworzScenariusz({ bezOkna: true });
  let strony = scenariuszZTabeli(tb);
  if (!strony.length) strony = [{ nr: 1, kadry: [{ nr: 1, ujecie: '', miejsce: '', wKadrze: [], gra: [], rekwizyty: [], opis: '', kwestie: [] }] }];
  const postacie = karty(stan.projekt, 'postacie').map((k) => k.imie);
  const miejsca = karty(stan.projekt, 'miejsca').map((k) => k.nazwa);
  const rekwizyty = karty(stan.projekt, 'rekwizyty').map((k) => k.nazwa);
  const ujecia = nazwyUjec(biezacyJezyk());
  const emocje = nazwyEmocji(biezacyJezyk());
  let dlg = $('#dlg-scenariusz');
  if (!dlg) { dlg = el('dialog', { id: 'dlg-scenariusz', class: 'okno-scenariusza' }); document.body.append(dlg); }
  const lista = el('div', { class: 'strony-scenariusza' });

  const rysuj = () => {
    lista.replaceChildren();
    for (const s of strony) {
      const sekcja = el('section', { class: 'strona-scenariusza', 'data-strona': String(s.nr) }, el('h3', { tekst: t('scenariusz.strona', { nr: s.nr }) }));
      for (const k of s.kadry) {
        const kadr = el('div', { class: 'kadr-scenariusza', 'data-kadr': String(k.nr) });
        const usunKadr = przycisk('', 'kosz', () => { s.kadry = s.kadry.filter((x) => x !== k); s.kadry.forEach((x, i) => { x.nr = i + 1; }); if (!s.kadry.length) strony = strony.filter((x) => x !== s); rysuj(); }, 'przycisk-ikona maly');
        usunKadr.setAttribute('aria-label', t('scenariusz.usunKadr', { nr: k.nr }));
        usunKadr.title = t('scenariusz.usunKadr', { nr: k.nr });
        const u = wybor('ujecie', [['', t('scenariusz.ujecieDowolne')], ...ujecia.map((x) => [x, x])], k.ujecie, t('scenariusz.ujecie'));
        u.addEventListener('change', () => { k.ujecie = u.value; });
        const m = wybor('miejsce', [['', t('scenariusz.miejsceBrak')], ...miejsca.map((x) => [x, x])], k.miejsce, t('scenariusz.miejsce'));
        m.addEventListener('change', () => { k.miejsce = m.value; });
        const opis = el('input', { type: 'text', name: 'opis', placeholder: t('scenariusz.opisPrzyklad'), 'aria-label': t('scenariusz.coWidac') });
        opis.value = k.opis;
        opis.addEventListener('input', () => { k.opis = opis.value; });
        // Postacie w kadrze (uwaga E3): kto jest widoczny (także bez kwestii) i – przy każdej obecnej – emocja i co robi.
        k.gra ||= [];
        const bezOgonkow = (x) => x.toLowerCase();
        const mowi = (imie) => k.kwestie.some((q) => bezOgonkow(q.postac || '') === bezOgonkow(imie));
        const jest = (imie) => mowi(imie) || k.wKadrze.some((x) => bezOgonkow(x) === bezOgonkow(imie));
        const graPostaci = (imie) => {
          let g = k.gra.find((x) => bezOgonkow(x.imie) === bezOgonkow(imie));
          if (!g) { g = { imie, emocja: '', robi: '' }; k.gra.push(g); }
          return g;
        };
        const wKadrze = el('div', { class: 'w-kadrze', role: 'group', 'aria-label': t('scenariusz.wKadrze') }, el('span', { class: 'ciche', tekst: `${t('scenariusz.wKadrze')}:` }));
        for (const imie of postacie) {
          const wiersz = el('div', { class: 'postac-w-kadrze' });
          const c = el('input', { type: 'checkbox', value: imie });
          c.checked = jest(imie);
          if (mowi(imie)) { c.disabled = true; c.title = t('scenariusz.mowiJestWKadrze'); }
          c.addEventListener('change', () => { k.wKadrze = c.checked ? [...k.wKadrze, imie] : k.wKadrze.filter((x) => bezOgonkow(x) !== bezOgonkow(imie)); rysuj(); });
          wiersz.append(el('label', { class: 'znacznik' }, c, el('span', { tekst: imie })));
          if (jest(imie)) {
            const g = graPostaci(imie);
            const em = wybor('emocja', [['', t('scenariusz.emocjaBrak')], ...emocje.map((x) => [x, x])], g.emocja, t('scenariusz.emocja', { imie }));
            em.addEventListener('change', () => { g.emocja = em.value; });
            const robi = el('input', { type: 'text', name: 'robi', placeholder: t('scenariusz.robiPrzyklad'), 'aria-label': t('scenariusz.robi', { imie }) });
            robi.value = g.robi;
            robi.addEventListener('input', () => { g.robi = robi.value; });
            wiersz.append(em, robi);
          }
          wKadrze.append(wiersz);
        }
        // Rekwizyty w kadrze (F6) – z kart rekwizytów.
        k.rekwizyty ||= [];
        const rzeczy = el('div', { class: 'w-kadrze rekwizyty-w-kadrze', role: 'group', 'aria-label': t('scenariusz.rekwizyty') }, el('span', { class: 'ciche', tekst: `${t('scenariusz.rekwizyty')}:` }));
        const chipy = el('div', { class: 'chipy-rekwizytow' });
        for (const nazwa of rekwizyty) {
          const c = el('input', { type: 'checkbox', value: nazwa });
          c.checked = k.rekwizyty.some((x) => x.toLowerCase() === nazwa.toLowerCase());
          c.addEventListener('change', () => { k.rekwizyty = c.checked ? [...k.rekwizyty, nazwa] : k.rekwizyty.filter((x) => x.toLowerCase() !== nazwa.toLowerCase()); });
          chipy.append(el('label', { class: 'znacznik' }, c, el('span', { tekst: nazwa })));
        }
        rzeczy.append(chipy);
        const kwestie = el('div', { class: 'kwestie' });
        for (const q of k.kwestie) {
          const kto = wybor('postac', [['', t('komiks.rodzaj_narracja')], ...postacie.map((x) => [x, x])], q.postac, t('scenariusz.kto'));
          const rodzaj = wybor('rodzaj', RODZAJE.map((r) => [r, t(`komiks.rodzaj_${r}`)]), q.rodzaj || 'mowa', t('scenariusz.rodzaj'));
          kto.addEventListener('change', () => { q.postac = kto.value; if (!kto.value) { q.rodzaj = 'narracja'; rodzaj.value = 'narracja'; } else if (q.rodzaj === 'narracja') { q.rodzaj = 'mowa'; rodzaj.value = 'mowa'; } });
          rodzaj.addEventListener('change', () => { q.rodzaj = rodzaj.value; });
          rodzaj.classList.toggle('bez-rodzaju', !q.postac); // narracja – bez wyboru rodzaju dymka (miejsce w siatce zostaje)
          kto.addEventListener('change', () => { rodzaj.classList.toggle('bez-rodzaju', !kto.value); rysuj(); });
          const tekst = el('input', { type: 'text', name: 'tekst', placeholder: t('scenariusz.tekstPrzyklad'), 'aria-label': t('scenariusz.tekst') });
          tekst.value = q.tekst;
          tekst.addEventListener('input', () => { q.tekst = tekst.value; });
          const usun = przycisk('', 'kosz', () => { k.kwestie = k.kwestie.filter((x) => x !== q); rysuj(); }, 'przycisk-ikona maly');
          usun.setAttribute('aria-label', t('scenariusz.usunKwestie'));
          usun.title = t('scenariusz.usunKwestie');
          kwestie.append(el('div', { class: 'kwestia' }, kto, rodzaj, tekst, usun));
        }
        kadr.append(
          el('div', { class: 'naglowek-kadru' }, el('b', { tekst: t('komiks.kadrNr', { nr: k.nr }) }), u, m, usunKadr),
          el('label', { class: 'pole opis-kadru' }, el('span', { tekst: t('scenariusz.coWidac') }), opis),
          postacie.length ? wKadrze : null,
          rekwizyty.length ? rzeczy : null,
          kwestie,
          przycisk(t('scenariusz.dodajKwestie'), 'plus', () => { k.kwestie.push({ postac: postacie[0] || '', tekst: '', rodzaj: postacie.length ? 'mowa' : 'narracja' }); rysuj(); lista.querySelector(`[data-strona="${s.nr}"] [data-kadr="${k.nr}"] .kwestia:last-child input`)?.focus(); }),
        );
        sekcja.append(kadr);
      }
      sekcja.append(przycisk(t('scenariusz.dodajKadr'), 'kadry', () => { s.kadry.push({ nr: s.kadry.length + 1, ujecie: '', miejsce: '', wKadrze: [], gra: [], rekwizyty: [], opis: '', kwestie: [] }); rysuj(); }));
      lista.append(sekcja);
    }
    lista.append(przycisk(t('scenariusz.dodajStrone'), 'strony', () => {
      const nr = (strony.at(-1)?.nr || 0) + 1;
      strony.push({ nr, kadry: [{ nr: 1, ujecie: '', miejsce: '', wKadrze: [], gra: [], rekwizyty: [], opis: '', kwestie: [] }] });
      rysuj();
    }, 'przycisk'));
  };
  rysuj();

  const zapisz = async () => {
    // emocje i działania tylko postaci, które są w kadrze
    const b = (x) => String(x || '').toLowerCase();
    for (const s of strony) for (const k of s.kadry) k.gra = (k.gra || []).filter((g) => k.kwestie.some((q) => b(q.postac) === b(g.imie)) || k.wKadrze.some((x) => b(x) === b(g.imie)));
    scenariuszDoTabeli(tb, strony);
    zaplanujZapis();
    await zaladujCel();
  };
  const f = el('form', { method: 'dialog', class: 'formularz' },
    el('h2', { tekst: t('scenariusz.tytul') }),
    el('p', { class: 'ciche', tekst: postacie.length ? t('scenariusz.opis') : t('scenariusz.opisBezPostaci') }),
    lista,
    el('div', { class: 'przyciski-dialogu' },
      przycisk(t('scenariusz.tabela'), 'tabela', async () => { await zapisz(); dlg.close('tabela'); K.otworzScenariusz(); }, 'przycisk'),
      el('button', { class: 'przycisk', value: 'nie', type: 'button', 'data-rola': 'anuluj', tekst: t('komiks.anuluj') }),
      el('button', { class: 'przycisk glowny', value: 'tak', type: 'submit', tekst: t('scenariusz.zapisz') })));
  f.querySelector('[data-rola="anuluj"]').addEventListener('click', () => dlg.close('nie'));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    await zapisz();
    dlg.close('tak');
    powiadom(t('scenariusz.zapisano'));
  });
  dlg.replaceChildren(f);
  dlg.returnValue = '';
  dlg.showModal();
}
