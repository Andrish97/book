/* global fabric */
// Tekst na stronie na dotyku (#434): piszesz wprost na stronie jak w zwykłym polu – dotknięcie stawia kursor, klawiatura
// kasuje i wpisuje na miejscu, tekst od razu się przestawia. Tekst strony jest rysowany (nie jest polem przeglądarki),
// więc telefon nie pokazuje przy nim swoich uchwytów ani menu – dokładamy własne:
//  - przytrzymanie palca na tekście zaznacza wyraz i pokazuje menu Kopiuj / Wytnij / Wklej / Wszystko,
//  - dwa uchwyty na końcach zaznaczenia przeciąga się palcem (jak w systemie),
//  - dotknięcie gdzie indziej w tekście przestawia kursor i chowa menu.

import { powiadom } from '../ui.js';
import { t } from '../jezyk.js';

const naDotyku = () => window.matchMedia?.('(pointer: coarse)').matches || ['telefon', 'tablet'].includes(document.documentElement.dataset.urzadzenie);
const PRZYTRZYMANIE_MS = 450;

export function podlaczTekstDotyk(edytor) {
  const canvas = edytor.canvas;
  const el = canvas.upperCanvasEl;
  const uchwyty = ['poczatek', 'koniec'].map((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tekst-dotyk-uchwyt ${k}`;
    b.hidden = true;
    b.tabIndex = -1;
    b.setAttribute('aria-hidden', 'true');
    document.body.append(b);
    return b;
  });
  const menu = document.createElement('div');
  menu.className = 'tekst-dotyk-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'toolbar');
  document.body.append(menu);
  let menuWymuszone = false; // menu po przytrzymaniu także bez zaznaczenia (np. samo „Wklej”)

  const tekst = () => { const o = canvas.getActiveObject(); return o?.type === 'textbox' && o.isEditing ? o : null; };

  // Miejsce znaku idx na ekranie: { x, y – góra wiersza, h – wysokość wiersza } (px okna).
  function punktZnaku(o, idx) {
    const b = o._getCursorBoundaries(idx, true); // bez pamięci podręcznej kursora – inaczej każdy znak dostaje miejsce kursora
    const flip = new fabric.Point(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
    const scena = new fabric.Point(b.left + b.leftOffset, b.top + b.topOffset).multiply(flip).transform(o.calcTransformMatrix());
    const p = scena.transform(canvas.viewportTransform);
    const r = el.getBoundingClientRect();
    const css = r.width / (canvas.getWidth() || r.width || 1);
    const { lineIndex, charIndex } = o.get2DCursorLocation(idx);
    const h = (o.getValueOfPropertyAt(lineIndex, charIndex, 'fontSize') || o.fontSize) * o.lineHeight * (o.scaleY || 1) * canvas.getZoom() * css;
    return { x: r.left + p.x * css, y: r.top + p.y * css, h };
  }

  function ukryj() {
    uchwyty.forEach((u) => { u.hidden = true; });
    menu.hidden = true;
    menuWymuszone = false;
  }

  let klatka = 0;
  function odswiez() {
    cancelAnimationFrame(klatka);
    klatka = requestAnimationFrame(() => {
      const o = tekst();
      if (!o || !naDotyku()) { ukryj(); return; }
      const [a, z] = [o.selectionStart, o.selectionEnd];
      const zaznaczone = z > a;
      const pa = punktZnaku(o, a);
      const pz = zaznaczone ? punktZnaku(o, z) : pa;
      uchwyty[0].hidden = !zaznaczone;
      uchwyty[1].hidden = !zaznaczone;
      if (zaznaczone) {
        uchwyty[0].style.left = `${pa.x}px`; uchwyty[0].style.top = `${pa.y + pa.h}px`;
        uchwyty[1].style.left = `${pz.x}px`; uchwyty[1].style.top = `${pz.y + pz.h}px`;
      }
      if (!zaznaczone && !menuWymuszone) { menu.hidden = true; return; }
      menu.replaceChildren(...[
        zaznaczone && ['kopiuj', t('tekstDotyk.kopiuj')],
        zaznaczone && ['wytnij', t('tekstDotyk.wytnij')],
        ['wklej', t('tekstDotyk.wklej')],
        ['wszystko', t('tekstDotyk.zaznaczWszystko')],
      ].filter(Boolean).map(([akcja, napis]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.akcja = akcja;
        b.textContent = napis;
        return b;
      }));
      menu.hidden = false;
      const gora = Math.min(pa.y, pz.y) - 8;
      const x = zaznaczone && Math.abs(pa.y - pz.y) < 2 ? (pa.x + pz.x) / 2 : pa.x;
      menu.style.left = `${Math.max(8 + menu.offsetWidth / 2, Math.min(window.innerWidth - 8 - menu.offsetWidth / 2, x))}px`;
      menu.style.top = `${Math.max(menu.offsetHeight + 8, gora)}px`;
    });
  }

  // Zmiana tekstu z menu: tekst, ukryte pole klawiatury, zdarzenia (zapis, przelewanie) – jak przy pisaniu.
  function zmien(o, fn) {
    fn();
    o.initDimensions();
    o.setCoords();
    if (o.hiddenTextarea) o.hiddenTextarea.value = o.text;
    o._updateTextarea?.();
    o.fire('changed');
    canvas.fire('text:changed', { target: o });
    o.dirty = true;
    canvas.requestRenderAll();
  }
  function ustawZaznaczenie(o, a, z) {
    o.selectionStart = Math.max(0, Math.min(a, z));
    o.selectionEnd = Math.max(a, z);
    o._updateTextarea?.();
    o._fireSelectionChanged?.();
    canvas.requestRenderAll();
    odswiez();
  }

  async function kopiuj(o) {
    const s = o.getSelectedText?.() ?? o.text.slice(o.selectionStart, o.selectionEnd);
    try { await navigator.clipboard.writeText(s); } catch {
      o._updateTextarea?.();
      try { document.execCommand('copy'); } catch { /* bez schowka */ }
    }
    return s;
  }
  const akcje = {
    async kopiuj(o) { await kopiuj(o); menuWymuszone = false; ustawZaznaczenie(o, o.selectionEnd, o.selectionEnd); powiadom(t('tekstDotyk.skopiowano')); },
    async wytnij(o) {
      await kopiuj(o);
      const a = o.selectionStart;
      zmien(o, () => { o.removeChars(a, o.selectionEnd); });
      menuWymuszone = false;
      ustawZaznaczenie(o, a, a);
    },
    async wklej(o) {
      let s;
      try { s = await navigator.clipboard.readText(); } catch { powiadom(t('tekstDotyk.wklejNiedostepne'), true); return; }
      if (!s) return;
      const a = o.selectionStart;
      const z = o.selectionEnd;
      zmien(o, () => {
        if (z > a) o.removeChars(a, z);
        o.insertChars(s, null, a, a);
      });
      const koniec = a + o.graphemeSplit(s).length;
      menuWymuszone = false;
      ustawZaznaczenie(o, koniec, koniec);
    },
    wszystko(o) { menuWymuszone = true; ustawZaznaczenie(o, 0, o._text.length); },
  };
  // Przyciski menu nie zabierają klawiatury (pointerdown bez domyślnego działania) – pisanie trwa.
  menu.addEventListener('pointerdown', (e) => e.preventDefault());
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-akcja]');
    const o = tekst();
    if (b && o) akcje[b.dataset.akcja]?.(o);
  });

  // Przeciąganie uchwytów: miejsce w tekście pod palcem (trochę nad uchwytem – palec nie zasłania znaku).
  uchwyty.forEach((u, i) => {
    u.addEventListener('pointerdown', (e) => {
      const o = tekst();
      if (!o) return;
      e.preventDefault();
      try { u.setPointerCapture(e.pointerId); } catch { /* zdarzenie bez aktywnego wskaźnika */ }
      const staly = i === 0 ? o.selectionEnd : o.selectionStart;
      const ruch = (ev) => {
        const h = punktZnaku(o, i === 0 ? o.selectionStart : o.selectionEnd).h;
        const idx = o.getSelectionStartFromPointer({ clientX: ev.clientX, clientY: ev.clientY - h * 0.8, target: el });
        if (idx === staly) return;
        ustawZaznaczenie(o, staly, idx);
      };
      const koniec = () => { u.removeEventListener('pointermove', ruch); u.removeEventListener('pointerup', koniec); u.removeEventListener('pointercancel', koniec); odswiez(); };
      u.addEventListener('pointermove', ruch);
      u.addEventListener('pointerup', koniec);
      u.addEventListener('pointercancel', koniec);
    });
  });

  // Przytrzymanie palca na tekście: zaznacza wyraz pod palcem i pokazuje menu.
  let czas = 0;
  let start = null;
  el.addEventListener('pointerdown', (e) => {
    clearTimeout(czas);
    if (e.pointerType !== 'touch' && !naDotyku()) return;
    const o = canvas.getActiveObject();
    if (o?.type !== 'textbox') return;
    start = { x: e.clientX, y: e.clientY };
    czas = setTimeout(() => {
      const scena = canvas.getScenePoint(e);
      if (!o.containsPoint(scena)) return;
      if (!o.isEditing) o.enterEditing();
      const idx = o.getSelectionStartFromPointer(e);
      const wyraz = /\S/.test(o._text[idx] || '') || /\S/.test(o._text[idx - 1] || '');
      menuWymuszone = true;
      if (wyraz) {
        o.selectWord(/\S/.test(o._text[idx] || '') ? idx : idx - 1);
        o._updateTextarea?.();
        o._fireSelectionChanged?.();
      } else ustawZaznaczenie(o, idx, idx);
      navigator.vibrate?.(10);
      canvas.requestRenderAll();
      odswiez();
    }, PRZYTRZYMANIE_MS);
  }, { capture: true });
  el.addEventListener('pointermove', (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) clearTimeout(czas); });
  const pusc = () => { clearTimeout(czas); start = null; };
  el.addEventListener('pointerup', pusc);
  el.addEventListener('pointercancel', pusc);
  el.addEventListener('contextmenu', (e) => { if (tekst() || canvas.getActiveObject()?.type === 'textbox') e.preventDefault(); });

  // Krótkie dotknięcie w tekście przestawia kursor (robi to Fabric) – menu bez zaznaczenia znika.
  canvas.on('mouse:down', () => { if (!tekst()) return; menuWymuszone = false; odswiez(); });
  for (const z of ['text:selection:changed', 'text:changed', 'text:editing:entered', 'after:render']) canvas.on(z, odswiez);
  canvas.on('text:editing:exited', ukryj);
  canvas.on('selection:cleared', ukryj);
  window.addEventListener('resize', odswiez);
  window.visualViewport?.addEventListener('resize', odswiez);
  window.visualViewport?.addEventListener('scroll', odswiez);
  document.addEventListener('scroll', odswiez, true);
}
