// Sekcje: okno ustawień (format, spad, marginesy, układ, numeracja, okładka liczona sama #119, składki #120),
// kolejność i usuwanie.

import { FORMATY, nowaSekcja, nowaStrona, uporzadkujStrony } from '../projekt.js';
import { rozwin } from '../serie.js';
import {
  PAPIERY, STREFY, normalizujOkladke, domyslnaOkladka, geometriaOkladki, jestOkladka, przeliczOkladki,
  normalizujSkladke, bilansSkladki, opisSkladki,
} from '../okladka.js';
import { $, $$, powiadom, potwierdz } from '../ui.js';
import { stan, biezacaSekcja, tenSamRozmiar, liczba, edytor, biezacaStrona } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';
import { ustawZakladke, przelejPoZmianieKolejnosci } from './lista-stron.js';

// ---------- Sekcje ----------

// Dialog ustawień sekcji. id === null → nowa sekcja.
export function otworzUstawieniaSekcji(id) {
  const dlg = $('#dlg-sekcja');
  const f = dlg.querySelector('form');
  const { projekt } = stan;
  const istniejaca = projekt.sekcje.find((s) => s.id === id);
  const wzor = istniejaca || biezacaSekcja();
  const w = wzor.wydruk;
  dlg.dataset.id = id || '';
  $('#tytul-sekcji').textContent = istniejaca ? 'Ustawienia sekcji' : 'Nowa sekcja';
  $('#zapisz-sekcje').textContent = istniejaca ? 'Zapisz' : 'Dodaj sekcję';
  f.elements.nazwa.value = istniejaca ? istniejaca.nazwa : `Sekcja ${projekt.sekcje.length + 1}`;
  f.elements.uklad.value = wzor.uklad;
  f.elements.pierwsza.value = wzor.pierwsza;
  const sel = f.elements.format;
  sel.replaceChildren();
  for (const [nazwa, [sz, wy]] of Object.entries(FORMATY)) sel.add(new Option(`${nazwa} (${sz} × ${wy} mm)`, nazwa));
  sel.add(new Option('Własny', 'wlasny'));
  sel.value = FORMATY[w.format] ? w.format : 'wlasny';
  f.elements.szerokosc_mm.value = w.szerokosc_mm;
  f.elements.wysokosc_mm.value = w.wysokosc_mm;
  f.elements.spad_mm.value = w.spad_mm;
  for (const k of ['gora', 'dol', 'wewnetrzny', 'zewnetrzny']) f.elements[`margines_${k}`].value = w.marginesy[k];
  f.elements.znaki_ciecia.checked = Boolean(w.znaki_ciecia);
  // Siatka linii bazowych (#131): domyślnie odstęp interlinii tekstu podstawowego (10,5 pt × 1,35) od górnego marginesu.
  const sb = w.siatka_bazowa;
  f.elements.siatka_bazowa.checked = Boolean(sb);
  f.elements.siatka_odstep.value = sb?.odstep ?? 5;
  f.elements.siatka_przesuniecie.value = sb?.przesuniecie ?? w.marginesy.gora;
  $('#siatka-bazowa-liczby').hidden = !sb;
  const num = (istniejaca || { numeracja: { tryb: 'ciagla', od: 1 } }).numeracja;
  f.elements.numeracja.value = num.tryb;
  f.elements.numeracja_od.value = num.od;
  f.elements.skladka.value = String(normalizujSkladke(istniejaca?.skladka));
  wypelnijOkladke(f, istniejaca, otworzUstawieniaSekcji.jakoOkladka);
  otworzUstawieniaSekcji.jakoOkladka = false;

  const lista = $('#sekcja-wzorce');
  lista.replaceChildren();
  $('#sekcja-wzorce-pole').hidden = projekt.wzorce.length === 0;
  const wybrane = new Set(istniejaca ? istniejaca.wzorce : []);
  for (const x of projekt.wzorce) {
    const label = document.createElement('label');
    label.className = 'przelacznik';
    label.innerHTML = '<input type="checkbox" name="wzorce"><span></span>';
    $('input', label).value = x.id;
    $('input', label).checked = wybrane.has(x.id);
    $('span', label).textContent = tenSamRozmiar(x.wydruk, w) ? x.nazwa : `${x.nazwa} (inny rozmiar)`;
    lista.append(label);
  }
  odswiezPolaSekcji();
  dlg.returnValue = '';
  dlg.showModal();
  f.elements.nazwa.focus();
}

