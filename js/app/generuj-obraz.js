// Okno „Generuj obraz (AI)” (#372, plan AI B2–B3) – w każdym projekcie. Opis po polsku → obraz z Gemini kluczem
// z sejfu (#241). Zaznaczony kształt, kadr albo obraz to ramka: proporcje z ramki, wynik trafia do niej; bez
// zaznaczenia – na środek strony. Przed generowaniem widać koszt (ok. … zł) i wydatki z miesiąca (z limitem); wynik
// zawsze w obrazach projektu z opisem, modelem i kosztem (pole zasobu `ai`) – „Jeszcze raz” jednym kliknięciem.

import { generujObraz, proporcjaRamki, blobZBase64 } from '../ai-obrazy.js';
import { JAKOSCI_OBRAZU, szacujObraz, kosztZUzycia, opisKosztu, wydatki, zapiszWydatek, wLimicie } from '../ai-koszty.js';
import { zadanie } from '../ai-dostawcy.js';
import { przyjmijPlik } from '../obrazy-projektu.js';
import { otwartySejf } from './sejf-ai.js';
import { zaplanujZapis } from './zapis.js';
import { $, powiadom } from '../ui.js';
import { stan, edytor } from './kontekst.js';
import { t, biezacyJezyk } from '../jezyk.js';

// Dopisek do każdego opisu: obraz na całą ramkę (bez białych marginesów – pomiar C7 pokazał ramki wokół obrazu)
// i tekst zawsze w Makietce, nigdy w obrazie (plan komiksu – zasady).
export const BEZ_NAPISOW = 'Full-bleed picture that fills the whole canvas edge to edge – no border, no frame, no white margin. Do not draw any text, letters, words, numbers, shop signs, logos or captions anywhere in the image.';
export const pelnyOpis = (opis, { styl = '', dopisek = '' } = {}) => [opis.trim(), styl && `Style: ${styl}.`, dopisek, BEZ_NAPISOW].filter(Boolean).join(' ');

// Ramka dla obrazu: zaznaczony kształt (także kadr komiksu) albo obraz; inaczej null.
function ramka() {
  const o = edytor.canvas?.getActiveObject();
  if (!o || o.type === 'activeselection' || o.zWzorca) return null;
  if (o.type === 'image' || edytor.moznaWstawicObraz(o)) return o;
  return null;
}

// Wstawienie wygenerowanego obrazu: do ramki (kształt/kadr), w miejsce obrazu albo na środek strony.
async function wstaw(id, nazwa, cel) {
  if (cel?.type === 'image') return edytor.podmienObraz(cel, stan.projekt.zasoby[id].dataUrl, nazwa, stan.projekt.zasoby, { id });
  if (cel && edytor.moznaWstawicObraz(cel)) return edytor.wstawObrazDoKsztaltu(cel, id);
  return edytor.dodajObraz(null, nazwa, stan.projekt.zasoby, { id });
}

// Generowanie z gotowych ustawień (okno, „Jeszcze raz”, czat, komiks). naStrone=false – tylko do obrazów projektu
// (np. obraz wzorcowy karty postaci). Zwraca { id, nazwa, zl }.
export async function generujIWstaw({ opis, jakosc = 'szkic', proporcja, cel = null, wzorce = [], styl = '', dopisek = '', potwierdzono = false, naStrone = true }) {
  const { model, rozdzielczosc } = JAKOSCI_OBRAZU[jakosc] || JAKOSCI_OBRAZU.szkic;
  const szac = szacujObraz({ model, rozdzielczosc, znakiOpisu: opis.length + 200, wzorce: wzorce.length });
  if (!wLimicie(szac)) throw new Error(t('aiObraz.ponadLimit', { limit: opisKosztu(wydatki().limit) }));
  const sejf = await otwartySejf();
  const klucz = sejf?.klucz('gemini');
  if (!klucz) throw new Error(t('aiObraz.brakKlucza'));
  const w = await generujObraz({ klucz, model, fetchJson: zadanie, opis: pelnyOpis(opis, { styl, dopisek }), proporcja, rozdzielczosc, wzorce });
  const zl = kosztZUzycia(model, w.uzycie) ?? szac;
  zapiszWydatek(zl, { projekt: stan.projekt, model, rodzaj: 'obraz' });
  const roz = w.typ.includes('jpeg') ? 'jpg' : (w.typ.split('/')[1] || 'png');
  const slowa = opis.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'obraz';
  const { id, nazwa } = await przyjmijPlik(stan.projekt, blobZBase64(w.dane, w.typ), `ai-${slowa}.${roz}`);
  stan.projekt.zasoby[id].ai = { opis, jakosc, model, proporcja, rozdzielczosc, styl, zl: Math.round(zl * 10000) / 10000, data: new Date().toISOString(), potwierdzono };
  if (naStrone) await wstaw(id, nazwa, cel);
  zaplanujZapis();
  return { id, nazwa, zl };
}

