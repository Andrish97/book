// Okno „Usuń tło” (decyzja #123): różdżka po kolorze, pędzel usuwania i przywracania, wygładzenie krawędzi,
// podgląd na szachownicy, Cofnij. Wszystko w przeglądarce, bez AI. Wynik zapisuje się jako NOWY plik PNG
// w obrazach projektu i trafia do zaznaczonego obrazu (albo kształtu z obrazem); oryginał zostaje w projekcie.

import { $, powiadom } from '../ui.js';
import { stan, edytor } from './kontekst.js';
import { blobZasobu } from '../zasoby.js';
import { przyjmijPlik } from '../obrazy-projektu.js';
import { maObraz } from '../obraz-w-ksztalcie.js';
import { rozdzka, pociagniecie, wygladz, skladaj, KOD_WATKU } from '../usun-tlo-rdzen.js';
import { panel } from './skladniki.js';

const MAKS_BOK = 4096; // większe zdjęcia są zmniejszane do pracy (druk 300 dpi: ok. 35 cm boku)
const MAKS_COFNIEC = 12;

const dlg = $('#dlg-usun-tlo');
const plotno = $('#usun-tlo-plotno');
const ctx = plotno.getContext('2d', { willReadFrequently: true });
const st = { obj: null, zasob: null, nazwa: '', szer: 0, wys: 0, dane: null, maska: null, cofnij: [], tryb: 'rozdzka', ostatni: null, zapisuje: false };
let watek = null;

function stanTekst(t) { $('#usun-tlo-stan').textContent = t; }

function rysuj() {
  if (!st.dane) return;
  const krycie = wygladz(st.maska, st.szer, st.wys, wartosc('#usun-tlo-wygladzenie'));
  ctx.putImageData(new window.ImageData(skladaj(st.dane, krycie), st.szer, st.wys), 0, 0);
}
let klatka = 0;
const rysujPozniej = () => { cancelAnimationFrame(klatka); klatka = requestAnimationFrame(rysuj); };

function zapamietaj() {
  st.cofnij.push(new Uint8Array(st.maska));
  if (st.cofnij.length > MAKS_COFNIEC) st.cofnij.shift();
  $('#usun-tlo-cofnij').disabled = false;
}

function ustawTryb(t) {
  st.tryb = t;
  for (const b of $('#usun-tlo-tryb').querySelectorAll('[data-tryb]')) b.setAttribute('aria-pressed', String(b.dataset.tryb === t));
  $('#usun-tlo-pedzel-pole').hidden = t === 'rozdzka';
  for (const id of ['#usun-tlo-tolerancja', '#usun-tlo-ciagle']) $(id).closest('label').hidden = t !== 'rozdzka';
  plotno.style.cursor = t === 'rozdzka' ? 'crosshair' : 'cell';
}

// Różdżka – w osobnym wątku przy dużych zdjęciach (okno nie zamarza); gdy wątku nie ma, na miejscu.
function rozdzkaWTle(x, y) {
  const parametry = { dane: st.dane, szer: st.szer, wys: st.wys, maska: st.maska, x, y, tolerancja: wartosc('#usun-tlo-tolerancja'), ciagle: $('#usun-tlo-ciagle').checked };
  if (st.szer * st.wys < 1.5e6 || typeof window.Worker === 'undefined') return Promise.resolve(rozdzka(...Object.values(parametry)));
  try {
    watek = watek || new window.Worker(URL.createObjectURL(new Blob([KOD_WATKU], { type: 'text/javascript' })));
  } catch { return Promise.resolve(rozdzka(...Object.values(parametry))); }
  return new Promise((ok) => {
    watek.onmessage = (e) => ok(e.data);
    watek.onerror = () => ok(rozdzka(...Object.values(parametry)));
    watek.postMessage(parametry);
  });
}

// Punkt zdarzenia w pikselach obrazu.
function wObrazie(e) {
  const r = plotno.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * st.szer, y: ((e.clientY - r.top) / r.height) * st.wys, skala: st.szer / r.width };
}

plotno.addEventListener('pointerdown', async (e) => {
  if (!st.dane || st.zapisuje) return;
  e.preventDefault();
  const p = wObrazie(e);
  zapamietaj();
  if (st.tryb === 'rozdzka') {
    stanTekst('Usuwam…');
    st.maska = await rozdzkaWTle(p.x, p.y);
    stanTekst('Kliknij kolejne miejsce tła albo popraw brzegi pędzlem.');
    rysujPozniej();
    return;
  }
  plotno.setPointerCapture(e.pointerId);
  st.ostatni = p;
  const r = (wartosc('#usun-tlo-pedzel') / 2) * p.skala;
  pociagniecie(st.maska, st.szer, st.wys, p, p, r, st.tryb === 'usun' ? 0 : 255);
  rysujPozniej();
});
plotno.addEventListener('pointermove', (e) => {
  if (!st.ostatni) return;
  const p = wObrazie(e);
  const r = (wartosc('#usun-tlo-pedzel') / 2) * p.skala;
  pociagniecie(st.maska, st.szer, st.wys, st.ostatni, p, r, st.tryb === 'usun' ? 0 : 255);
  st.ostatni = p;
  rysujPozniej();
});
for (const z of ['pointerup', 'pointercancel']) plotno.addEventListener(z, () => { st.ostatni = null; });