// Etykiety marginesów i pola zależne od układu oraz numeracji.
function odswiezPolaSekcji() {
  const f = $('#dlg-sekcja form');
  const rozkladowki = f.elements.uklad.value === 'rozkladowki';
  $('#etykieta-wewnetrzny').textContent = rozkladowki ? 'Wewnętrzny' : 'Lewy';
  $('#etykieta-zewnetrzny').textContent = rozkladowki ? 'Zewnętrzny' : 'Prawy';
  $('#pole-pierwsza').hidden = !rozkladowki;
  $('#podpowiedz-rozkladowki').hidden = !rozkladowki;
  $('#pole-numeracja-od').hidden = f.elements.numeracja.value !== 'od';
  const okladka = f.elements.rodzaj.value === 'okladka';
  $('#sekcja-okladka').hidden = !okladka;
  $('#sekcja-format').hidden = okladka;
  $('#pole-uklad-sekcji').hidden = okladka;
  $('#pole-skladka').hidden = okladka;
  $('#opis-skladki').hidden = okladka;
  if (okladka) {
    $('#etykieta-wewnetrzny').textContent = 'Przy grzbiecie';
    $('#etykieta-zewnetrzny').textContent = 'Zewnętrzny';
    $('#pole-pierwsza').hidden = true;
    $('#podpowiedz-rozkladowki').hidden = true;
  }
  const papier = f.elements.ok_papier.value;
  $('#pole-ok-gramatura').hidden = papier !== 'gramatura';
  $('#pole-ok-grubosc').hidden = papier !== 'grubosc';
  $('#pole-ok-twarda').hidden = f.elements.ok_oprawa.value !== 'twarda';
  // Wymiary (#125): grzbiet do wpisania (bez zeszytowej), przy „Wpisz rozmiar” także szerokość i wysokość.
  const wymiary = f.elements.ok_wymiary.value;
  const zeszyt = f.elements.ok_oprawa.value === 'zeszytowa';
  $('#pole-ok-wymiary').hidden = wymiary === 'auto' || (wymiary === 'grzbiet' && zeszyt);
  $('#pole-ok-grzbiet').hidden = zeszyt;
  $('#pole-ok-szerokosc').hidden = wymiary !== 'rozmiar';
  $('#pole-ok-wysokosc').hidden = wymiary !== 'rozmiar';
  $('#pole-ok-grzbiet span').textContent = wymiary === 'rozmiar' ? 'Grzbiet (mm, puste – liczony)' : 'Grzbiet (mm)';
  f.elements.ok_liczba.disabled = f.elements.ok_strony.value !== 'reczne';
  rysujSchemat();
  if (okladka) rysujOkladke(); else opiszSkladke();
}
$('#dlg-sekcja form').addEventListener('change', (e) => {
  if (['uklad', 'numeracja', 'rodzaj', 'ok_papier', 'ok_oprawa', 'ok_strony', 'ok_wymiary', 'skladka'].includes(e.target.name)) {
    // Przejście na wpisane wymiary: pola dostają bieżące, liczone wartości – do poprawienia, nie od zera.
    if (e.target.name === 'ok_wymiary') {
      const f = e.target.form;
      const g = podgladOkladki(f);
      if (g) {
        if (!Number(f.elements.ok_grzbiet.value)) f.elements.ok_grzbiet.value = e.target.value === 'rozmiar' ? '' : g.liczone.grzbiet;
        if (!Number(f.elements.ok_szerokosc.value)) f.elements.ok_szerokosc.value = g.liczone.szerokosc;
        if (!Number(f.elements.ok_wysokosc.value)) f.elements.ok_wysokosc.value = g.liczone.wysokosc;
      }
    }
    odswiezPolaSekcji();
  }
  else if (e.target.name === 'ok_srodek') rysujOkladke();
});

