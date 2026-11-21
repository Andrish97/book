// Okno „Zmień format” (#131D): format sekcji (z okna ustawień sekcji) albo całego projektu (menu ⋯ projektu),
// sposób postępowania z elementami i podgląd przed/po. Logika w js/format-projektu.js.

import { FORMATY } from '../projekt.js';
import { zmienFormat, elementyPozaStrona, nazwaFormatu } from '../format-projektu.js';
import { przeliczOkladki } from '../okladka.js';
import { $, powiadom } from '../ui.js';
import { przedDlugaCzynnoscia } from '../postep.js';
import { stan, biezacaStrona, edytor } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis, cofnijKrok } from './zapis.js';
import { panel } from './skladniki.js';
import { t as tt } from '../jezyk.js';

const dlg = $('#dlg-format');
const f = $('#form-format');
let zakres = []; // id sekcji

const liczba = (v) => Math.max(20, parseFloat(String(v).replace(',', '.')) || 0);
const sekcjeZakresu = () => stan.projekt.sekcje.filter((s) => zakres.includes(s.id) && !s.okladka);

// Sekcja do podglądu: bieżąca strona, jeśli jest w zakresie, inaczej pierwsza strona zakresu.
function stronaPodgladu() {
  const wZakresie = (s) => zakres.includes(s.sekcja) && !stan.projekt.sekcje.find((x) => x.id === s.sekcja)?.okladka;
  const b = biezacaStrona();
  if (b && wZakresie(b)) return b;
  return stan.projekt.strony.find(wZakresie) || null;
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);