export function oknoGenerowania({ opis = '', jakosc = 'szkic' } = {}) {
  if (!stan.projekt || !edytor.canvas) return;
  const cel = ramka();
  // Ramka z obrazem z AI: opis i jakość poprzedniego obrazu – „jeszcze raz” albo poprawka opisu.
  const poprzedni = cel?.zasob ? stan.projekt.zasoby[cel.zasob]?.ai : null;
  if (poprzedni && !opis) { opis = poprzedni.opis || ''; jakosc = poprzedni.jakosc || jakosc; }
  const prop = cel ? proporcjaRamki(cel.width * cel.scaleX, cel.height * cel.scaleY) : '3:4';
  let dlg = $('#dlg-ai-obraz');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-ai-obraz'; document.body.append(dlg); }
  const opcjeProp = ['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9'];
  if (!opcjeProp.includes(prop)) opcjeProp.push(prop);
  dlg.innerHTML = `<form method="dialog" class="formularz"><h2>${t('aiObraz.tytul')}</h2>
    <p class="ciche">${t(cel ? 'aiObraz.opisRamka' : 'aiObraz.opisStrona')}${poprzedni ? ` ${t('aiObraz.poprzedni')}` : ''}</p>
    <label class="pole"><span>${t('aiObraz.coNaObrazie')}</span><textarea name="opis" rows="4" required></textarea></label>
    <div class="rzad"><label class="pole"><span>${t('aiObraz.jakosc')}</span><select name="jakosc">
      <option value="szkic">${t('aiObraz.jakoscSzkic')}</option><option value="dokladny">${t('aiObraz.jakoscDokladny')}</option><option value="pro">${t('aiObraz.jakoscPro')}</option></select></label>
    <label class="pole"><span>${t('aiObraz.proporcje')}</span><select name="proporcja">${opcjeProp.map((p) => `<option${p === prop ? ' selected' : ''}>${p}</option>`).join('')}</select></label></div>
    <p class="koszt-ai" aria-live="polite"></p>
    <p class="blad-ai" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" value="nie" type="button" data-rola="anuluj">${t('komiks.anuluj')}</button><button class="przycisk glowny" value="tak" type="submit">${t('aiObraz.generuj')}</button></div></form>`;
  const f = dlg.querySelector('form');
  f.elements.opis.value = opis;
  f.elements.opis.placeholder = t('aiObraz.przyklad');
  f.elements.jakosc.value = jakosc;
  const koszt = dlg.querySelector('.koszt-ai');
  const blad = dlg.querySelector('.blad-ai');
  const policz = () => {
    const { model, rozdzielczosc } = JAKOSCI_OBRAZU[f.elements.jakosc.value];
    const zl = szacujObraz({ model, rozdzielczosc, znakiOpisu: f.elements.opis.value.length + 200 });
    const w = wydatki();
    koszt.textContent = t('aiObraz.koszt', { zl: opisKosztu(zl, biezacyJezyk()), miesiac: opisKosztu(w.zl, biezacyJezyk()) })
      + (w.limit ? ` ${t('aiObraz.limit', { limit: opisKosztu(w.limit, biezacyJezyk()) })}` : '');
    return zl;
  };
  f.elements.jakosc.addEventListener('change', policz);
  f.elements.opis.addEventListener('input', policz);
  policz();
  dlg.querySelector('[data-rola="anuluj"]').onclick = () => dlg.close('nie');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const przycisk = f.querySelector('button[value="tak"]');
    przycisk.disabled = true; przycisk.textContent = t('aiObraz.trwa');
    blad.hidden = true;
    try {
      const w = await generujIWstaw({ opis: f.elements.opis.value, jakosc: f.elements.jakosc.value, proporcja: f.elements.proporcja.value, cel, potwierdzono: true });
      dlg.close('tak');
      powiadom(t('aiObraz.gotowe', { zl: opisKosztu(w.zl, biezacyJezyk()) }));
    } catch (er) {
      blad.textContent = er.message; blad.hidden = false;
    } finally { przycisk.disabled = false; przycisk.textContent = t('aiObraz.generuj'); }
  };
  dlg.returnValue = '';
  dlg.showModal();
  f.elements.opis.focus();
}