// Schemat strony przy marginesach (#109): kartka w proporcjach formatu, pole tekstu wewnątrz marginesów,
// przerywana ramka spadu. Rysowany na bieżąco przy pisaniu liczb.
function rysujSchemat() {
  const f = $('#dlg-sekcja form');
  const el = $('#schemat-marginesow');
  const n = (k) => Math.max(0, Number(String(f.elements[k].value).replace(',', '.')) || 0);
  const sz = n('szerokosc_mm') || 148;
  const wy = n('wysokosc_mm') || 210;
  const spad = Math.min(n('spad_mm'), 20);
  // Spad na schemacie trochę powiększony, żeby był widoczny także przy 3 mm.
  const spadWidok = spad ? Math.max(spad, Math.min(sz, wy) * 0.04) : 0;
  const pelnaSz = sz + 2 * spadWidok;
  const pelnaWy = wy + 2 * spadWidok;
  el.style.setProperty('--sz', String(pelnaSz));
  el.style.setProperty('--wy', String(pelnaWy));
  el.style.setProperty('--spad-x', `${(spadWidok / pelnaSz) * 100}%`);
  el.style.setProperty('--spad-y', `${(spadWidok / pelnaWy) * 100}%`);
  const proc = (mm, bok) => `${Math.min(45, (mm / bok) * 100)}%`;
  el.style.setProperty('--m-gora', proc(n('margines_gora'), wy));
  el.style.setProperty('--m-dol', proc(n('margines_dol'), wy));
  el.style.setProperty('--m-lewy', proc(n('margines_wewnetrzny'), sz));
  el.style.setProperty('--m-prawy', proc(n('margines_zewnetrzny'), sz));
  el.classList.toggle('rozkladowki', f.elements.uklad.value === 'rozkladowki');
  el.classList.toggle('bez-spadu', !spad);
}
$('#dlg-sekcja form').addEventListener('input', (e) => {
  if (/^(margines_|spad_mm|szerokosc_mm|wysokosc_mm)/.test(e.target.name || '')) rysujSchemat();
});

function wykryjFormat(sz, wy) {
  for (const [nazwa, [a, b]] of Object.entries(FORMATY)) {
    if ((a === sz && b === wy) || (a === wy && b === sz)) return nazwa;
  }
  return 'wlasny';
}

// ---------- Okładka (#119) ----------

// Pola okładki w oknie z parametrów sekcji (albo domyślnych dla nowej okładki).
function wypelnijOkladke(f, sekcja, jakoOkladka = false) {
  const o = normalizujOkladke(sekcja?.okladka) || domyslnaOkladka();
  f.elements.rodzaj.value = sekcja?.okladka || jakoOkladka ? 'okladka' : 'strony';
  f.elements.ok_oprawa.value = o.oprawa;
  f.elements.ok_strony.value = o.strony.tryb;
  f.elements.ok_papier.value = o.papier.tryb;
  f.elements.ok_gramatura.value = o.papier.gramatura;
  f.elements.ok_grubosc.value = o.papier.grubosc_mm;
  const rodzaj = f.elements.ok_rodzaj;
  rodzaj.replaceChildren(...Object.entries(PAPIERY).map(([k, p]) => new Option(p.nazwa, k)));
  rodzaj.value = o.papier.rodzaj;
  f.elements.ok_zawiniecie.value = o.zawiniecie_mm;
  f.elements.ok_big.value = o.big_mm;
  f.elements.ok_naddatek.value = o.naddatek_mm;
  f.elements.ok_tektura.value = o.tektura_mm;
  f.elements.ok_wymiary.value = o.wymiary.tryb;
  f.elements.ok_grzbiet.value = o.wymiary.grzbiet_mm || '';
  f.elements.ok_szerokosc.value = o.wymiary.szerokosc_mm || '';
  f.elements.ok_wysokosc.value = o.wymiary.wysokosc_mm || '';
  // Sekcje środka: wybór tylko wtedy, gdy jest z czego wybierać.
  const kandydaci = stan.projekt.sekcje.filter((s) => s !== sekcja && !jestOkladka(s));
  $('#ok-srodek').replaceChildren(...kandydaci.map((s) => {
    const label = document.createElement('label');
    label.className = 'przelacznik';
    label.innerHTML = '<input type="checkbox" name="ok_srodek"><span></span>';
    $('input', label).value = s.id;
    $('input', label).checked = !o.srodek || o.srodek.includes(s.id);
    $('span', label).textContent = s.nazwa;
    return label;
  }));
  $('#pole-ok-srodek').hidden = kandydaci.length < 2;
  f.elements.ok_liczba.value = o.strony.tryb === 'reczne' ? o.strony.liczba : (podgladOkladki(f)?.stron ?? 0);
}

