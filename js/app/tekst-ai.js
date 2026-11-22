// Okno „Tekst AI” (#373, plan AI B4): zaznaczona ramka tekstu (albo zaznaczony fragment w trakcie pisania) →
// skróć, wydłuż, prościej, uroczyściej, popraw błędy, przetłumacz na polski / angielski / ukraiński. Wynik najpierw
// w podglądzie – [Zastąp] wstawia go w miejsce tekstu (jeden krok cofania). Koszt – ułamki grosza, w liczniku AI.

import { przerobTekst, wypelnijKolumne, CZYNNOSCI } from '../ai-tekst.js';
import { MODEL_TEKSTU, kosztZUzycia, szacujTekst, opisKosztu, zapiszWydatek, wLimicie, wydatki } from '../ai-koszty.js';
import { zadanie } from '../ai-dostawcy.js';
import { otwartySejf } from './sejf-ai.js';
import { zaplanujZapis } from './zapis.js';
import { $, powiadom } from '../ui.js';
import { stan, edytor } from './kontekst.js';
import { t, biezacyJezyk } from '../jezyk.js';

const tekstowy = (o) => o && ['textbox', 'i-text', 'text'].includes(o.type) && !o.zWzorca;

export async function przerobIZwroc({ czynnosc, tekst }) {
  const zl0 = szacujTekst({ znakiWe: tekst.length + 400, znakiWy: tekst.length * 1.6 });
  if (!wLimicie(zl0)) throw new Error(t('aiObraz.ponadLimit', { limit: opisKosztu(wydatki().limit) }));
  const klucz = (await otwartySejf())?.klucz('gemini');
  if (!klucz) throw new Error(t('aiObraz.brakKlucza'));
  const w = await przerobTekst({ klucz, model: MODEL_TEKSTU, fetchJson: zadanie, czynnosc, tekst });
  const zl = kosztZUzycia(MODEL_TEKSTU, w.uzycie) ?? zl0;
  zapiszWydatek(zl, { projekt: stan.projekt, model: MODEL_TEKSTU, rodzaj: 'tekst' });
  return { ...w, zl };
}

