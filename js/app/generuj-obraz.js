// Okno „Generuj obraz (AI)” (#372, plan AI B2–B3) – w każdym projekcie. Opis po polsku → obraz z Gemini kluczem
// z sejfu (#241). Zaznaczony kształt, kadr albo obraz to ramka: proporcje z ramki, wynik trafia do niej; bez
// zaznaczenia – na środek strony. Przed generowaniem widać koszt (ok. … zł) i wydatki z miesiąca (z limitem); wynik
// zawsze w obrazach projektu z opisem, modelem i kosztem (pole zasobu `ai`) – „Jeszcze raz” jednym kliknięciem.

import { generujObraz, proporcjaRamki, blobZBase64 } from '../ai-obrazy.js';
import { JAKOSCI_OBRAZU, szacujObraz, kosztZUzycia, opisKosztu, wydatki, zapiszWydatek, wLimicie } from '../ai-koszty.js';
import { zadanie } from '../ai-dostawcy.js';
import { przyjmijPlik } from '../obrazy-projektu.js';
import { dataUrlZasobu } from '../zasoby.js';
import { otwartySejf } from './sejf-ai.js';
import { zaplanujZapis } from './zapis.js';
import { $, powiadom } from '../ui.js';
import { stan, edytor } from './kontekst.js';
import { t, biezacyJezyk } from '../jezyk.js';
import { menuPrzy } from './menu-przycisku.js';

// Dopisek do każdego opisu: obraz na całą ramkę (bez białych marginesów – pomiar C7 pokazał ramki wokół obrazu)
// i tekst zawsze w Makietce, nigdy w obrazie (plan komiksu – zasady).
export const BEZ_NAPISOW = 'Full-bleed picture that fills the whole canvas edge to edge – no border, no frame, no white margin. Do not draw any text, letters, words, numbers, shop signs, logos or captions anywhere in the image.';
// Poprawka istniejącego obrazu (plan AI B3): obraz idzie do modelu jako wzorzec, a opis to sama zmiana.
export const DOPISEK_POPRAWKI = 'Edit the attached image: apply only the change described above and keep everything else – composition, characters, colours, light and style – exactly the same.';
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
export async function generujIWstaw({ opis, jakosc = 'szkic', proporcja, cel = null, wzorce = [], styl = '', dopisek = '', potwierdzono = false, naStrone = true, poprawka = null }) {
  const { model, rozdzielczosc } = JAKOSCI_OBRAZU[jakosc] || JAKOSCI_OBRAZU.szkic;
  let opisZapisu = opis;
  if (poprawka) {
    // obraz do poprawy jako jedyny wzorzec; w obrazach projektu zostaje opis całości (pierwotny + zmiana)
    const m = /^data:([^;]+);base64,(.*)$/.exec(await dataUrlZasobu(stan.projekt, poprawka).catch(() => '') || '');
    if (!m) throw new Error(t('aiObraz.brakObrazu'));
    wzorce = [{ typ: m[1], dane: m[2] }];
    dopisek = DOPISEK_POPRAWKI;
    const baza = stan.projekt.zasoby[poprawka]?.ai?.opis;
    opisZapisu = baza ? `${baza.trim().replace(/[.!]?$/, '.')} ${opis.trim()}` : opis;
  }
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
  stan.projekt.zasoby[id].ai = { opis: opisZapisu, jakosc, model, proporcja, rozdzielczosc, styl, zl: Math.round(zl * 10000) / 10000, data: new Date().toISOString(), potwierdzono, ...(poprawka ? { poprawka: opis, z: poprawka } : {}) };
  if (naStrone) await wstaw(id, nazwa, cel);
  zaplanujZapis();
  return { id, nazwa, zl };
}

// Proporcje słowami (D2): „Pionowy (3:4)” zamiast samych liczb.
const nazwaProporcji = (p) => {
  const [a, b] = p.split(':').map(Number);
  const rodzaj = a === b ? 'kwadrat' : a < b ? (a / b < 0.6 ? 'wysoki' : 'pionowy') : (a / b > 1.7 ? 'szeroki' : 'poziomy');
  return `${t(`aiObraz.ksztalt_${rodzaj}`)} (${p})`;
};

