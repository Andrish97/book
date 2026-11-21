// Okno „Zestaw marki” (#131D) i podsumowanie w Ustawieniach konta. Bez edytora: działa z ustawień konta
// i z Biblioteki. Dane i zapis: js/zestaw-marki.js.

import { CZCIONKI } from './czcionki.js';
import { cmykNaRgb } from './kolory-druku.js';
import {
  biezacaMarka, wczytajMarke, zapiszMarke, dodajLogo, usunLogo, normalizujMarke, markaPusta, ROLE_STYLOW, WIELKOSCI_LITER, gotowyStylMarki, normalizujStylMarki,
  listaZestawow, idZestawuMarki, wybierzZestaw, dodajZestaw, zmienNazweZestawu, usunZestaw,
} from './zestaw-marki.js';
import { wstawIkony } from './ikony.js';
import { wpiszNazwe, t as tt } from './jezyk.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
const dlg = $('#dlg-marka');
const f = $('#form-marka');
let robocza = null; // edytowana kopia zestawu

const hexZCmyk = (c) => `#${cmykNaRgb(c.map((v) => v / 100)).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function rysujKolory() {
  const ul = $('#marka-kolory');
  ul.replaceChildren(...robocza.kolory.map((k, i) => {
    const li = document.createElement('li');
    li.className = 'kolor-marki';
    li.innerHTML = `<input type="color" aria-label="${tt('markaOkno.kolor')}" value="${esc(k.kolor)}">
      <input type="text" class="nazwa" placeholder="${tt('markaOkno.nazwaNpGranatMarki')}" maxlength="60" value="${esc(k.nazwa)}" aria-label="${tt('markaOkno.nazwaKoloru')}">
      <input type="text" class="kod" maxlength="7" spellcheck="false" value="${esc(k.kolor)}" aria-label="Kod koloru">
      <label class="przelacznik-maly" title="${tt('markaOkno.kolorDodatkowyDoDruku')}"><input type="checkbox" class="spot"${k.cmyk ? ' checked' : ''}><span>Pantone / CMYK</span></label>
      <span class="cmyk"${k.cmyk ? '' : ' hidden'}>${['C', 'M', 'Y', 'K'].map((n, j) => `<label><span>${n}</span><input type="number" min="0" max="100" step="any" value="${k.cmyk?.[j] ?? 0}" inputmode="decimal"></label>`).join('')}</span>
      <button type="button" class="przycisk-ikona maly" data-ikona="kosz" title="${tt('markaOkno.usunKolor')}" aria-label="${tt('markaOkno.usunKolor')}"></button>`;
    const [wybor, nazwa, kod] = li.querySelectorAll('input[type="color"], input.nazwa, input.kod');
    const spot = li.querySelector('.spot');
    const cmyk = [...li.querySelectorAll('.cmyk input')];
    const ustawKolor = (h) => { k.kolor = h; wybor.value = h; kod.value = h; };
    wybor.addEventListener('input', () => ustawKolor(wybor.value));
    kod.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(kod.value.trim())) ustawKolor(kod.value.trim().toLowerCase()); else kod.value = k.kolor; });
    nazwa.addEventListener('input', () => { k.nazwa = nazwa.value; });
    const zCmyk = () => { k.cmyk = cmyk.map((x) => Math.max(0, Math.min(100, Number(x.value) || 0))); ustawKolor(hexZCmyk(k.cmyk)); };
    spot.addEventListener('change', () => {
      li.querySelector('.cmyk').hidden = !spot.checked;
      if (spot.checked) zCmyk(); else delete k.cmyk;
    });
    for (const x of cmyk) x.addEventListener('input', zCmyk);
    li.querySelector('[data-ikona="kosz"]').addEventListener('click', () => { robocza.kolory.splice(i, 1); rysujKolory(); });
    return li;
  }));
  wstawIkony(ul);
}

function rysujLoga() {
  const ul = $('#marka-loga');
  ul.replaceChildren(...robocza.loga.map((l) => {
    const li = document.createElement('li');
    li.className = 'logo-marki';
    li.innerHTML = `<span class="podglad">${l.podglad ? `<img src="${esc(l.podglad)}" alt="">` : ''}</span><span class="nazwa"></span>
      <button type="button" class="przycisk-ikona maly" data-ikona="kosz" title="${tt('markaOkno.usunLogo')}" aria-label="${tt('markaOkno.usunLogo')}"></button>`;
    wpiszNazwe(li.querySelector('.nazwa'), l.nazwa);
    li.querySelector('button').addEventListener('click', async () => {
      try { robocza = normalizujMarke({ ...robocza, loga: (await usunLogo(l.id)).loga }); rysujLoga(); } catch (e) { komunikat(e.message, true); }
    });
    return li;
  }));
  ul.hidden = !robocza.loga.length;
  wstawIkony(ul);
}

// Style tekstu marki (#167): każdy styl zwinięty do podglądu nazwy w jego wyglądzie; po rozwinięciu – wszystkie pola.
const WAGI = [['normal', 'Normalna'], ['300', 'Lekka'], ['600', 'Półgruba'], ['bold', 'Pogrubiona']];
function podgladStylu(el, s) {
  Object.assign(el.style, {
    fontFamily: `'${s.czcionka}'`, fontWeight: s.waga, fontStyle: s.kursywa ? 'italic' : 'normal', color: s.kolor,
    fontSize: `${Math.max(11, Math.min(26, s.rozmiar * 1.1))}px`, letterSpacing: `${s.odstep_liter / 1000}em`,
    textTransform: { wielkie: 'uppercase', male: 'lowercase' }[s.wielkosc_liter] || 'none', fontVariant: s.wielkosc_liter === 'kapitaliki' ? 'small-caps' : 'normal',
  });
}
function rysujStyle(otwarty = null) {
  const ul = $('#marka-style');
  const kolory = [...robocza.kolory.map((k) => [k.kolor, k.nazwa || k.kolor]), ['#1a1a1a', 'Czarny tekst'], ['#6b6861', 'Szary'], ['#ffffff', 'Biały']];
  const czcionki = [...new Set([robocza.czcionki.naglowek, robocza.czcionki.tekst, ...CZCIONKI.map((c) => c.nazwa)].filter(Boolean))];
  ul.replaceChildren(...robocza.style.map((s, i) => {
    const li = document.createElement('li');
    li.className = 'styl-marki';
    const opcje = (lista, v) => lista.map(([w, n]) => `<option value="${esc(w)}"${w === v ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const listaKolorow = kolory.some(([k]) => k === s.kolor) ? kolory : [...kolory, [s.kolor, s.kolor]];
    li.innerHTML = `<details${s.id === otwarty ? ' open' : ''}><summary><span class="proba-stylu"></span><small class="ciche"></small></summary>
      <div class="pola-stylu-marki">
        <label class="pole szeroko"><span>${tt('markaOkno.nazwa')}</span><input type="text" data-pole="nazwa" maxlength="60" value="${esc(s.nazwa)}"></label>
        <label class="pole szeroko"><span>${tt('markaOkno.czcionka')}</span><select data-pole="czcionka">${opcje([...(czcionki.includes(s.czcionka) ? [] : [s.czcionka]), ...czcionki].map((c) => [c, c]), s.czcionka)}</select></label>
        <label class="pole"><span>Rozmiar (pt)</span><input type="number" data-pole="rozmiar" min="4" max="400" step="any" inputmode="decimal" value="${s.rozmiar}"></label>
        <label class="pole"><span>${tt('markaOkno.waga')}</span><select data-pole="waga">${opcje(WAGI, s.waga)}</select></label>
        <label class="pole"><span>${tt('markaOkno.interlinia')}</span><input type="number" data-pole="interlinia" min="0.6" max="4" step="0.05" inputmode="decimal" value="${s.interlinia}"></label>
        <label class="pole"><span>Odstęp liter (‰)</span><input type="number" data-pole="odstep_liter" min="-200" max="2000" step="10" inputmode="numeric" value="${s.odstep_liter}"></label>
        <label class="pole"><span>${tt('markaOkno.kolor')}</span><select data-pole="kolor">${opcje(listaKolorow, s.kolor)}</select></label>
        <label class="pole"><span>${tt('markaOkno.wielkoscLiter')}</span><select data-pole="wielkosc_liter">${opcje(WIELKOSCI_LITER, s.wielkosc_liter)}</select></label>
        <label class="przelacznik szeroko"><input type="checkbox" data-pole="kursywa"${s.kursywa ? ' checked' : ''}><span>${tt('markaOkno.kursywa')}</span></label>
        <button type="button" class="przycisk maly niebezpieczny szeroko" data-usun>${tt('markaOkno.usunStyl')}</button>
      </div></details>`;
    const proba = li.querySelector('.proba-stylu');
    const opis = li.querySelector('summary small');
    const odswiez = () => {
      wpiszNazwe(proba, s.nazwa);
      podgladStylu(proba, s);
      opis.textContent = `${s.czcionka} · ${String(s.rozmiar).replace('.', ',')} pt${s.rola ? '' : ' · własny'}`;
    };
    for (const pole of li.querySelectorAll('[data-pole]')) {
      pole.addEventListener(pole.type === 'checkbox' || pole.tagName === 'SELECT' ? 'change' : 'input', () => {
        const k = pole.dataset.pole;
        const v = pole.type === 'checkbox' ? pole.checked : pole.value;
        Object.assign(s, normalizujStylMarki({ ...s, [k]: v }));
        odswiez();
      });
    }
    li.querySelector('[data-usun]').addEventListener('click', () => { robocza.style.splice(i, 1); rysujStyle(); });
    odswiez();
    return li;
  }));
  $('#marka-gotowe-style').hidden = ROLE_STYLOW.every(([r]) => robocza.style.some((s) => s.rola === r));
}
$('#marka-gotowe-style').addEventListener('click', () => {
  for (const [rola] of ROLE_STYLOW) if (!robocza.style.some((s) => s.rola === rola)) robocza.style.push(gotowyStylMarki(rola, robocza));
  rysujStyle();
});
$('#marka-dodaj-styl').addEventListener('click', () => {
  const s = normalizujStylMarki({ id: `sm${Date.now().toString(36)}`, nazwa: `Mój styl ${robocza.style.filter((x) => !x.rola).length + 1}`, czcionka: robocza.czcionki.tekst || 'Inter', rozmiar: 11, interlinia: 1.35 });
  robocza.style.push(s);
  rysujStyle(s.id);
  $('#marka-style li:last-child [data-pole="nazwa"]')?.select();
});

