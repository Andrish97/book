// Sekcje: okno ustawień (format, spad, marginesy, układ, numeracja, okładka liczona sama #119, składki #120),
// kolejność i usuwanie.

import { MATERIALY, FOLIE_OKLADKI, ROGI } from '../materialy.js';
import { FORMATY, nowaSekcja, nowaStrona, uporzadkujStrony } from '../projekt.js';
import { rozwin } from '../serie.js';
import {
  PAPIERY, STREFY, normalizujOkladke, domyslnaOkladka, geometriaOkladki, jestOkladka, przeliczOkladki,
  normalizujSkladke, bilansSkladki, opisSkladki,
} from '../okladka.js';
import { RODZAJE_SEKCJI, domyslnaSpecjalna, normalizujSpecjalna, geometriaSpecjalna, opisSpecjalnej } from '../sekcje-specjalne.js';
import { TYPY_SEKCJI, typSekcji, wBloku } from '../typ-sekcji.js';
import { ikona } from '../ikony.js';
import { $, $$, powiadom, potwierdz } from '../ui.js';
import { stan, biezacaSekcja, tenSamRozmiar, liczba, edytor, biezacaStrona } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';
import { ustawZakladke, przelejPoZmianieKolejnosci } from './lista-stron.js';

// ---------- Sekcje ----------

// Karty typów sekcji (#177): ikona, nazwa i jedno zdanie opisu. Typ ustala geometrię i zachowanie sekcji.
$('#lista-typow-sekcji').innerHTML = Object.entries(TYPY_SEKCJI).map(([k, t]) => `<label class="karta-typu" data-typ="${k}"><input type="radio" name="typ" value="${k}">${ikona(t.ikona)}<span><strong>${t.nazwa}</strong><small>${t.opis}</small></span></label>`).join('');

// Typ wybrany w oknie i rodzaj parametrów, który z niego wynika ('strony', 'okladka' albo rodzaj sekcji specjalnej).
const typOkna = (f) => (TYPY_SEKCJI[f.elements.typ.value] ? f.elements.typ.value : 'zwykla');
function ustawTyp(f, typ) {
  f.elements.typ.value = TYPY_SEKCJI[typ] ? typ : 'zwykla';
  f.elements.rodzaj.value = TYPY_SEKCJI[typOkna(f)].rodzaj || 'strony';
}

// Dialog ustawień sekcji. id === null → nowa sekcja.
// ---------- Podłoże (#213) ----------
// Na czym się drukuje: biały papier (zwykle), kolorowy papier albo przezroczysta folia. Podłoże widać w edytorze,
// podglądzie i makiecie 3D jako tło stron; w PDF się nie drukuje (to papier, nie farba).
const OPISY_PODLOZA = {
  kolor: 'Kolor papieru widać na stronach, ale nie drukuje się. Biel nie jest farbą: białe elementy wyjdą w kolorze papieru – chyba że dostaną biały poddruk (Kolory do druku → Uszlachetnienie).',
  folia: 'Strony na szachownicy – folia jest przezroczysta. Farby na folii prześwitują; pod elementami, które mają być kryjące, ustaw biały poddruk (Kolory do druku → Uszlachetnienie → Biały poddruk).',
};
function podlozeZPol(f) {
  const rodzaj = f.elements.podloze.value;
  if (rodzaj === 'kolor') return { rodzaj, kolor: f.elements.podloze_kolor.value || '#f3e4c2' };
  if (rodzaj === 'folia') return { rodzaj };
  return undefined;
}
function opiszPodloze(f) {
  const r = f.elements.podloze.value;
  $('#pole-podloze-kolor').hidden = r !== 'kolor';
  $('#opis-podloza').hidden = !OPISY_PODLOZA[r];
  $('#opis-podloza').textContent = OPISY_PODLOZA[r] || '';
}
$('#dlg-sekcja form').addEventListener('change', (e) => { if (e.target.name === 'podloze') opiszPodloze(e.currentTarget); });

