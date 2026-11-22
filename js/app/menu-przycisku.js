// Menu pod przyciskiem paska (#377): lista pozycji z ikonami – np. [Dymek ▾] (rodzaje dymków, efekt, mostek) i [AI ▾]
// (obraz, tekst, komiks). Zwykłe menu aplikacji (.menu): zamyka je klik obok, Esc i druga pozycja.
import { zamknijMenu } from '../ui.js';
import { ikona } from '../ikony.js';

let otwarte = null;
// pozycje: [{ ikona, tekst, opis?, wykonaj }] albo '-' (separator).
export function menuPrzy(przycisk, pozycje) {
  const bylo = otwarte?.przycisk === przycisk && !otwarte.menu.hidden;
  zamknijMenu();
  otwarte?.menu.remove();
  otwarte = null;
  if (bylo) return;
  const menu = document.createElement('div');
  menu.className = 'menu menu-przycisku';
  menu.setAttribute('role', 'menu');
  for (const p of pozycje) {
    if (p === '-') { menu.append(document.createElement('hr')); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.innerHTML = `${p.ikona ? ikona(p.ikona) : ''}<span><span class="tytul-pozycji"></span>${p.opis ? '<small class="ciche"></small>' : ''}</span>`;
    b.querySelector('.tytul-pozycji').textContent = p.tekst;
    if (p.opis) b.querySelector('small').textContent = p.opis;
    if (p.wartosc) b.dataset.wartosc = p.wartosc;
    b.addEventListener('click', () => { zamknijMenu(); menu.remove(); otwarte = null; p.wykonaj(); });
    menu.append(b);
  }
  document.body.append(menu);
  const r = przycisk.getBoundingClientRect();
  Object.assign(menu.style, { position: 'fixed', top: `${Math.round(r.bottom + 6)}px`, left: `${Math.round(r.left)}px`, right: 'auto' });
  const m = menu.getBoundingClientRect();
  if (m.right > window.innerWidth - 8) menu.style.left = `${Math.max(8, Math.round(window.innerWidth - 8 - m.width))}px`;
  if (m.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, Math.round(r.top - 6 - m.height))}px`;
  przycisk.setAttribute('aria-expanded', 'true');
  otwarte = { przycisk, menu };
  menu.querySelector('button')?.focus();
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); zamknijMenu(); menu.remove(); otwarte = null; przycisk.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const lista = [...menu.querySelectorAll('button')];
      const i = lista.indexOf(document.activeElement);
      lista[(i + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length]?.focus();
    }
  });
}
