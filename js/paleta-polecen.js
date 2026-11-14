// Paleta poleceń (Ctrl+K / ⌘K, decyzja #103): wyszukiwarka działań aplikacji dla samodzielnej pracy – zamiast
// szukać przycisku w menu wpisujesz kilka liter („pdf”, „dane”, „wzorce”, „obraz”) i Enter.
// Lista powstaje z przycisków z data-akcja widocznych na bieżącym ekranie (także z menu ⋯ i menu konta),
// więc obejmuje to samo, co da się kliknąć, i nic nie trzeba dopisywać przy nowych przyciskach.

const normalizuj = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

function widoczny(el) {
  if (el.disabled || el.closest('dialog:not([open])') || el.closest('#paleta-polecen')) return false;
  const menu = el.closest('.menu');
  if (menu) {
    const wlasciciel = menu.parentElement;
    return Boolean(wlasciciel && wlasciciel.offsetParent !== null && !wlasciciel.closest('[hidden]'));
  }
  return el.offsetParent !== null;
}

function etykieta(el) {
  const tekst = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return (el.getAttribute('aria-label') || '').trim() || tekst || (el.title || '').split(/[(–.]/)[0].trim();
}

// Polecenia dostępne teraz: [{ nazwa, opis, el }].
export function polecenia() {
  const wynik = [];
  const byly = new Set();
  for (const el of document.querySelectorAll('button[data-akcja], [role="menuitem"][data-akcja]')) {
    if (!widoczny(el)) continue;
    const nazwa = etykieta(el);
    if (!nazwa || nazwa.length < 2) continue;
    const klucz = `${el.dataset.akcja}|${normalizuj(nazwa)}`;
    if (byly.has(klucz)) continue;
    byly.add(klucz);
    wynik.push({ nazwa, opis: el.title && el.title !== nazwa ? el.title : '', el });
  }
  return wynik;
}

function pasuje(p, zapytanie) {
  const z = normalizuj(zapytanie).trim();
  if (!z) return 1;
  const t = normalizuj(`${p.nazwa} ${p.opis}`);
  if (normalizuj(p.nazwa).startsWith(z)) return 3;
  if (t.split(/\s+/).some((s) => s.startsWith(z))) return 2;
  return t.includes(z) ? 1 : 0;
}

let okno = null;

function zbuduj() {
  okno = document.createElement('dialog');
  okno.id = 'paleta-polecen';
  okno.className = 'paleta-polecen';
  okno.setAttribute('aria-label', 'Szukaj polecenia');
  okno.innerHTML = '<input type="search" class="paleta-pole" placeholder="Szukaj polecenia… (np. pdf, dane, obraz)" aria-label="Szukaj polecenia" autocomplete="off" spellcheck="false">'
    + '<ul class="paleta-lista" role="listbox" aria-label="Polecenia"></ul><p class="paleta-pusto ciche" hidden>Nic nie pasuje.</p>';
  document.body.append(okno);
  const pole = okno.querySelector('.paleta-pole');
  const lista = okno.querySelector('.paleta-lista');
  let wybrany = 0;
  let wszystkie = [];
  let widoczne = [];
  const wykonaj = (p) => {
    okno.close();
    p.el.click();
  };
  const rysuj = () => {
    widoczne = wszystkie.map((p) => ({ p, w: pasuje(p, pole.value) })).filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w).slice(0, 12).map((x) => x.p);
    wybrany = Math.min(wybrany, Math.max(0, widoczne.length - 1));
    lista.replaceChildren(...widoczne.map((p, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === wybrany));
      const n = document.createElement('span');
      n.textContent = p.nazwa;
      li.append(n);
      if (p.opis) {
        const o = document.createElement('span');
        o.className = 'ciche';
        o.textContent = p.opis;
        li.append(o);
      }
      li.addEventListener('click', () => wykonaj(p));
      return li;
    }));
    okno.querySelector('.paleta-pusto').hidden = widoczne.length > 0;
  };
  pole.addEventListener('input', () => { wybrany = 0; rysuj(); });
  pole.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { wybrany = Math.min(widoczne.length - 1, wybrany + 1); rysuj(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { wybrany = Math.max(0, wybrany - 1); rysuj(); e.preventDefault(); }
    else if (e.key === 'Enter' && widoczne[wybrany]) { e.preventDefault(); wykonaj(widoczne[wybrany]); }
  });
  okno.addEventListener('click', (e) => { if (e.target === okno) okno.close(); });
  okno.otworz = () => {
    wszystkie = polecenia();
    pole.value = '';
    wybrany = 0;
    rysuj();
    okno.showModal();
    pole.focus();
  };
}

export function otworzPalete() {
  if (!okno) zbuduj();
  if (okno.open || document.querySelector('dialog[open]')) return;
  okno.otworz();
}

export function wlaczPalete() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      otworzPalete();
    }
  });
}