export function oknoGenerowania({ opis = '', jakosc = 'szkic', tryb: trybStartowy = 'nowy' } = {}) {
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
    ${cel?.zasob ? `<fieldset class="tryb-ai" role="radiogroup"><legend class="ciche">${t('aiObraz.tryb')}</legend>
      <label class="znacznik"><input type="radio" name="tryb" value="nowy" checked><span>${t('aiObraz.trybNowy')}</span></label>
      <label class="znacznik"><input type="radio" name="tryb" value="popraw"><span>${t('aiObraz.trybPopraw')}</span></label></fieldset>` : ''}
    <label class="pole"><span>${t('aiObraz.coNaObrazie')}</span><textarea name="opis" rows="4" required></textarea></label>
    <div class="rzad"><label class="pole"><span>${t('aiObraz.jakosc')}</span><select name="jakosc">
      <option value="szkic">${t('aiObraz.jakoscSzkic')}</option><option value="dokladny">${t('aiObraz.jakoscDokladny')}</option><option value="pro">${t('aiObraz.jakoscPro')}</option></select></label>
    <label class="pole"><span>${t('aiObraz.proporcje')}</span><select name="proporcja">${opcjeProp.map((p) => `<option value="${p}"${p === prop ? ' selected' : ''}>${nazwaProporcji(p)}</option>`).join('')}</select></label></div>
    <p class="koszt-ai" aria-live="polite"></p>
    <p class="blad-ai" role="alert" hidden></p>
    <div class="przyciski-dialogu"><button class="przycisk" value="nie" type="button" data-rola="anuluj">${t('komiks.anuluj')}</button><button class="przycisk glowny" value="tak" type="submit">${t('aiObraz.generuj')}</button></div></form>`;
  const f = dlg.querySelector('form');
  f.elements.opis.value = opis;
  f.elements.opis.placeholder = t('aiObraz.przyklad');
  f.elements.jakosc.value = jakosc;
  const koszt = dlg.querySelector('.koszt-ai');
  const blad = dlg.querySelector('.blad-ai');
  const poprawiam = () => f.elements.tryb?.value === 'popraw';
  // „Popraw obecny obraz”: opis to sama zmiana; „Narysuj od nowa”: cały opis (wraca szkic z pola).
  const szkice = { nowy: opis, popraw: '' };
  let tryb = 'nowy';
  const radia = [...f.querySelectorAll('[name="tryb"]')];
  for (const r of radia) {
    r.addEventListener('change', () => {
      szkice[tryb] = f.elements.opis.value; tryb = r.value;
      f.elements.opis.value = szkice[tryb];
      f.elements.opis.placeholder = t(tryb === 'popraw' ? 'aiObraz.przykladPoprawki' : 'aiObraz.przyklad');
      policz(); f.elements.opis.focus();
    });
  }
  const policz = () => {
    const { model, rozdzielczosc } = JAKOSCI_OBRAZU[f.elements.jakosc.value];
    const zl = szacujObraz({ model, rozdzielczosc, znakiOpisu: f.elements.opis.value.length + 200, wzorce: poprawiam() ? 1 : 0 });
    const w = wydatki();
    koszt.textContent = t('aiObraz.koszt', { zl: opisKosztu(zl, biezacyJezyk()), miesiac: opisKosztu(w.zl, biezacyJezyk()) })
      + (w.limit ? ` ${t('aiObraz.limit', { limit: opisKosztu(w.limit, biezacyJezyk()) })}` : '');
    return zl;
  };
  const popraw = radia.find((r) => r.value === 'popraw');
  if (trybStartowy === 'popraw' && popraw) { popraw.checked = true; popraw.dispatchEvent(new Event('change')); }
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
      const w = await generujIWstaw({ opis: f.elements.opis.value, jakosc: f.elements.jakosc.value, proporcja: f.elements.proporcja.value, cel, potwierdzono: true, poprawka: poprawiam() ? cel.zasob : null });
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

// [AI ▾] (#377): jedno wejście do AI w każdym projekcie; w komiksie także kroki komiksu.
export async function menuAi() {
  const b = document.querySelector('[data-akcja="ai-menu"]');
  const { oknoTekstuAi } = await import('./tekst-ai.js');
  const komiks = document.body.classList.contains('w-komiksie');
  const k = komiks ? await import('./komiks-narzedzia.js') : null;
  const zObrazem = Boolean(ramka()?.zasob);
  const klik = (akcja) => document.querySelector(`[data-akcja="${akcja}"]`)?.click();
  menuPrzy(b, [
    { ikona: 'obraz', tekst: t('aiMenu.obraz'), opis: t('aiMenu.obrazOpis'), wartosc: 'obraz', wykonaj: () => oknoGenerowania() },
    ...(zObrazem ? [{ ikona: 'pioro', tekst: t('aiMenu.poprawObraz'), opis: t('aiMenu.poprawObrazOpis'), wartosc: 'popraw-obraz', wykonaj: () => oknoGenerowania({ tryb: 'popraw' }) }] : []),
    { ikona: 'tekst', tekst: t('aiMenu.tekst'), opis: t('aiMenu.tekstOpis'), wartosc: 'tekst', wykonaj: () => oknoTekstuAi() },
    { ikona: 'dane', tekst: t('aiMenu.kolumna'), opis: t('aiMenu.kolumnaOpis'), wartosc: 'kolumna', wykonaj: () => { klik('dane'); powiadom(t('aiMenu.kolumnaPodpowiedz')); } },
    ...(komiks ? ['-',
      { ikona: 'komiks', tekst: t('pasekNarzedzi.komiksScenariuszAi'), opis: t('aiMenu.scenariuszOpis'), wartosc: 'scenariusz', wykonaj: () => k.oknoScenariuszaAi() },
      { ikona: 'uzytkownik', tekst: t('aiMenu.wzorce'), opis: t('aiMenu.wzorceOpis'), wartosc: 'wzorce', wykonaj: () => k.obsluzAkcjeKomiksu('komiks-postacie') },
      { ikona: 'kadry', tekst: t('pasekNarzedzi.komiksRysuj'), opis: t('aiMenu.rysujOpis'), wartosc: 'rysuj', wykonaj: () => k.oknoRysujKadry() }] : []),
    '-',
    { ikona: 'komentarz', tekst: t('aiMenu.asystent'), opis: t('aiMenu.asystentOpis'), wartosc: 'asystent', wykonaj: () => klik('czat-ai') },
    { ikona: 'klucz', tekst: t('aiMenu.ustawienia'), opis: t('aiMenu.ustawieniaOpis'), wartosc: 'ustawienia', wykonaj: async () => (await import('./dostep-ai.js')).otworzDostepAi() },
  ]);
}
