// Wspólne elementy interfejsu: wybieranie elementów, powiadomienia, okna
// potwierdzeń, menu rozwijane, pobieranie plików.

export const $ = (sel, korzen = document) => korzen.querySelector(sel);
export const $$ = (sel, korzen = document) => [...korzen.querySelectorAll(sel)];

let timerPowiadomienia = null;
// akcja: opcjonalnie { etykieta, fn } – przycisk w powiadomieniu (np. „Cofnij”).
export function powiadom(tekst, blad = false, akcja = null) {
  const el = $('#powiadomienie');
  el.textContent = tekst;
  if (akcja) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = akcja.etykieta;
    b.addEventListener('click', () => { el.hidden = true; akcja.fn(); });
    el.append(b);
  }
  el.classList.toggle('blad', blad);
  el.hidden = false;
  clearTimeout(timerPowiadomienia);
  timerPowiadomienia = setTimeout(() => { el.hidden = true; }, akcja ? 9000 : (blad ? 6000 : 3000));
}

export function potwierdz(tytul, tresc, tak = 'OK', niebezpieczne = false, nie = 'Anuluj') {
  const dlg = $('#dlg-potwierdz');
  $('#potwierdz-tytul').textContent = tytul;
  $('#potwierdz-tresc').textContent = tresc;
  const b = $('#potwierdz-tak');
  b.textContent = tak;
  $('#potwierdz-nie').textContent = nie;
  b.style.background = niebezpieczne ? 'var(--blad)' : '';
  b.style.borderColor = niebezpieczne ? 'var(--blad)' : '';
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((ok) => dlg.addEventListener('close', () => ok(dlg.returnValue === 'tak'), { once: true }));
}

export function zapytajONazwe(tytul, etykieta, wartosc) {
  const dlg = $('#dlg-nazwa');
  $('#nazwa-tytul').textContent = tytul;
  $('#nazwa-etykieta').textContent = etykieta;
  const input = dlg.querySelector('input');
  input.value = wartosc;
  dlg.returnValue = '';
  dlg.showModal();
  input.select();
  return new Promise((ok) => dlg.addEventListener('close', () => {
    const v = input.value.trim();
    ok(dlg.returnValue === 'tak' && v ? v : null);
  }, { once: true }));
}

export function zamknijMenu() {
  $$('.menu').forEach((m) => { m.hidden = true; });
  $$('[aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

export function przelaczMenu(przycisk, menu) {
  const bylo = !menu.hidden;
  zamknijMenu();
  if (bylo) return;
  menu.hidden = false;
  przycisk.setAttribute('aria-expanded', 'true');
}

document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.menu, [aria-haspopup="menu"]')) zamknijMenu();
});

export function pobierz(nazwa, url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.append(a);
  a.click();
  a.remove();
}

export const bezpiecznaNazwa = (s) => (s || 'projekt').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'projekt';

export function kiedy(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const roznica = (Date.now() - d.getTime()) / 1000;
  if (roznica < 60) return 'przed chwilą';
  if (roznica < 3600) return `${Math.floor(roznica / 60)} min temu`;
  const dzis = new Date();
  if (d.toDateString() === dzis.toDateString()) return `dziś, ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: d.getFullYear() === dzis.getFullYear() ? undefined : 'numeric' });
}