export function oknoTekstuAi() {
  const o = edytor.canvas?.getActiveObject();
  if (!tekstowy(o)) { powiadom(t('aiTekst.zaznaczTekst'), true); return; }
  // fragment zaznaczony w trakcie pisania – tylko on; inaczej cały tekst ramki
  const fragment = o.isEditing && o.selectionEnd > o.selectionStart ? [o.selectionStart, o.selectionEnd] : null;
  const zrodlo = fragment ? o.text.slice(...fragment) : o.text;
  let dlg = $('#dlg-ai-tekst');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-ai-tekst'; document.body.append(dlg); }
  const przyciski = Object.keys(CZYNNOSCI).map((c) => `<button type="button" class="przycisk" data-czynnosc="${c}">${t(`aiTekst.${c}`)}</button>`).join('');
  dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${t('aiTekst.tytul')}</h2>
    <p class="ciche">${t(fragment ? 'aiTekst.opisFragment' : 'aiTekst.opisRamka')}</p>
    <div class="czynnosci-ai">${przyciski}</div>
    <label class="pole"><span>${t('aiTekst.wynik')}</span><textarea name="wynik" rows="6" readonly></textarea></label>
    <p class="koszt-ai" aria-live="polite"></p><p class="blad-ai" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" type="button" data-rola="anuluj">${t('komiks.anuluj')}</button><button class="przycisk glowny" type="submit" value="tak" disabled>${t('aiTekst.zastap')}</button></div></form>`;
  const f = dlg.querySelector('form');
  const wynik = f.elements.wynik;
  const blad = dlg.querySelector('.blad-ai');
  const koszt = dlg.querySelector('.koszt-ai');
  const zastap = f.querySelector('button[value="tak"]');
  koszt.textContent = t('aiTekst.koszt', { zl: opisKosztu(szacujTekst({ znakiWe: zrodlo.length + 400, znakiWy: zrodlo.length * 1.6 }), biezacyJezyk()) });
  wynik.placeholder = t('aiTekst.wybierz');
  for (const b of dlg.querySelectorAll('[data-czynnosc]')) {
    b.onclick = async () => {
      for (const x of dlg.querySelectorAll('[data-czynnosc]')) { x.disabled = true; x.setAttribute('aria-pressed', String(x === b)); }
      blad.hidden = true; wynik.value = ''; wynik.placeholder = t('aiTekst.trwa');
      try {
        const w = await przerobIZwroc({ czynnosc: b.dataset.czynnosc, tekst: zrodlo });
        wynik.value = w.tekst; wynik.readOnly = false; zastap.disabled = false;
        koszt.textContent = t('aiTekst.kosztPo', { zl: opisKosztu(w.zl, biezacyJezyk()) });
      } catch (er) { blad.textContent = er.message; blad.hidden = false; wynik.placeholder = t('aiTekst.wybierz'); } finally { for (const x of dlg.querySelectorAll('[data-czynnosc]')) x.disabled = false; }
    };
  }
  dlg.querySelector('[data-rola="anuluj"]').onclick = () => dlg.close('nie');
  f.onsubmit = (e) => {
    e.preventDefault();
    const nowy = wynik.value;
    if (!nowy.trim()) return;
    if (fragment) {
      if (o.isEditing) o.exitEditing();
      o.removeChars(fragment[0], fragment[1]);
      o.insertChars(nowy, null, fragment[0], fragment[0]);
    } else o.set({ text: nowy, styles: {} });
    o.initDimensions?.(); o.dirty = true; o.setCoords();
    edytor.canvas.requestRenderAll();
    edytor.oznaczZmiane?.();
    zaplanujZapis();
    dlg.close('tak');
    powiadom(t('aiTekst.zastapiono'));
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------- Wypełnij kolumnę tabeli (#373) – przycisk ✦ przy nazwie kolumny w oknie Dane ----------
export function oknoKolumnyAi(tabela, k) {
  const kolumna = tabela.kolumny[k];
  let dlg = $('#dlg-ai-kolumna');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-ai-kolumna'; document.body.append(dlg); }
  dlg.innerHTML = `<form method="dialog" class="formularz"><h2></h2><p class="ciche">${t('aiKolumna.opis')}</p>
    <label class="pole"><span>${t('aiKolumna.coWpisac')}</span><textarea name="polecenie" rows="3" required></textarea></label>
    <label class="przelacznik szeroki"><input type="checkbox" name="puste" checked><span>${t('aiKolumna.tylkoPuste')}</span></label>
    <p class="koszt-ai" aria-live="polite"></p><p class="blad-ai" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" type="button" data-rola="anuluj">${t('komiks.anuluj')}</button><button class="przycisk glowny" type="submit" value="tak">${t('aiKolumna.wypelnij')}</button></div></form>`;
  dlg.querySelector('h2').textContent = t('aiKolumna.tytul', { kolumna });
  const f = dlg.querySelector('form');
  f.elements.polecenie.placeholder = t('aiKolumna.przyklad');
  const blad = dlg.querySelector('.blad-ai');
  const ktore = () => tabela.wiersze.map((w, i) => i).filter((i) => !f.elements.puste.checked || !String(tabela.wiersze[i][k] ?? '').trim());
  const policz = () => {
    const n = ktore().length;
    const znaki = JSON.stringify(tabela.wiersze.slice(0, 50)).length / Math.max(1, Math.min(50, tabela.wiersze.length)) * n;
    dlg.querySelector('.koszt-ai').textContent = t('aiKolumna.koszt', { n, zl: opisKosztu(szacujTekst({ znakiWe: znaki + 600, znakiWy: n * 120 }), biezacyJezyk()) });
  };
  f.elements.puste.onchange = policz;
  policz();
  dlg.querySelector('[data-rola="anuluj"]').onclick = () => dlg.close('nie');
  return new Promise((ok) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const nr = ktore();
      if (!nr.length) { blad.textContent = t('aiKolumna.brakPustych'); blad.hidden = false; return; }
      const przycisk = f.querySelector('button[value="tak"]');
      przycisk.disabled = true; przycisk.textContent = t('aiTekst.trwa'); blad.hidden = true;
      try {
        const klucz = (await otwartySejf())?.klucz('gemini');
        if (!klucz) throw new Error(t('aiObraz.brakKlucza'));
        const wynik = [];
        let zl = 0;
        for (let i = 0; i < nr.length; i += 100) { // paczki po 100 wierszy
          const czesc = nr.slice(i, i + 100);
          const w = await wypelnijKolumne({ klucz, model: MODEL_TEKSTU, fetchJson: zadanie, polecenie: f.elements.polecenie.value, kolumny: tabela.kolumny, wiersze: czesc.map((r) => tabela.wiersze[r]), kolumna });
          wynik.push(...w.wartosci);
          zl += kosztZUzycia(MODEL_TEKSTU, w.uzycie) || 0;
        }
        nr.forEach((r, i) => { tabela.wiersze[r][k] = wynik[i]; });
        zapiszWydatek(zl, { projekt: stan.projekt, model: MODEL_TEKSTU, rodzaj: 'kolumna' });
        dlg.close('tak');
        powiadom(t('aiKolumna.gotowe', { n: nr.length, zl: opisKosztu(zl, biezacyJezyk()) }));
        ok(true);
      } catch (er) { blad.textContent = er.message; blad.hidden = false; } finally { przycisk.disabled = false; przycisk.textContent = t('aiKolumna.wypelnij'); }
    };
    dlg.addEventListener('close', () => { if (dlg.returnValue !== 'tak') ok(false); }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