// Parametry okładki z pól okna.
function okladkaZPol(f) {
  const n = (k) => Number(String(f.elements[k].value).replace(',', '.'));
  const pola = $$('input[name="ok_srodek"]', f);
  const wybrane = pola.filter((i) => i.checked).map((i) => i.value);
  return normalizujOkladke({
    oprawa: f.elements.ok_oprawa.value,
    srodek: pola.length > 1 && wybrane.length < pola.length ? wybrane : null,
    strony: { tryb: f.elements.ok_strony.value, liczba: n('ok_liczba') },
    papier: { tryb: f.elements.ok_papier.value, gramatura: n('ok_gramatura'), grubosc_mm: n('ok_grubosc'), rodzaj: f.elements.ok_rodzaj.value },
    zawiniecie_mm: n('ok_zawiniecie'), big_mm: n('ok_big'), naddatek_mm: n('ok_naddatek'), tektura_mm: n('ok_tektura'),
    wymiary: { tryb: f.elements.ok_wymiary.value, grzbiet_mm: n('ok_grzbiet'), szerokosc_mm: n('ok_szerokosc'), wysokosc_mm: n('ok_wysokosc') },
  });
}

// Geometria okładki dla bieżących pól okna (bez zmiany projektu).
function podgladOkladki(f) {
  if (!stan.projekt) return null;
  const id = $('#dlg-sekcja').dataset.id;
  const istniejaca = stan.projekt.sekcje.find((s) => s.id === id);
  const sekcja = { ...(istniejaca || { id: '__nowa__' }), okladka: okladkaZPol(f) };
  const sekcje = istniejaca ? stan.projekt.sekcje.map((s) => (s === istniejaca ? sekcja : s)) : [sekcja, ...stan.projekt.sekcje];
  return geometriaOkladki({ ...stan.projekt, sekcje }, sekcja, rozwin(stan.projekt));
}

