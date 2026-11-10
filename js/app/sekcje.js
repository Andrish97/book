// Sekcje: okno ustawień (format, spad, marginesy, układ, numeracja, kalkulator grzbietu), kolejność i usuwanie.

import { FORMATY, nowaSekcja, nowaStrona, uporzadkujStrony } from '../projekt.js';
import { rozwin } from '../serie.js';
import { $, $$, powiadom, potwierdz } from '../ui.js';
import { stan, biezacaSekcja, tenSamRozmiar, liczba, edytor, biezacaStrona } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';
import { ustawZakladke } from './lista-stron.js';

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
  $('#kalkulator-grzbietu').open = false;
  $('#grzbiet-strona').value = '';
  $('#grzbiet-strony').value = '';
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
  const num = (istniejaca || { numeracja: { tryb: 'ciagla', od: 1 } }).numeracja;
  f.elements.numeracja.value = num.tryb;
  f.elements.numeracja_od.value = num.od;

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
}
$('#dlg-sekcja form').addEventListener('change', (e) => {
  if (['uklad', 'numeracja'].includes(e.target.name)) odswiezPolaSekcji();
});

// Kalkulator okładki: tył + grzbiet + przód. Grzbiet = liczba kartek × grubość kartki.
function policzGrzbiet() {
  const strona = Number($('#grzbiet-strona').value);
  const strony = Number($('#grzbiet-strony').value);
  const kartka = Number($('#grzbiet-kartka').value);
  if (!(strona > 0 && strony > 0 && kartka > 0)) { $('#grzbiet-wynik').textContent = 'Podaj trzy liczby.'; return null; }
  const grzbiet = Math.round((strony / 2) * kartka * 10) / 10;
  const szerokosc = Math.round((2 * strona + grzbiet) * 10) / 10;
  $('#grzbiet-wynik').textContent = `Grzbiet: ${liczba(grzbiet)} mm (${strony / 2} kartek × ${liczba(kartka)} mm). Okładka: ${liczba(strona)} + ${liczba(grzbiet)} + ${liczba(strona)} = ${liczba(szerokosc)} mm szerokości. Grubość kartki podaje drukarnia; papier 80 g ma zwykle ok. 0,1 mm.`;
  return szerokosc;
}
$('#kalkulator-grzbietu').addEventListener('input', policzGrzbiet);
$('#kalkulator-grzbietu').addEventListener('toggle', () => {
  if (!$('#kalkulator-grzbietu').open || !stan.projekt) return;
  // Podpowiedź: największa inna sekcja projektu jest najpewniej środkiem.
  const idTej = $('#dlg-sekcja').dataset.id;
  const ciag = rozwin(stan.projekt);
  const inne = stan.projekt.sekcje.filter((s) => s.id !== idTej).map((s) => ({ s, n: ciag.sekcje.get(s.id).lista.length })).sort((a, b) => b.n - a.n)[0];
  if (inne && !$('#grzbiet-strona').value) {
    $('#grzbiet-strona').value = inne.s.wydruk.szerokosc_mm;
    $('#grzbiet-strony').value = inne.n + (inne.n % 2);
  }
  policzGrzbiet();
});
$('#grzbiet-ustaw').addEventListener('click', () => {
  const szerokosc = policzGrzbiet();
  if (!szerokosc) return;
  const f = $('#dlg-sekcja form');
  f.elements.szerokosc_mm.value = szerokosc;
  f.elements.format.value = 'wlasny';
  f.elements.uklad.value = 'pojedyncze';
  odswiezPolaSekcji();
});

function wykryjFormat(sz, wy) {
  for (const [nazwa, [a, b]] of Object.entries(FORMATY)) {
    if ((a === sz && b === wy) || (a === wy && b === sz)) return nazwa;
  }
  return 'wlasny';
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
  };
  const ustawienia = {
    nazwa: f.elements.nazwa.value.trim() || 'Sekcja',
    wydruk,
    uklad: f.elements.uklad.value === 'rozkladowki' ? 'rozkladowki' : 'pojedyncze',
    pierwsza: f.elements.pierwsza.value === 'lewa' ? 'lewa' : 'prawa',
    wzorce: $$('input[name="wzorce"]:checked', f).map((i) => i.value),
    numeracja: { tryb: f.elements.numeracja.value, od: Math.max(0, Math.round(mm('numeracja_od'))) },
  };
  zapiszBiezacyCel();
  const { projekt } = stan;
  let sekcja = projekt.sekcje.find((s) => s.id === dlg.dataset.id);
  if (sekcja) {
    Object.assign(sekcja, ustawienia);
  } else {
    sekcja = { ...nowaSekcja(ustawienia.nazwa, wydruk), ...ustawienia };
    const i = projekt.sekcje.indexOf(biezacaSekcja());
    projekt.sekcje.splice(i + 1, 0, sekcja);
    const strona = nowaStrona(`Strona ${projekt.strony.length + 1}`, sekcja.id);
    projekt.strony.push(strona);
    uporzadkujStrony(projekt);
    stan.tryb = 'strona';
    stan.indeks = projekt.strony.indexOf(strona);
    ustawZakladke('strony');
  }
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