function rysujCzcionki() {
  const opcje = ['', ...CZCIONKI.map((c) => c.nazwa)];
  for (const pole of ['naglowek', 'tekst']) {
    const sel = f.elements[pole];
    sel.replaceChildren(...opcje.map((n) => new Option(n || '— bez czcionki marki —', n)));
    if (robocza.czcionki[pole] && !opcje.includes(robocza.czcionki[pole])) sel.add(new Option(robocza.czcionki[pole], robocza.czcionki[pole]));
    sel.value = robocza.czcionki[pole] || '';
  }
}

function komunikat(t, blad = false) {
  const k = $('#marka-komunikat');
  k.textContent = t;
  k.className = `komunikat${blad ? ' blad' : ''}`;
}

// Mały podgląd logo (do 160 px) – w spisie i w Bibliotece.
async function podgladLogo(blob) {
  try {
    const bmp = await window.createImageBitmap(blob);
    const s = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch { return ''; }
}

// ---------- Zestawy (#211) ----------

const wProjekcie = () => document.body.dataset.ekran === 'edytor' || document.body.dataset.ekran === 'podglad';
function rysujZestawy() {
  const lista = listaZestawow();
  const sel = $('#marka-zestaw');
  sel.innerHTML = lista.map((z) => `<option value="${esc(z.id)}">${esc(z.nazwa)}${z.pusty ? ' (pusty)' : ''}</option>`).join('');
  sel.value = idZestawuMarki() || '';
  $('#marka-zestaw-usun').disabled = lista.length <= 1;
  $('#marka-zestaw-opis').textContent = wProjekcie()
    ? tt('markaOkno.tenZestawJestMarka')
    : 'Zestaw w użyciu: marka projektów, które nie mają własnego zestawu. Każdy projekt może mieć swój – wybierz go tu przy otwartym projekcie.';
}
function zaladujRobocza() {
  robocza = normalizujMarke(JSON.parse(JSON.stringify(biezacaMarka())));
  rysujKolory();
  rysujCzcionki();
  rysujStyle();
  rysujLoga();
  rysujZestawy();
}
// Przejście na inny zestaw: zmiany w obecnym najpierw zapisane, potem wybór (projekt go zapamiętuje).
async function przejdzNaZestaw(id) {
  await zapiszMarke({ ...robocza, loga: biezacaMarka().loga });
  await wybierzZestaw(id);
  document.dispatchEvent(new CustomEvent('zestaw-marki-wybrany', { detail: id }));
  zaladujRobocza();
}
$('#marka-zestaw').addEventListener('change', async (e) => {
  try { await przejdzNaZestaw(e.target.value); } catch (blad) { komunikat(blad.message, true); rysujZestawy(); }
});
async function nowyZestaw(kopia) {
  const ui = await import('./ui.js');
  const nazwa = await ui.zapytajONazwe(kopia ? 'Kopia zestawu marki' : 'Nowy zestaw marki', 'Nazwa zestawu (np. klient, szkoła, wydawnictwo)', kopia ? `${biezacaMarka().nazwa || 'Marka'} (kopia)` : 'Nowa marka');
  if (!nazwa) return;
  try {
    await zapiszMarke({ ...robocza, loga: biezacaMarka().loga });
    const id = await dodajZestaw(nazwa, { kopiaZ: kopia ? idZestawuMarki() : null });
    document.dispatchEvent(new CustomEvent('zestaw-marki-wybrany', { detail: id }));
    zaladujRobocza();
  } catch (blad) { komunikat(blad.message, true); }
}
$('#marka-zestaw-nowy').addEventListener('click', () => nowyZestaw(false));
$('#marka-zestaw-kopia').addEventListener('click', () => nowyZestaw(true));
$('#marka-zestaw-nazwa').addEventListener('click', async () => {
  const ui = await import('./ui.js');
  const id = idZestawuMarki();
  const nazwa = await ui.zapytajONazwe('Zmień nazwę zestawu', 'Nazwa zestawu', biezacaMarka().nazwa || '');
  if (!nazwa) return;
  try { await zmienNazweZestawu(id, nazwa); rysujZestawy(); } catch (blad) { komunikat(blad.message, true); }
});
$('#marka-zestaw-usun').addEventListener('click', async () => {
  const ui = await import('./ui.js');
  const nazwa = biezacaMarka().nazwa || 'zestaw';
  if (!await ui.potwierdz(`Usunąć zestaw „${nazwa}”?`, 'Kolory, czcionki, style i logo tego zestawu znikną z konta. Projekty, które go używały, przejdą na zestaw w użyciu; to, co już jest na ich stronach, zostaje.', 'Usuń zestaw', true)) return;
  try {
    await usunZestaw(idZestawuMarki());
    document.dispatchEvent(new CustomEvent('zestaw-marki-wybrany', { detail: null }));
    zaladujRobocza();
  } catch (blad) { komunikat(blad.message, true); }
});

export async function otworzMarke() {
  await wczytajMarke();
  zaladujRobocza();
  komunikat('');
  if (!dlg.open) dlg.showModal();
}

$('#marka-dodaj-kolor').addEventListener('click', () => {
  robocza.kolory.push({ id: `km${Date.now().toString(36)}`, nazwa: '', kolor: '#1c2541' });
  rysujKolory();
  $('#marka-kolory li:last-child input.nazwa')?.focus();
});
$('#marka-plik-logo').addEventListener('change', async (e) => {
  const pliki = [...e.target.files];
  e.target.value = '';
  for (const plik of pliki) {
    try {
      komunikat(`Wysyłanie „${plik.name}”…`);
      robocza = normalizujMarke({ ...robocza, loga: (await dodajLogo(plik, plik.name, await podgladLogo(plik))).loga });
      rysujLoga();
      komunikat('');
    } catch (blad) { komunikat(blad.message, true); }
  }
});
f.elements.naglowek.addEventListener('change', () => { robocza.czcionki.naglowek = f.elements.naglowek.value; });
f.elements.tekst.addEventListener('change', () => { robocza.czcionki.tekst = f.elements.tekst.value; });
dlg.addEventListener('close', async () => {
  if (dlg.returnValue !== 'ok') return;
  dlg.returnValue = '';
  try {
    await zapiszMarke({ ...robocza, loga: biezacaMarka().loga });
    pokazPodsumowanieMarki();
    const ui = await import('./ui.js');
    ui.powiadom('Zapisano zestaw marki.');
  } catch (blad) {
    (await import('./ui.js')).powiadom(`Nie udało się zapisać zestawu marki: ${blad.message}`, true);
  }
});

// Podsumowanie w Ustawieniach konta: próbki kolorów, czcionki, liczba logo.
export async function pokazPodsumowanieMarki() {
  const el = $('#podsumowanie-marki');
  const m = biezacaMarka();
  const wiersz = document.querySelector('#ekran-konta [data-podsumowanie="marka"]');
  const zestawy = listaZestawow();
  const ile = zestawy.length > 1 ? ` · ${zestawy.length} zestawy` : '';
  if (wiersz) wiersz.textContent = (markaPusta(m) ? 'pusty' : `${m.kolory.length} kol. · ${m.style.length} styl. · ${m.loga.length} logo`) + ile;
  if (!el) return;
  const naglowek = zestawy.length > 1
    ? `<p class="ciche">W użyciu: <b>${esc(m.nazwa || '')}</b>. Zestawy: ${zestawy.map((z) => esc(z.nazwa)).join(', ')}.</p>` : '';
  if (markaPusta(m)) { el.innerHTML = `${naglowek}<p class="ciche">Zestaw jest pusty. Dodaj kolory, czcionki i logo – zobaczysz je potem w każdym projekcie.</p>`; return; }
  el.innerHTML = `${naglowek}<div class="probki-marki">${m.kolory.map((k) => `<span class="probka" style="background:${esc(k.kolor)}" title="${esc(k.nazwa || k.kolor)}"></span>`).join('')}</div>
    <p class="ciche">${[m.czcionki.naglowek && `Nagłówki: ${esc(m.czcionki.naglowek)}`, m.czcionki.tekst && `Tekst: ${esc(m.czcionki.tekst)}`, m.style.length && `Style tekstu: ${m.style.length}`, m.loga.length && `Logo: ${m.loga.length}`].filter(Boolean).join(' · ')}</p>`;
}

export async function odswiezMarkeWUstawieniach() {
  try { await wczytajMarke(); } catch { /* bez konta – pusto */ }
  pokazPodsumowanieMarki();
}