// Schemat okładki: strefy w proporcjach, podpisane, i wynik („Grzbiet 6,6 mm · Okładka 346,6 × 240 mm”).
function rysujOkladke() {
  const f = $('#dlg-sekcja form');
  const g = podgladOkladki(f);
  if (!g) return;
  if (f.elements.ok_strony.value !== 'reczne') f.elements.ok_liczba.value = g.stron;
  const el = $('#schemat-okladki');
  el.style.setProperty('--proporcja', `${g.szerokosc} / ${g.wysokosc}`);
  el.replaceChildren(...g.strefy.map((z) => {
    const d = document.createElement('div');
    d.className = `strefa-okladki strefa-${z.rodzaj.replace(/_[lp]$/, '')}`;
    d.style.left = `${(z.x1 / g.szerokosc) * 100}%`;
    d.style.width = `${((z.x2 - z.x1) / g.szerokosc) * 100}%`;
    if (!z.rodzaj.startsWith('zawiniecie')) {
      d.style.top = `${(g.gora / g.wysokosc) * 100}%`;
      d.style.bottom = `${((g.wysokosc - g.dol) / g.wysokosc) * 100}%`;
    }
    if (['tyl', 'przod', 'grzbiet'].includes(z.rodzaj)) {
      const opis = document.createElement('span');
      opis.textContent = STREFY[z.rodzaj];
      d.append(opis);
    }
    d.title = `${STREFY[z.rodzaj]}: ${liczba(z.x2 - z.x1)} mm`;
    return d;
  }));
  const zeszyt = g.oprawa === 'zeszytowa';
  const b = document.createElement('strong');
  b.textContent = `${zeszyt ? 'Bez grzbietu' : `Grzbiet ${liczba(g.grzbiet)} mm`} · Okładka ${liczba(g.szerokosc)} × ${liczba(g.wysokosc)} mm`;
  const m = document.createElement('small');
  m.textContent = `Środek: ${g.stron} stron (${g.kartek} kartek × ${String(g.kartka_mm).replace('.', ',')} mm), strona ${liczba(g.strona.sz)} × ${liczba(g.strona.wy)} mm.`
    + (zeszyt && g.stron % 4 ? ' Oprawa zeszytowa potrzebuje liczby stron podzielnej przez 4.' : '');
  $('#wynik-okladki').replaceChildren(b, m);
  // Podpowiedź przy wpisanych wymiarach: co wychodzi z papieru i formatu środka.
  const liczone = $('#ok-liczone');
  liczone.hidden = g.tryb === 'auto';
  if (g.tryb !== 'auto') {
    liczone.textContent = `Z papieru i formatu środka wychodzi: ${zeszyt ? 'bez grzbietu' : `grzbiet ${liczba(g.liczone.grzbiet)} mm`}, okładka ${liczba(g.liczone.szerokosc)} × ${liczba(g.liczone.wysokosc)} mm.`
      + (g.tryb === 'rozmiar' ? ' Tył i przód dzielą resztę szerokości po równo wokół grzbietu.' : '');
  }
}
$('#sekcja-okladka').addEventListener('input', () => rysujOkladke());

// Składki (#120): opis pod listą – ile stron jest, ile brakuje do pełnej składki.
function opiszSkladke() {
  const f = $('#dlg-sekcja form');
  const sekcja = stan.projekt?.sekcje.find((s) => s.id === $('#dlg-sekcja').dataset.id);
  const skladka = normalizujSkladke(f.elements.skladka.value);
  let tekst = '';
  if (skladka && sekcja) tekst = `${opisSkladki(bilansSkladki({ ...sekcja, skladka }, rozwin(stan.projekt)))}.`;
  else if (skladka) tekst = `Sekcja będzie pilnować liczby stron: wielokrotność ${skladka}.`;
  $('#opis-skladki').textContent = tekst;
}