$('#usun-tlo-tryb').addEventListener('click', (e) => { const b = e.target.closest('[data-tryb]'); if (b) ustawTryb(b.dataset.tryb); });
// Liczby w polach: poza zakresem – przycięte do najbliższej dozwolonej.
const wartosc = (id) => { const el = $(id); const v = Number(el.value); return Math.min(Number(el.max), Math.max(Number(el.min), Number.isFinite(v) ? v : Number(el.defaultValue))); };
$('#usun-tlo-wygladzenie').addEventListener('input', rysujPozniej);
$('#usun-tlo-cofnij').addEventListener('click', () => {
  const m = st.cofnij.pop();
  if (m) { st.maska = m; rysujPozniej(); }
  $('#usun-tlo-cofnij').disabled = !st.cofnij.length;
});
$('#usun-tlo-odnowa').addEventListener('click', () => { if (!st.maska) return; zapamietaj(); st.maska.fill(255); rysujPozniej(); });
dlg.addEventListener('close', () => { st.dane = null; st.maska = null; st.cofnij = []; st.obj = null; });

$('#usun-tlo-zapisz').addEventListener('click', async () => {
  if (!st.dane || st.zapisuje) return;
  if (!st.maska.some((v) => v < 255)) { powiadom('Nic nie zostało usunięte – kliknij różdżką w tło.'); return; }
  st.zapisuje = true;
  $('#usun-tlo-zapisz').disabled = true;
  stanTekst('Zapisuję…');
  try {
    rysuj();
    const blob = await new Promise((ok) => plotno.toBlob(ok, 'image/png'));
    const baza = (st.nazwa || 'obraz').replace(/\.[a-z0-9]+$/i, '');
    const { id, nazwa } = await przyjmijPlik(stan.projekt, blob, `${baza}-bez-tla.png`);
    const obj = st.obj;
    if (obj?.type === 'image') await edytor.podmienObraz(obj, null, nazwa, stan.projekt.zasoby, { id });
    else if (maObraz(obj)) { const kadr = obj.obraz_kadr; await edytor.wstawObrazDoKsztaltu(obj, id); obj.obraz_kadr = kadr; edytor.canvas.requestRenderAll(); }
    panel.zbuduj();
    dlg.close();
    powiadom(`Zapisano „${nazwa}”. Oryginał został w obrazach projektu.`);
  } catch (e) {
    powiadom(e.message || 'Nie udało się zapisać obrazu.', true);
  } finally {
    st.zapisuje = false;
    $('#usun-tlo-zapisz').disabled = false;
  }
});

// obj: zaznaczony obraz albo kształt z obrazem.
export async function otworzUsuwanieTla(obj) {
  const zasob = obj?.zasob;
  if (!zasob || !stan.projekt?.zasoby?.[zasob]) { powiadom('Ten element nie ma obrazu.'); return; }
  if (/svg/i.test(stan.projekt.zasoby[zasob].typ || '') || /\.svg$/i.test(stan.projekt.zasoby[zasob].nazwa || '')) { powiadom('Rysunek SVG ma już przezroczyste tło – usuń zbędne kształty po „Rozłóż rysunek na elementy”.'); return; }
  Object.assign(st, { obj, zasob, nazwa: stan.projekt.zasoby[zasob].nazwa, cofnij: [], dane: null, maska: null });
  $('#usun-tlo-cofnij').disabled = true;
  ustawTryb('rozdzka');
  stanTekst('Wczytuję obraz…');
  ctx.clearRect(0, 0, plotno.width, plotno.height);
  if (!dlg.open) dlg.showModal();
  try {
    const blob = await blobZasobu(stan.projekt, zasob);
    if (!blob) throw new Error('Nie ma oryginału tego obrazu na urządzeniu – otwórz projekt z internetem i spróbuj jeszcze raz.');
    const bitmapa = await window.createImageBitmap(blob);
    const skala = Math.min(1, MAKS_BOK / Math.max(bitmapa.width, bitmapa.height));
    st.szer = Math.max(1, Math.round(bitmapa.width * skala));
    st.wys = Math.max(1, Math.round(bitmapa.height * skala));
    plotno.width = st.szer;
    plotno.height = st.wys;
    ctx.clearRect(0, 0, st.szer, st.wys);
    ctx.drawImage(bitmapa, 0, 0, st.szer, st.wys);
    bitmapa.close?.();
    st.dane = ctx.getImageData(0, 0, st.szer, st.wys).data;
    st.maska = new Uint8Array(st.szer * st.wys).fill(255);
    stanTekst(skala < 1
      ? `Kliknij w tło, żeby je usunąć. Duże zdjęcie – nowy plik będzie miał ${st.szer} × ${st.wys} px.`
      : 'Kliknij w tło, żeby je usunąć. Brzegi popraw pędzlem „Usuń” i „Przywróć”.');
    rysuj();
  } catch (e) {
    stanTekst(e.message || 'Nie udało się wczytać obrazu.');
  }
}
