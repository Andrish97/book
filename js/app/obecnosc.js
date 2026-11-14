// Obecność innych osób w otwartym projekcie (współpraca, decyzja #86): kółka z inicjałami w pasku edytora
// i podglądu, kropka przy stronie, na której ktoś jest, i obwódka w jego kolorze wokół elementu, który ma
// zaznaczony. Osoba to konto – dwa urządzenia tej samej osoby to jedno kółko, a samego siebie nie widać.
// Zmiany w treści przychodzą osobno, zwykłą drogą (zapis z wersją i łączenie, js/app/zapis.js).

import { dolaczDoProjektu, kolorOsoby } from '../wspolpraca-chmura.js';
import { nazwaUzytkownika } from '../chmura.js';
import { $ } from '../ui.js';
import { stan, edytor, biezacyCel } from './kontekst.js';

let polaczenie = null; // { projekt, zglos(), zamknij() }
let obecni = [];
let timer = null;

const inicjal = (t) => (String(t || '?').trim()[0] || '?').toUpperCase();

function gdzieJestem() {
  const ekran = document.body.dataset.ekran;
  let strona = null;
  try { strona = stan.projekt ? biezacyCel()?.id || null : null; } catch { strona = null; }
  return {
    strona,
    zaznaczone: ekran === 'edytor' ? edytor.aktywny?.id || null : null,
    oglada: ekran === 'podglad',
  };
}

function opisMiejsca(o) {
  if (o.oglada) return 'ogląda podgląd';
  const i = stan.projekt?.strony.findIndex((s) => s.id === o.strona) ?? -1;
  if (i >= 0) return `strona ${i + 1}`;
  if (stan.projekt?.wzorce?.some((w) => w.id === o.strona)) return 'edytuje wzorzec';
  return 'w projekcie';
}

function rysujKolka() {
  for (const kontener of document.querySelectorAll('.obecnosc')) {
    kontener.replaceChildren();
    kontener.hidden = obecni.length === 0;
    const widoczni = obecni.slice(0, 4);
    for (const o of widoczni) {
      const k = document.createElement('span');
      k.className = 'awatar-obecnosci';
      k.style.background = o.kolor || kolorOsoby(o.id);
      k.textContent = inicjal(o.nazwa);
      k.title = `${o.nazwa} – ${opisMiejsca(o)}`;
      k.setAttribute('aria-label', k.title);
      kontener.append(k);
    }
    if (obecni.length > widoczni.length) {
      const reszta = document.createElement('span');
      reszta.className = 'awatar-obecnosci reszta';
      reszta.textContent = `+${obecni.length - widoczni.length}`;
      reszta.title = obecni.slice(4).map((o) => o.nazwa).join(', ');
      kontener.append(reszta);
    }
  }
  // Kropka przy stronie (lista stron przebudowuje się często – reguła CSS przetrwa każdą przebudowę).
  let styl = $('#obecnosc-styl');
  if (!styl) {
    styl = document.createElement('style');
    styl.id = 'obecnosc-styl';
    document.head.append(styl);
  }
  const strony = new Map();
  for (const o of obecni) if (o.strona && !o.oglada && !strony.has(o.strona)) strony.set(o.strona, o);
  styl.textContent = [...strony].map(([id, o]) => `.lista-stron li[data-id="${CSS.escape(id)}"] .miniatura { box-shadow: 0 0 0 3px ${o.kolor}; }
.lista-stron li[data-id="${CSS.escape(id)}"]::after { content: ${JSON.stringify(inicjal(o.nazwa))}; background: ${o.kolor}; }`).join('\n');
  edytor.canvas?.requestRenderAll();
}

// Obwódka wokół elementu zaznaczonego przez kogoś innego, z jego inicjałem.
function rysujZaznaczenia(ctx) {
  if (!obecni.length || !edytor.canvas || document.body.dataset.ekran !== 'edytor') return;
  const v = edytor.canvas.viewportTransform;
  const X = (x) => v[4] + x * v[0];
  const Y = (y) => v[5] + y * v[3];
  const obiekty = edytor.canvas.getObjects();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = edytor.canvas.getRetinaScaling();
  ctx.scale(dpr, dpr);
  for (const o of obecni) {
    if (!o.zaznaczone) continue;
    const obj = obiekty.find((x) => x.id === o.zaznaczone);
    if (!obj) continue;
    const rogi = obj.getCoords();
    ctx.strokeStyle = o.kolor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    rogi.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    const x = Math.min(...rogi.map((p) => X(p.x)));
    const y = Math.min(...rogi.map((p) => Y(p.y)));
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    const napis = o.nazwa;
    const szer = ctx.measureText(napis).width + 10;
    ctx.fillStyle = o.kolor;
    ctx.fillRect(x, y - 18, szer, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(napis, x + 5, y - 6);
  }
  ctx.restore();
}

let podpiete = false;
function podepnijPlotno() {
  if (podpiete || !edytor.canvas) return;
  podpiete = true;
  edytor.canvas.on('after:render', (e) => rysujZaznaczenia(e.ctx));
}

async function zamknij() {
  clearInterval(timer);
  timer = null;
  obecni = [];
  rysujKolka();
  const p = polaczenie;
  polaczenie = null;
  await p?.zamknij();
}

async function otworz(projekt) {
  await zamknij();
  // Obecność ma sens dla projektu na koncie; projekt tylko w przeglądarce nikogo innego nie ma.
  if (!projekt || !stan.uzytkownik || !projekt.wersja_chmury) return;
  podepnijPlotno();
  const ja = {
    id: stan.uzytkownik.id,
    nazwa: nazwaUzytkownika(stan.uzytkownik),
    kolor: kolorOsoby(stan.uzytkownik.id),
    ...gdzieJestem(),
  };
  const id = projekt.id;
  try {
    const p = await dolaczDoProjektu(id, ja, (lista) => {
      if (stan.projekt?.id !== id) return;
      obecni = lista.map((o) => ({ ...o, kolor: o.kolor || kolorOsoby(o.id) }));
      rysujKolka();
    });
    if (stan.projekt?.id !== id) { await p.zamknij(); return; }
    polaczenie = { projekt: id, ...p };
  } catch {
    return; // bez kanału – bez obecności; współpraca działa dalej
  }
  timer = setInterval(() => polaczenie?.zglos(gdzieJestem()), 1000);
}

document.addEventListener('seriodruk:projekt', (e) => { otworz(e.detail); });
// Projekt zapisany na koncie pierwszy raz (np. przed zaproszeniem pierwszej osoby) – obecność rusza od razu.
document.addEventListener('seriodruk:zapisano-na-koncie', () => {
  if (stan.projekt && !polaczenie) otworz(stan.projekt);
});
window.addEventListener('pagehide', () => { polaczenie?.zamknij(); });