async function zatwierdzSekcje() {
  const dlg = $('#dlg-sekcja');
  const f = dlg.querySelector('form');
  const mm = (n) => Math.max(0, parseFloat(String(f.elements[n].value).replace(',', '.')) || 0);
  const sz = Math.max(20, mm('szerokosc_mm'));
  const wy = Math.max(20, mm('wysokosc_mm'));
  const wydruk = {
    format: wykryjFormat(sz, wy),
    szerokosc_mm: sz,
    wysokosc_mm: wy,
    spad_mm: mm('spad_mm'),
    marginesy: {
      gora: Math.min(mm('margines_gora'), wy / 2 - 1),
      dol: Math.min(mm('margines_dol'), wy / 2 - 1),
      wewnetrzny: Math.min(mm('margines_wewnetrzny'), sz / 2 - 1),
      zewnetrzny: Math.min(mm('margines_zewnetrzny'), sz / 2 - 1),
    },
    znaki_ciecia: f.elements.znaki_ciecia.checked,
    siatka_bazowa: f.elements.siatka_bazowa.checked
      ? { odstep: Math.min(50, Math.max(1, mm('siatka_odstep') || 5)), przesuniecie: Math.min(wy, mm('siatka_przesuniecie')) }
      : null,
  };
  const ustawienia = {
    nazwa: f.elements.nazwa.value.trim() || 'Sekcja',
    wydruk,
    uklad: f.elements.uklad.value === 'rozkladowki' ? 'rozkladowki' : 'pojedyncze',
    pierwsza: f.elements.pierwsza.value === 'lewa' ? 'lewa' : 'prawa',
    wzorce: $$('input[name="wzorce"]:checked', f).map((i) => i.value),
    numeracja: { tryb: f.elements.numeracja.value, od: Math.max(0, Math.round(mm('numeracja_od'))) },
  };
  const okladka = f.elements.rodzaj.value === 'okladka';
  const poprzednia = stan.projekt.sekcje.find((s) => s.id === dlg.dataset.id);
  if (okladka) {
    // Format okładki liczy się sam; wynik poprzedniego przeliczenia zostaje, żeby elementy przesunęły się o różnicę.
    ustawienia.okladka = { ...okladkaZPol(f), wynik: poprzednia?.okladka?.wynik || null };
    ustawienia.uklad = 'pojedyncze';
    // Okładka zrobiona dotąd ręcznie: jej obecny format jest punktem wyjścia do przesunięcia elementów.
    if (poprzednia && !poprzednia.okladka) Object.assign(wydruk, { szerokosc_mm: poprzednia.wydruk.szerokosc_mm, wysokosc_mm: poprzednia.wydruk.wysokosc_mm });
  } else {
    ustawienia.skladka = normalizujSkladke(f.elements.skladka.value);
  }
  zapiszBiezacyCel();
  const { projekt } = stan;
  let sekcja = poprzednia;
  if (sekcja) {
    if (!okladka) delete sekcja.okladka;
    Object.assign(sekcja, ustawienia);
  } else {
    sekcja = { ...nowaSekcja(ustawienia.nazwa, wydruk), ...ustawienia };
    const i = okladka ? -1 : projekt.sekcje.indexOf(biezacaSekcja()); // okładka staje na początku
    projekt.sekcje.splice(i + 1, 0, sekcja);
    const strona = nowaStrona(`Strona ${projekt.strony.length + 1}`, sekcja.id);
    projekt.strony.push(strona);
    uporzadkujStrony(projekt);
    stan.tryb = 'strona';
    stan.indeks = projekt.strony.indexOf(strona);
    ustawZakladke('strony');
  }
  if (okladka) delete sekcja.skladka;
  else if (!sekcja.skladka) delete sekcja.skladka;
  // Okładka przelicza swój format i przesuwa elementy (za pierwszym razem – ze starego formatu sekcji).
  przeliczOkladki(projekt);
  stan.miniatury.clear(); // format, wzorce albo numeracja mogły zmienić każdą stronę
  await zaladujCel();
  if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
}

$('#dlg-sekcja').addEventListener('close', () => {
  if ($('#dlg-sekcja').returnValue === 'ok') zatwierdzSekcje();
});
$('#dlg-sekcja select[name="format"]').addEventListener('change', () => {
  const f = $('#dlg-sekcja form');
  const wym = FORMATY[f.elements.format.value];
  if (!wym) return;
  const poziomo = Number(f.elements.szerokosc_mm.value) > Number(f.elements.wysokosc_mm.value);
  f.elements.szerokosc_mm.value = poziomo ? Math.max(...wym) : wym[0];
  f.elements.wysokosc_mm.value = poziomo ? Math.min(...wym) : wym[1];
  rysujSchemat();
});
for (const n of ['szerokosc_mm', 'wysokosc_mm']) {
  $(`#dlg-sekcja [name="${n}"]`).addEventListener('input', () => {
    const f = $('#dlg-sekcja form');
    f.elements.format.value = wykryjFormat(Number(f.elements.szerokosc_mm.value), Number(f.elements.wysokosc_mm.value));
  });
}