// Schemat strony: kartka, marginesy i prostokąty elementów (tekst – paski, reszta – ramki).
function schemat(sekcja, strona) {
  const { szerokosc_mm: W, wysokosc_mm: H, marginesy: m = {} } = sekcja.wydruk;
  const el = (strona?.obiekty || []).slice(0, 200).map((o) => {
    const w = (o.width || 0) * Math.abs(o.scaleX ?? 1);
    const h = (o.height || (o.fontSize ? o.fontSize * 1.3 : 0)) * Math.abs(o.scaleY ?? 1);
    if (!w || !h) return '';
    const kl = /text/i.test(o.type) ? 'tekst' : (o.type === 'image' ? 'obraz' : 'ksztalt');
    return `<rect class="${kl}" x="${o.left || 0}" y="${o.top || 0}" width="${w}" height="${h}" transform="rotate(${o.angle || 0} ${o.left || 0} ${o.top || 0})"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(`${W} × ${H} mm`)}">
    <rect class="fk-kartka" x="0" y="0" width="${W}" height="${H}"/>
    <rect class="margines" x="${m.wewnetrzny ?? m.lewy ?? 0}" y="${m.gora ?? 0}" width="${Math.max(0, W - (m.wewnetrzny ?? 0) - (m.zewnetrzny ?? 0))}" height="${Math.max(0, H - (m.gora ?? 0) - (m.dol ?? 0))}"/>
    <g>${el}</g></svg>`;
}

function opcje() {
  return {
    szerokosc_mm: liczba(f.elements.szerokosc_mm.value),
    wysokosc_mm: liczba(f.elements.wysokosc_mm.value),
    sposob: f.elements.sposob.value,
    dopasowanie: f.elements.dopasowanie.value,
  };
}

function odswiezPodglad() {
  const o = opcje();
  $('#format-dopasowanie-pole').hidden = o.sposob !== 'skaluj';
  const strona = stronaPodgladu();
  const sekcja = strona && stan.projekt.sekcje.find((s) => s.id === strona.sekcja);
  if (!sekcja) { $('#format-przed').innerHTML = ''; $('#format-po').innerHTML = ''; return; }
  $('#format-przed').innerHTML = schemat(sekcja, strona);
  // Po: ta sama zmiana na kopii (sekcja + jej strona + wzorce), bez ruszania projektu.
  const kopia = JSON.parse(JSON.stringify({ sekcje: [sekcja], strony: [strona], wzorce: [] }));
  zmienFormat(kopia, [sekcja.id], o, o);
  $('#format-po').innerHTML = schemat(kopia.sekcje[0], kopia.strony[0]);
  const poza = elementyPozaStrona(kopia, [sekcja.id]).length;
  const uwagi = [];
  if (poza) uwagi.push(`Na tej stronie ${poza} ${poza === 1 ? 'element wyjdzie' : 'elementy wyjdą'} poza stronę.`);
  const okl = stan.projekt.sekcje.filter((s) => zakres.includes(s.id) && s.okladka);
  if (okl.length) uwagi.push('Okładka zmieni się sama – liczy się z formatu środka.');
  $('#format-uwagi').textContent = uwagi.join(' ');
}

// zakresSekcji: lista id sekcji; null – cały projekt.
export function otworzZmianeFormatu(zakresSekcji = null) {
  const { projekt } = stan;
  zakres = zakresSekcji || projekt.sekcje.map((s) => s.id);
  const pierwsza = sekcjeZakresu()[0];
  if (!pierwsza) { powiadom(tt('zmianaFormatu.tuJestTylkoOkladka'), true); return; }
  const w = pierwsza.wydruk;
  const sel = f.elements.format;
  sel.replaceChildren();
  for (const [nazwa, [sz, wy]] of Object.entries(FORMATY)) sel.add(new Option(`${nazwa} (${sz} × ${wy} mm)`, nazwa));
  sel.add(new Option('Własny', 'wlasny'));
  sel.value = nazwaFormatu(w.szerokosc_mm, w.wysokosc_mm);
  f.elements.szerokosc_mm.value = w.szerokosc_mm;
  f.elements.wysokosc_mm.value = w.wysokosc_mm;
  f.elements.sposob.value = 'skaluj';
  f.elements.dopasowanie.value = 'zmiesc';
  const ile = sekcjeZakresu().length;
  $('#format-tytul').textContent = zakresSekcji ? tt('zmianaFormatu.zmienFormatSekcji') : tt('zmianaFormatu.zmienFormatProjektu');
  $('#format-zakres').textContent = zakresSekcji
    ? `Sekcja „${pierwsza.nazwa}” – ${projekt.strony.filter((s) => s.sekcja === pierwsza.id).length} str.`
    : `Wszystkie sekcje projektu (${ile})${projekt.sekcje.some((s) => s.okladka) ? ' – okładka przeliczy się sama' : ''}.`;
  odswiezPodglad();
  if (!dlg.open) dlg.showModal();
}

async function zastosuj() {
  const o = opcje();
  zapiszBiezacyCel();
  const { projekt } = stan;
  let wynik = null;
  await przedDlugaCzynnoscia('Zmiana formatu stron…', projekt.strony.length > 24, async () => {
    wynik = zmienFormat(projekt, zakres, o, o);
    if (!wynik.sekcje.length) return;
    przeliczOkladki(projekt); // okładka idzie za nowym formatem środka (#119)
    stan.miniatury.clear();
    await zaladujCel({ dopasuj: true });
  });
  if (!wynik.sekcje.length) { powiadom(tt('zmianaFormatu.formatSieNieZmienil')); return; }
  if (!edytor.aktywny) panel.zbuduj();
  zaplanujZapis();
  const poza = elementyPozaStrona(projekt, wynik.sekcje).length;
  const nazwa = nazwaFormatu(o.szerokosc_mm, o.wysokosc_mm);
  powiadom(`Nowy format: ${nazwa === 'wlasny' ? `${o.szerokosc_mm} × ${o.wysokosc_mm} mm` : nazwa} (${wynik.strony} str.${wynik.wzorce ? `, wzorce: ${wynik.wzorce}` : ''}).${poza ? ` Poza stroną: ${poza} – sprawdź ostrzeżenia.` : ''}`,
    Boolean(poza), { etykieta: tt('zmianaFormatu.cofnij'), fn: () => cofnijKrok(-1) });
}

f.elements.format.addEventListener('change', () => {
  const wym = FORMATY[f.elements.format.value];
  if (!wym) return;
  const poziomo = liczba(f.elements.szerokosc_mm.value) > liczba(f.elements.wysokosc_mm.value);
  f.elements.szerokosc_mm.value = poziomo ? Math.max(...wym) : wym[0];
  f.elements.wysokosc_mm.value = poziomo ? Math.min(...wym) : wym[1];
  odswiezPodglad();
});
for (const n of ['szerokosc_mm', 'wysokosc_mm']) {
  f.elements[n].addEventListener('input', () => {
    f.elements.format.value = nazwaFormatu(liczba(f.elements.szerokosc_mm.value), liczba(f.elements.wysokosc_mm.value));
    odswiezPodglad();
  });
}
f.addEventListener('change', (e) => { if (e.target.name === 'sposob' || e.target.name === 'dopasowanie') odswiezPodglad(); });
dlg.addEventListener('close', () => { if (dlg.returnValue === 'ok') zastosuj(); dlg.returnValue = ''; });

export function obrocFormat() {
  [f.elements.szerokosc_mm.value, f.elements.wysokosc_mm.value] = [f.elements.wysokosc_mm.value, f.elements.szerokosc_mm.value];
  f.elements.szerokosc_mm.dispatchEvent(new Event('input', { bubbles: true }));
}
