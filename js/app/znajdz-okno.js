// Okno „Znajdź i zamień” (#131C): Ctrl+F / Ctrl+H, paleta poleceń, menu ⋯. Na komputerze panel obok strony
// (zostaje otwarty, można klikać trafienia), na telefonie zasłonka. Szukanie i zamiana – js/znajdz.js.
// „Zamień wszystkie” to jeden krok cofania.

import { $, powiadom } from '../ui.js';
import { przedDlugaCzynnoscia } from '../postep.js';
import { szukaj, zamien } from '../znajdz.js';
import { edytor, stan } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { przejdzDoStrony, renderujListe } from './lista-stron.js';
import { edytujWzorzec } from './wzorce.js';
import { t as tt } from '../jezyk.js';

const dlg = $('#dlg-znajdz');
const pole = $('#znajdz-fraza');
const zamiennik = $('#znajdz-zamien');
const lista = $('#znajdz-lista');
const licznik = $('#znajdz-licznik');
let trafienia = [];
let wybrane = -1;
let timer = null;

const naKomputerze = () => window.matchMedia('(pointer: fine)').matches && window.innerWidth > 860;
const opcje = () => ({
  wielkosc: $('#znajdz-wielkosc').checked,
  slowa: $('#znajdz-slowa').checked,
  dane: $('#znajdz-dane').checked,
  style: $('#znajdz-style').checked,
});

function pokaz() {
  const fraza = pole.value;
  if (stan.projekt && edytor.wydruk) zapiszBiezacyCel(); // to, co na płótnie, też ma być znalezione
  trafienia = fraza ? szukaj(stan.projekt, fraza, opcje()) : [];
  if (wybrane >= trafienia.length) wybrane = trafienia.length - 1;
  licznik.textContent = !fraza ? '' : trafienia.length ? `${trafienia.length} ${trafienia.length === 1 ? 'wynik' : trafienia.length % 10 >= 2 && trafienia.length % 10 <= 4 && (trafienia.length % 100 < 12 || trafienia.length % 100 > 14) ? 'wyniki' : 'wyników'}` : tt('znajdzOkno.brakWynikow');
  lista.replaceChildren(...trafienia.slice(0, 300).map((t, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `trafienie${i === wybrane ? ' wybrane' : ''}`;
    b.dataset.i = String(i);
    const gdzie = document.createElement('small');
    gdzie.textContent = t.nazwaCelu;
    const tekst = document.createElement('span');
    const mark = document.createElement('mark');
    mark.textContent = t.trafienie;
    tekst.append(t.przed, mark, t.po);
    b.append(gdzie, tekst);
    li.append(b);
    return li;
  }));
  $('#znajdz-zamien-jedno').disabled = !trafienia.length;
  $('#znajdz-zamien-wszystkie').disabled = !trafienia.length;
}

async function idzDo(i) {
  const t = trafienia[i];
  if (!t) return;
  wybrane = i;
  for (const b of lista.querySelectorAll('.trafienie')) b.classList.toggle('wybrane', Number(b.dataset.i) === i);
  if (t.gdzie === 'strona') {
    if (stan.tryb !== 'strona' || stan.projekt.strony[stan.indeks]?.id !== t.cel) await przejdzDoStrony(t.indeksStrony);
  } else if (t.gdzie === 'wzorzec') {
    if (stan.tryb !== 'wzorzec' || stan.idWzorca !== t.cel) await edytujWzorzec(t.cel);
  } else {
    if (t.gdzie === 'dane') powiadom(`W danych: ${t.nazwaCelu}. Otwórz okno „Dane”, żeby zobaczyć komórkę.`);
    return;
  }
  edytor.zaznacz(t.element);
  const obj = edytor.aktywny;
  // Zaznaczony fragment: tekst w trybie pisania (na komputerze – na telefonie samo zaznaczenie elementu).
  if (obj?.type === 'textbox' && naKomputerze() && obj.text === t.tekst) {
    obj.enterEditing();
    obj.selectionStart = t.start;
    obj.selectionEnd = t.koniec;
    obj._updateTextarea?.();
    edytor.canvas.requestRenderAll();
    pole.focus({ preventScroll: true });
  }
}

async function zamienTrafienia(lista2) {
  if (!lista2.length || !stan.projekt) return;
  if (edytor.aktywny?.isEditing) edytor.aktywny.exitEditing();
  zapiszBiezacyCel();
  const zaznaczony = edytor.aktywny?.id;
  let zm = null;
  await przedDlugaCzynnoscia(`Zamiana ${lista2.length} wystąpień…`, lista2.length > 60, async () => {
    zm = zamien(stan.projekt, lista2, zamiennik.value);
    if (!zm.liczba) return;
    stan.miniatury.clear();
    await zaladujCel();
  });
  if (!zm.liczba) { powiadom(tt('znajdzOkno.tekstZmienilSieW')); pokaz(); return; }
  if (zaznaczony) edytor.zaznacz(zaznaczony);
  renderujListe();
  zaplanujZapis();
  powiadom(`Zamieniono: ${zm.liczba}.`);
  pokaz();
}

export function otworzZnajdz({ zamiana = false } = {}) {
  if (!stan.projekt) return;
  // Zaznaczony fragment pisanego tekstu od razu trafia do pola szukania.
  const akt = edytor.aktywny;
  if (akt?.isEditing && akt.selectionEnd > akt.selectionStart) pole.value = akt.text.slice(akt.selectionStart, akt.selectionEnd).slice(0, 200);
  dlg.classList.toggle('z-zamiana', zamiana || Boolean(zamiennik.value));
  if (!dlg.open) {
    dlg.classList.toggle('obok-strony', naKomputerze());
    if (naKomputerze()) dlg.show(); else dlg.showModal();
  }
  wybrane = -1;
  pokaz();
  (zamiana && pole.value ? zamiennik : pole).focus();
  (zamiana && pole.value ? zamiennik : pole).select?.();
}

pole.addEventListener('input', () => { clearTimeout(timer); wybrane = -1; timer = setTimeout(pokaz, 180); });
pole.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (trafienia.length) idzDo((wybrane + (e.shiftKey ? -1 : 1) + trafienia.length) % trafienia.length);
});
for (const id of ['#znajdz-wielkosc', '#znajdz-slowa', '#znajdz-dane', '#znajdz-style']) $(id).addEventListener('change', pokaz);
lista.addEventListener('click', (e) => {
  const b = e.target.closest('.trafienie');
  if (b) idzDo(Number(b.dataset.i));
});
$('#znajdz-pokaz-zamiane').addEventListener('click', () => { dlg.classList.add('z-zamiana'); zamiennik.focus(); });
$('#znajdz-zamien-jedno').addEventListener('click', () => zamienTrafienia([trafienia[Math.max(0, wybrane)]].filter(Boolean)));
$('#znajdz-zamien-wszystkie').addEventListener('click', () => zamienTrafienia(trafienia));
$('#znajdz-zamknij').addEventListener('click', () => dlg.close());
dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.matches(':modal')) { e.preventDefault(); dlg.close(); } });