export async function przesunSekcje(id, kierunek) {
  const sekcje = stan.projekt.sekcje;
  const i = sekcje.findIndex((s) => s.id === id);
  const j = i + kierunek;
  if (j < 0 || j >= sekcje.length) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  [sekcje[i], sekcje[j]] = [sekcje[j], sekcje[i]];
  uporzadkujStrony(stan.projekt);
  await przelejPoZmianieKolejnosci();
  stan.indeks = stan.projekt.strony.indexOf(biezaca);
  stan.miniatury.clear();
  await zaladujCel();
  zaplanujZapis();
}

export async function usunSekcje(id) {
  const { projekt } = stan;
  if (projekt.sekcje.length <= 1) return;
  const sekcja = projekt.sekcje.find((s) => s.id === id);
  const strony = projekt.strony.filter((s) => s.sekcja === id);
  if (strony.length === projekt.strony.length) {
    powiadom('To jedyne strony w projekcie – przenieś najpierw jakąś stronę do innej sekcji.', true);
    return;
  }
  const ok = await potwierdz(
    `Usunąć sekcję „${sekcja.nazwa}”?`,
    strony.length ? `Razem z nią zostanie usuniętych ${strony.length} stron.` : 'Sekcja jest pusta.',
    'Usuń sekcję',
    true,
  );
  if (!ok) return;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  projekt.sekcje = projekt.sekcje.filter((s) => s.id !== id);
  projekt.strony = projekt.strony.filter((s) => s.sekcja !== id);
  const ni = projekt.strony.indexOf(biezaca);
  stan.indeks = ni >= 0 ? ni : 0;
  stan.miniatury.clear();
  await zaladujCel();
  zaplanujZapis();
  powiadom(`Usunięto sekcję „${sekcja.nazwa}”.`, false, { etykieta: 'Cofnij', fn: () => cofnijKrok(-1) });
}

// „Zamień na okładkę” (#119): okno ustawień od razu z rodzajem „Okładka” – elementy zostają i przesuwają się
// tak, żeby trzymały się tyłu, grzbietu i przodu nowego formatu.
export function zamienNaOkladke(id) {
  otworzUstawieniaSekcji.jakoOkladka = true;
  otworzUstawieniaSekcji(id);
}

// Składki (#120): dopełnia sekcję pustymi stronami do pełnej składki (na końcu sekcji, z cofaniem).
export async function dopelnijSkladke(id) {
  const { projekt } = stan;
  const sekcja = projekt.sekcje.find((s) => s.id === id);
  const b = sekcja && bilansSkladki(sekcja, rozwin(projekt));
  if (!b?.brakuje) return 0;
  zapiszBiezacyCel();
  const biezaca = biezacaStrona();
  const ostatnia = projekt.strony.map((s) => s.sekcja).lastIndexOf(id);
  const nowe = Array.from({ length: b.brakuje }, (_, k) => nowaStrona(`Strona ${projekt.strony.length + k + 1}`, id));
  projekt.strony.splice(ostatnia + 1, 0, ...nowe);
  uporzadkujStrony(projekt);
  stan.indeks = Math.max(0, projekt.strony.indexOf(biezaca));
  stan.miniatury.clear();
  await zaladujCel();
  zaplanujZapis();
  const ile = b.brakuje === 1 ? 'pustą stronę' : (b.brakuje < 5 ? 'puste strony' : 'pustych stron');
  powiadom(`Dodano ${b.brakuje} ${ile} – sekcja „${sekcja.nazwa}” ma ${b.doPelnej} stron.`, false, { etykieta: 'Cofnij', fn: () => cofnijKrok(-1) });
  return b.brakuje;
}

$('#dlg-sekcja [name="siatka_bazowa"]').addEventListener('change', (e) => { $('#siatka-bazowa-liczby').hidden = !e.target.checked; });