export function otworzUstawieniaSekcji(id) {
  const dlg = $('#dlg-sekcja');
  const f = dlg.querySelector('form');
  const { projekt } = stan;
  const istniejaca = projekt.sekcje.find((s) => s.id === id);
  const wzor = istniejaca || biezacaSekcja();
  const w = wzor.wydruk;
  dlg.dataset.id = id || '';
  // Zmiana formatu z dopasowaniem elementów (#131D) – dla istniejącej sekcji.
  $('[data-akcja="format-sekcji"]').hidden = !istniejaca;
  $('#sekcja-format-skaluj-opis').hidden = !istniejaca;
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
  // Podłoże (#213).
  f.elements.podloze.value = istniejaca?.podloze?.rodzaj || 'bialy';
  f.elements.podloze_kolor.value = istniejaca?.podloze?.kolor || '#f3e4c2';
  opiszPodloze(f);
  // Typ sekcji (#177): zapisany w sekcji; „Zamień na okładkę” i „jako” wybierają go z góry; nowa sekcja – zwykła.
  const jako = otworzUstawieniaSekcji.jakoOkladka ? 'okladka' : otworzUstawieniaSekcji.jakoTyp;
  wypelnijOkladke(f, istniejaca, otworzUstawieniaSekcji.jakoOkladka);
  otworzUstawieniaSekcji.jakoOkladka = false;
  otworzUstawieniaSekcji.jakoTyp = null;
  wypelnijSpecjalna(f, istniejaca, TYPY_SEKCJI[jako]?.rodzaj);
  ustawTyp(f, TYPY_SEKCJI[jako] ? jako : istniejaca ? typSekcji(istniejaca) : 'zwykla');
  // Wkładka: własny papier.
  f.elements.rola_gramatura.value = istniejaca?.papier?.gramatura || 130;
  f.elements.rola_papier.value = istniejaca?.papier?.rodzaj || 'kredowy_mat';

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
  const typ = typOkna(f);
  ustawTyp(f, typ);
  for (const k of $$('.karta-typu', f)) k.classList.toggle('wybrana', k.dataset.typ === typ);
  const okladka = f.elements.rodzaj.value === 'okladka';
  const rodzajSp = RODZAJE_SEKCJI[f.elements.rodzaj.value] ? f.elements.rodzaj.value : null;
  // Sekcja z własnym arkuszem (wszystkie specjalne poza kalendarzem z datami): format liczy się sam.
  const arkuszSp = Boolean(rodzajSp) && rodzajSp !== 'kalendarz';
  $('#sekcja-okladka').hidden = !okladka;
  $('#sekcja-specjalna').hidden = !rodzajSp;
  $('#opis-rodzaju-sekcji').hidden = !rodzajSp;
  if (rodzajSp) {
    $('#opis-rodzaju-sekcji').textContent = RODZAJE_SEKCJI[rodzajSp].opis;
    $('#legenda-specjalnej').textContent = RODZAJE_SEKCJI[rodzajSp].nazwa;
    const ksztalt = f.elements.sp_ksztalt.value;
    for (const el of $$('[data-sp]', f)) el.hidden = el.dataset.sp !== rodzajSp || (el.dataset.spKsztalt !== undefined && el.dataset.spKsztalt !== ksztalt);
    for (const el of $$('[data-sp-ksztalt]:not([data-sp])', f)) el.hidden = el.dataset.spKsztalt !== ksztalt;
    // Składanka: wymiary tylko dla arkusza własnego; gramatura dla papieru i kartonu, grubość dla tektury i własnej.
    const zGramatury = ['papier', 'karton'].includes(f.elements.sp_s_material.value);
    const widac = { wlasny: f.elements.sp_s_arkusz.value === 'wlasny', gramatura: zGramatury, grubosc: !zGramatury };
    for (const el of $$('[data-sp-s]', f)) el.hidden = rodzajSp !== 'skladanka' || !widac[el.dataset.spS];
  }
  $('#pole-papier-wkladki').hidden = typ !== 'wkladka';
  $('#pole-ok-tasiemka').hidden = !okladka || f.elements.ok_oprawa.value !== 'twarda';
  $('#sekcja-format').hidden = okladka || arkuszSp;
  $('#pole-uklad-sekcji').hidden = okladka || arkuszSp;
  $('#pole-skladka').hidden = okladka || arkuszSp;
  $('#opis-skladki').hidden = okladka || arkuszSp;
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
  if (okladka) rysujOkladke(); else if (rodzajSp) rysujSpecjalna(); else opiszSkladke();
}
$('#dlg-sekcja form').addEventListener('change', (e) => {
  if (e.target.name?.startsWith('sp_')) { if (['sp_ksztalt', 'sp_s_arkusz', 'sp_s_material'].includes(e.target.name)) odswiezPolaSekcji(); else rysujSpecjalna(); return; }
  if (['uklad', 'numeracja', 'typ', 'ok_papier', 'ok_oprawa', 'ok_strony', 'ok_wymiary', 'skladka'].includes(e.target.name)) {
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
  // Materiał i wykończenie (#214).
  const wyk = o.wykonczenie || { material: 'druk', folia: 'mat', rogi_mm: 0 };
  f.elements.ok_material.replaceChildren(...Object.entries(MATERIALY).map(([k, m]) => new Option(m.nazwa, k)));
  f.elements.ok_material.value = wyk.material;
  f.elements.ok_folia.replaceChildren(...Object.entries(FOLIE_OKLADKI).map(([k, n]) => new Option(n, k)));
  f.elements.ok_folia.value = wyk.folia || 'mat';
  f.elements.ok_rogi.replaceChildren(...ROGI.map((r) => new Option(r ? `zaokrąglone ${r} mm` : 'proste', String(r))));
  f.elements.ok_rogi.value = String(ROGI.includes(wyk.rogi_mm) ? wyk.rogi_mm : 0);
  odswiezMaterial(f, wyk.kolor);
  f.elements.ok_tasiemka.checked = Boolean(o.tasiemka);
  if (o.tasiemka) f.elements.ok_tasiemka_kolor.value = o.tasiemka.kolor;
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

// Materiał okładki (#214): kolory okleiny według materiału, folia tylko przy druku.
function odswiezMaterial(f, kolor = null) {
  const m = MATERIALY[f.elements.ok_material.value] || MATERIALY.druk;
  $('#pole-ok-folia').hidden = !m.druk;
  $('#pole-ok-kolor-materialu').hidden = m.druk;
  if (!m.druk) {
    const sel = f.elements.ok_kolor_materialu;
    sel.replaceChildren(...m.kolory.map(([k, n]) => new Option(n, k)), new Option('Inny kolor…', 'wlasny'));
    const znany = m.kolory.some(([k]) => k === kolor);
    sel.value = !kolor ? m.kolory[0][0] : znany ? kolor : 'wlasny';
    if (kolor && !znany) f.elements.ok_kolor_wlasny.value = kolor;
  }
  $('#pole-ok-kolor-wlasny').hidden = m.druk || f.elements.ok_kolor_materialu.value !== 'wlasny';
  $('#opis-materialu').textContent = m.druk
    ? 'Nadruk na kartonie, zabezpieczony folią. Złocenie, lakier UV i tłoczenie ustawisz przy elementach (Kolory do druku → Uszlachetnienie).'
    : `${m.opis} Grafika okładki się nie drukuje – na okleinie zostają elementy ze złoceniem albo tłoczeniem (Kolory do druku → Uszlachetnienie). Makieta 3D pokazuje okleinę w wybranym kolorze.`;
}
function wykonczenieZPol(f) {
  const material = f.elements.ok_material.value;
  const m = MATERIALY[material] || MATERIALY.druk;
  const kolor = m.druk ? undefined : (f.elements.ok_kolor_materialu.value === 'wlasny' ? f.elements.ok_kolor_wlasny.value : f.elements.ok_kolor_materialu.value);
  return { material, folia: f.elements.ok_folia.value, kolor, rogi_mm: Number(f.elements.ok_rogi.value) || 0 };
}
$('#dlg-sekcja form').addEventListener('change', (e) => {
  if (e.target.name === 'ok_material' || e.target.name === 'ok_kolor_materialu') odswiezMaterial(e.currentTarget, e.target.name === 'ok_kolor_materialu' ? e.target.value : null);
});

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
    tasiemka: f.elements.ok_tasiemka.checked ? { kolor: f.elements.ok_tasiemka_kolor.value } : null,
    wykonczenie: wykonczenieZPol(f),
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

// ---------- Sekcje specjalne (#177) ----------

// Pole okna → parametr rodzaju (część nazw parametrów powtarza się między rodzajami – pola mają własne nazwy).
const POLA_SPECJALNE = {
  wyklejka: { zadruk: 'sp_zadruk', gramatura: 'sp_gramatura' }, // przednia albo tylna – z typu sekcji
  obwoluta: { skrzydelko_mm: 'sp_skrzydelko_mm', zapas_mm: 'sp_zapas_mm', naddatek_wys_mm: 'sp_naddatek_wys_mm' },
  ulotka: { panele: 'sp_panele', zlozenie: 'sp_zlozenie', szerokosc_mm: 'sp_szerokosc_mm', wysokosc_mm: 'sp_wysokosc_mm', skrot_mm: 'sp_skrot_mm' },
  kalendarz: { rok: 'sp_rok', jednostka: 'sp_jednostka', pierwszy: 'sp_pierwszy', swieta: 'sp_swieta' },
  trojdzielny: { szerokosc_mm: 'sp_t_szerokosc_mm', glowka_mm: 'sp_glowka_mm', kalendarium_mm: 'sp_kalendarium_mm', reklama_mm: 'sp_reklama_mm', okienko: 'sp_okienko' },
  wykrojnik: {
    ksztalt: 'sp_ksztalt', zadruk: 'sp_w_zadruk', koperta: 'sp_koperta', panel_szer_mm: 'sp_panel_szer_mm', panel_wys_mm: 'sp_panel_wys_mm', grzbiet_mm: 'sp_grzbiet_mm',
    kieszen_mm: 'sp_kieszen_mm', wizytowka: 'sp_wizytowka', dlugosc_mm: 'sp_dlugosc_mm', szerokosc_mm: 'sp_p_szerokosc_mm', wysokosc_mm: 'sp_p_wysokosc_mm',
  },
  skladanka: {
    arkusz: 'sp_s_arkusz', orientacja: 'sp_s_orientacja', arkusz_szer_mm: 'sp_s_szer_mm', arkusz_wys_mm: 'sp_s_wys_mm', material: 'sp_s_material', gramatura: 'sp_s_gramatura',
    grubosc_mm: 'sp_s_grubosc_mm', druk: 'sp_s_druk', druga_strona: 'sp_s_druga', margines_mm: 'sp_s_margines_mm',
  },
  arkusz: {
    uzytek_szer_mm: 'sp_uzytek_szer_mm', uzytek_wys_mm: 'sp_uzytek_wys_mm', arkusz: 'sp_arkusz', odstep_mm: 'sp_odstep_mm', margines_mm: 'sp_margines_mm',
    ksztalt: 'sp_u_ksztalt', zaokraglenie_mm: 'sp_zaokraglenie_mm',
  },
};

// Pola wszystkich rodzajów: z parametrów sekcji (jej rodzaju) albo domyślne. `jako` – rodzaj wybrany z góry
// (np. „Dodaj sekcję → Ulotka składana”).
function wypelnijSpecjalna(f, sekcja, jako = null) {
  const biezaca = normalizujSpecjalna(sekcja?.specjalna);
  if (biezaca) f.elements.rodzaj.value = biezaca.rodzaj;
  else if (jako && RODZAJE_SEKCJI[jako]) f.elements.rodzaj.value = jako;
  const w = (sekcja || biezacaSekcja()).wydruk;
  for (const [rodzaj, pola] of Object.entries(POLA_SPECJALNE)) {
    const p = biezaca?.rodzaj === rodzaj ? biezaca : domyslnaSpecjalna(rodzaj);
    // Ulotka: domyślnie panel w formacie bieżącej sekcji (do 210 mm szerokości).
    if (biezaca?.rodzaj !== rodzaj && rodzaj === 'ulotka') Object.assign(p, { szerokosc_mm: Math.min(w.szerokosc_mm, 210), wysokosc_mm: w.wysokosc_mm });
    for (const [klucz, nazwa] of Object.entries(pola)) {
      const el = f.elements[nazwa];
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = Boolean(p[klucz]);
      else el.value = String(p[klucz] ?? '');
    }
  }
}

function specjalnaZPol(f) {
  const rodzaj = f.elements.rodzaj.value;
  const pola = POLA_SPECJALNE[rodzaj];
  if (!pola) return null;
  const surowe = { rodzaj };
  for (const [klucz, nazwa] of Object.entries(pola)) {
    const el = f.elements[nazwa];
    if (!el) continue;
    if (el.type === 'checkbox') surowe[klucz] = el.checked;
    else if (el.type === 'number') surowe[klucz] = Number(String(el.value).replace(',', '.'));
    else surowe[klucz] = el.value;
  }
  if (rodzaj === 'wyklejka') surowe.strona = typOkna(f) === 'wyklejka_tylna' ? 'tylna' : 'przednia';
  const istniejaca = stan.projekt?.sekcje.find((s) => s.id === $('#dlg-sekcja').dataset.id);
  // Kalendarz: tabela i seria zostają te same (dane przepisują się dla nowego roku, kolumny dopisane ręcznie zostają).
  if (rodzaj === 'kalendarz' && istniejaca?.specjalna?.rodzaj === 'kalendarz') Object.assign(surowe, { tabela: istniejaca.specjalna.tabela, seria: istniejaca.specjalna.seria });
  return normalizujSpecjalna(surowe);
}

const PODPOWIEDZI_SPECJALNE = {
  wyklejka: 'Format bierze się z bloku: dwie jego kartki obok siebie, zgięcie pośrodku. Połowa „Na okładce” przykleja się do wnętrza twardej okładki, druga to luźna kartka – jej grubość dochodzi do grzbietu. Wyklejka nie ma numerów stron; w PDF jest osobną sekcją w rozłożeniu, ze spadem.',
  obwoluta: 'Wymiary biorą się z twardej okładki projektu (płyty i grzbiet) – gdy przybędzie stron, obwoluta przeliczy się sama. Skrzydełko 0 – około połowy szerokości przodu.',
  ulotka: 'Sekcja ma dwie strony: zewnętrzną (okładka, tył) i wewnętrzną. Przy złożeniu zwijanym panel składany do środka jest węższy – inaczej zagnie się na zgięciu. Tekst nie powinien leżeć na zgięciu.',
  trojdzielny: 'Główka zgina się na bigu do tyłu; kalendaria i pasek reklamowy oddziela perforacja. Pola kalendariów to miejsca na naklejane bloki z datami.',
  wykrojnik: 'Linia cięcia i zgięć trafia do PDF w osobnych kolorach („CutContour” i „Crease”) – drukarnia ich nie drukuje, tylko wycina i bigi. To, co leży poza linią cięcia, odpadnie.',
  skladanka: 'Każda strona tej sekcji to jeden arkusz z częściami modelu. Grubość materiału liczy się z gramatury – szczeliny są o nią szersze, a zakładki i klapki wewnętrzne krótsze. W druku domowym linie cięcia i zgięć są wydrukowane; dla drukarni idą do PDF jako osobne kolory („CutContour”, „Crease”, „Glue”).',
  arkusz: 'Projektujesz jeden użytek (albo kolejne z danych – seria). W PDF użytki stoją obok siebie na arkuszu, ze znakami cięcia; naklejka dostaje linię wykrojnika.',
};

// Schemat sekcji specjalnej: strefy, zgięcia, perforacje i wykrojnik w SVG, z opisem wyniku.
function rysujSpecjalna() {
  const f = $('#dlg-sekcja form');
  const p = specjalnaZPol(f);
  if (!p || !stan.projekt) return;
  const el = $('#schemat-specjalnej');
  const id = $('#dlg-sekcja').dataset.id;
  const istniejaca = stan.projekt.sekcje.find((s) => s.id === id);
  const sekcja = { ...(istniejaca || { id: '__nowa__', wydruk: biezacaSekcja().wydruk }), specjalna: p };
  const g = geometriaSpecjalna(stan.projekt, sekcja);
  $('#podpowiedz-specjalnej').textContent = PODPOWIEDZI_SPECJALNE[p.rodzaj] || '';
  if (!g) {
    el.hidden = true;
    $('#wynik-specjalnej').replaceChildren(Object.assign(document.createElement('strong'), { textContent: opisSpecjalnej(sekcja) }),
      Object.assign(document.createElement('small'), { textContent: 'Pierwsza strona sekcji powiela się dla każdego wiersza danych. Wstaw na nią pola: {data}, {dzien}, {miesiac}, {dzien_tygodnia}, {tydzien}, {swieto}; „wolne” ma wartość „tak” w niedziele i święta (np. do koloru zależnego od danych).' }));
    return;
  }
  el.hidden = false;
  const strony = g.strefy.some((z) => z.strona === 1) ? [0, 1] : [0];
  const odstep = g.wysokosc * 0.12;
  const H = strony.length * g.wysokosc + (strony.length - 1) * odstep;
  el.style.setProperty('--proporcja', `${g.szerokosc} / ${H}`);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${g.szerokosc} ${H}`);
  const dodaj = (nazwa, atr, tekst) => {
    const e = document.createElementNS(NS, nazwa);
    for (const [k, v] of Object.entries(atr)) e.setAttribute(k, v);
    if (tekst) e.textContent = tekst;
    svg.append(e);
    return e;
  };
  const fs = Math.max(6, Math.min(g.szerokosc, g.wysokosc) / 16);
  strony.forEach((nr, i) => {
    const dy = i * (g.wysokosc + odstep);
    const tu = (x) => x.strona === undefined || x.strona === nr;
    for (const z of g.strefy.filter(tu)) {
      const pomocnicza = z.rodzaj.startsWith('klej') || ['okienko', 'wizytowka'].includes(z.rodzaj);
      const r = dodaj('rect', { x: z.x1, y: z.y1 + dy, width: z.x2 - z.x1, height: z.y2 - z.y1, class: `sp-strefa${pomocnicza ? ' pomocnicza' : ''}${z.x2 - z.x1 < g.szerokosc * 0.06 ? ' waska' : ''}` });
      const t = document.createElementNS(NS, 'title');
      t.textContent = `${z.nazwa}: ${liczba(z.x2 - z.x1)} × ${liczba(z.y2 - z.y1)} mm`;
      r.append(t);
      if (z.x2 - z.x1 > fs * z.nazwa.length * 0.6 && z.y2 - z.y1 > fs * 1.6 && !z.rodzaj.startsWith('zapas')) dodaj('text', { x: (z.x1 + z.x2) / 2, y: (z.y1 + z.y2) / 2 + dy, 'font-size': fs }, z.nazwa);
    }
    for (const l of (g.bigi || []).filter(tu)) dodaj('line', { x1: l.x1, y1: l.y1 + dy, x2: l.x2, y2: l.y2 + dy, class: 'sp-big' });
    for (const l of g.perforacje || []) dodaj('line', { x1: l.x1, y1: l.y1 + dy, x2: l.x2, y2: l.y2 + dy, class: 'sp-perforacja' });
    for (const k of g.ciecie || []) dodaj('polygon', { points: k.map((q) => `${q.x},${q.y + dy}`).join(' '), class: 'sp-ciecie' });
    for (const l of g.naciecia || []) dodaj('line', { x1: l.x1, y1: l.y1 + dy, x2: l.x2, y2: l.y2 + dy, class: 'sp-ciecie' });
  });
  el.replaceChildren(svg);
  const opis = opisSpecjalnej({ ...sekcja, specjalna: { ...p, wynik: { rodzaj: p.rodzaj, ...g } } });
  $('#wynik-specjalnej').replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: `${strony.length > 1 ? 'Arkusz (2 strony) ' : ''}${liczba(g.szerokosc)} × ${liczba(g.wysokosc)} mm` }),
    Object.assign(document.createElement('small'), { textContent: opis }),
  );
}
$('#sekcja-specjalna').addEventListener('input', () => rysujSpecjalna());

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
    typ: typOkna(f),
    podloze: podlozeZPol(f),
  };
  const okladka = f.elements.rodzaj.value === 'okladka';
  const poprzednia = stan.projekt.sekcje.find((s) => s.id === dlg.dataset.id);
  const specjalna = specjalnaZPol(f);
  if (specjalna) {
    // Sekcja specjalna (#177): wynik poprzedniego przeliczenia tego samego rodzaju zostaje – elementy przesuną się o różnicę.
    ustawienia.specjalna = { ...specjalna, wynik: poprzednia?.specjalna?.rodzaj === specjalna.rodzaj ? poprzednia.specjalna.wynik : null };
    if (specjalna.rodzaj !== 'kalendarz') ustawienia.uklad = 'pojedyncze';
  }
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
  // Wkładka (#177): własny papier – jego grubość dochodzi do grzbietu okładki.
  if (ustawienia.typ === 'wkladka') ustawienia.papier = { gramatura: Math.max(30, Math.min(400, Number(f.elements.rola_gramatura.value) || 130)), rodzaj: f.elements.rola_papier.value };
  if (sekcja) {
    if (!okladka) delete sekcja.okladka;
    if (!specjalna) delete sekcja.specjalna;
    delete sekcja.rola;
    delete sekcja.papier;
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
  if (!sekcja.podloze) delete sekcja.podloze;
  if (!wBloku(sekcja)) delete sekcja.skladka;
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
