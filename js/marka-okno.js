// Okno „Zestaw marki” (#131D) i podsumowanie w Ustawieniach konta. Bez edytora: działa z ustawień konta
// i z Biblioteki. Dane i zapis: js/zestaw-marki.js.

import { CZCIONKI } from './czcionki.js';
import { cmykNaRgb } from './kolory-druku.js';
import { biezacaMarka, wczytajMarke, zapiszMarke, dodajLogo, usunLogo, normalizujMarke, markaPusta } from './zestaw-marki.js';
import { wstawIkony } from './ikony.js';

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
    li.innerHTML = `<input type="color" aria-label="Kolor" value="${esc(k.kolor)}">
      <input type="text" class="nazwa" placeholder="Nazwa (np. Granat marki)" maxlength="60" value="${esc(k.nazwa)}" aria-label="Nazwa koloru">
      <input type="text" class="kod" maxlength="7" spellcheck="false" value="${esc(k.kolor)}" aria-label="Kod koloru">
      <label class="przelacznik-maly" title="Kolor dodatkowy do druku (np. Pantone) – osobna płyta w PDF"><input type="checkbox" class="spot"${k.cmyk ? ' checked' : ''}><span>Pantone / CMYK</span></label>
      <span class="cmyk"${k.cmyk ? '' : ' hidden'}>${['C', 'M', 'Y', 'K'].map((n, j) => `<label><span>${n}</span><input type="number" min="0" max="100" step="any" value="${k.cmyk?.[j] ?? 0}" inputmode="decimal"></label>`).join('')}</span>
      <button type="button" class="przycisk-ikona maly" data-ikona="kosz" title="Usuń kolor" aria-label="Usuń kolor"></button>`;
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
      <button type="button" class="przycisk-ikona maly" data-ikona="kosz" title="Usuń logo" aria-label="Usuń logo"></button>`;
    li.querySelector('.nazwa').textContent = l.nazwa;
    li.querySelector('button').addEventListener('click', async () => {
      try { robocza = normalizujMarke({ ...robocza, loga: (await usunLogo(l.id)).loga }); rysujLoga(); } catch (e) { komunikat(e.message, true); }
    });
    return li;
  }));
  ul.hidden = !robocza.loga.length;
  wstawIkony(ul);
}

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

export async function otworzMarke() {
  robocza = normalizujMarke(JSON.parse(JSON.stringify(await wczytajMarke())));
  komunikat('');
  rysujKolory();
  rysujCzcionki();
  rysujLoga();
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
  if (wiersz) wiersz.textContent = markaPusta(m) ? 'pusty' : `${m.kolory.length} kol. · ${m.loga.length} logo`;
  if (!el) return;
  if (markaPusta(m)) { el.innerHTML = '<p class="ciche">Zestaw jest pusty. Dodaj kolory, czcionki i logo – zobaczysz je potem w każdym projekcie.</p>'; return; }
  el.innerHTML = `<div class="probki-marki">${m.kolory.map((k) => `<span class="probka" style="background:${esc(k.kolor)}" title="${esc(k.nazwa || k.kolor)}"></span>`).join('')}</div>
    <p class="ciche">${[m.czcionki.naglowek && `Nagłówki: ${esc(m.czcionki.naglowek)}`, m.czcionki.tekst && `Tekst: ${esc(m.czcionki.tekst)}`, m.loga.length && `Logo: ${m.loga.length}`].filter(Boolean).join(' · ')}</p>`;
}

export async function odswiezMarkeWUstawieniach() {
  try { await wczytajMarke(); } catch { /* bez konta – pusto */ }
  pokazPodsumowanieMarki();
}
