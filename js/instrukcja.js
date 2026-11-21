// Instrukcja – podręcznik aplikacji (decyzja #114), w układzie podręcznika Familiady:
// części → rozdziały (każdy na osobnej stronie) → numerowane podrozdziały.
// Treść: js/instrukcja-tresc.js, budowana skryptem scripts/instrukcja-buduj.cjs z docs/instrukcja/*.md.
// Zrzuty: img/instrukcja/*.png (ciemne w img/instrukcja/ciemny/), robi je scripts/zrzuty-instrukcji.cjs.
//
// Nawigacja: strona główna (części z listą rozdziałów), spis z lewej – części, rozdziały, a przy
// otwartym rozdziale jego podrozdziały; Poprzedni / Następny w stopce. Na wąskim ekranie spis otwiera
// przycisk z nazwą bieżącego rozdziału, a podrozdziały pokazuje „W tym rozdziale” nad treścią.

import { wstawIkony } from './ikony.js';
import { SKROTY, opisKlawiszy } from './skroty.js';
import { POLA_DOKUMENTU, ZAPISY_LICZB } from './pola.js';
import { czyCiemny } from './motyw.js';
import { biezacyJezyk, t as tt } from './jezyk.js';
import { CZESCI as CZESCI_PL, ROZDZIALY as ZRODLO_PL } from './instrukcja-tresc.js';
// Klawisze skrótu: „Ctrl++” to Ctrl i plus – plus jako klawisz nie może zniknąć przy dzieleniu (#174).
const klawiszeSkrotu = (t) => t.split(/\+(?!$)/).map((k) => k || '+');


// Rozdziały z nazwą części (grupa) i tekstem do wyszukiwania (rozdział i każdy podrozdział).
const naTekst = (html) => String(html || '').replace(/<pre>[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const zGrupa = (lista) => lista.map((r) => ({ ...r, grupa: r.czesc }));
// Treść w języku interfejsu (#346): js/instrukcja-tresc-<język>.js – ta sama budowa co po polsku; brak pliku – polska.
export let ROZDZIALY = zGrupa(ZRODLO_PL);
export let CZESCI = CZESCI_PL;
const TRESCI = { en: () => import('./instrukcja-tresc-en.js'), uk: () => import('./instrukcja-tresc-uk.js') };
let jezykTresci = 'pl';
export async function wczytajTrescInstrukcji(j = biezacyJezyk()) {
  if (j === jezykTresci) return false;
  let m = { CZESCI: CZESCI_PL, ROZDZIALY: ZRODLO_PL };
  if (TRESCI[j]) { try { m = await TRESCI[j](); } catch { m = { CZESCI: CZESCI_PL, ROZDZIALY: ZRODLO_PL }; } }
  CZESCI = m.CZESCI;
  ROZDZIALY = zGrupa(m.ROZDZIALY);
  jezykTresci = j;
  return true;
}
export const tekstRozdzialu = (r) => naTekst(`${r.tytul} ${r.sekcje.map((s) => `${s.tytul} ${s.html}`).join(' ')}`);

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function tabelaPol() {
  const pola = POLA_DOKUMENTU.map(([nazwa, opis]) => `<tr><td><code>{${nazwa}}</code></td><td>${opis.replace(/\{[^}]+\}/g, (m) => `<code>${m}</code>`)}</td></tr>`).join('');
  const zapisy = ZAPISY_LICZB.map(([zapis, opis]) => `<tr><td><code>{nr${zapis ? `:${zapis}` : ''}}</code></td><td>${opis}</td></tr>`).join('');
  return `<div class="tabela-instrukcji"><table><thead><tr><th>${tt('instrukcja.pole')}</th><th>${tt('instrukcja.znaczenie')}</th></tr></thead><tbody>${pola}</tbody></table></div>`
    + `<h4>${tt('instrukcja.zapisLiczby')}</h4><div class="tabela-instrukcji"><table><thead><tr><th>${tt('instrukcja.zapis')}</th><th>${tt('instrukcja.znaczenie')}</th></tr></thead><tbody>${zapisy}</tbody></table></div>`;
}

function tabelaSkrotow() {
  const grupy = [];
  for (const s of SKROTY) {
    let g = grupy.find((x) => x.nazwa === s.grupa);
    if (!g) { g = { nazwa: s.grupa, wiersze: [] }; grupy.push(g); }
    g.wiersze.push(`<tr><td>${klawiszeSkrotu(opisKlawiszy(s)).map((k) => `<kbd>${k}</kbd>`).join(' ')}</td><td>${s.opis}</td></tr>`);
  }
  return grupy.map((g) => `<h4>${g.nazwa}</h4><div class="tabela-instrukcji"><table class="skroty"><tbody>${g.wiersze.join('')}</tbody></table></div>`).join('');
}

async function kopiujTekst(tekst) {
  try { await navigator.clipboard.writeText(tekst); return true; } catch { /* niżej */ }
  const t = document.createElement('textarea');
  t.value = tekst; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.append(t); t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}

const idSekcji = (id) => `s-${String(id).replace(/\./g, '-')}`;
const rozdzialNr = (nr) => ROZDZIALY.findIndex((r) => r.nr === String(nr));

export class Instrukcja {
  constructor() {
    this.dlg = document.getElementById('dlg-instrukcja');
    this.uklad = this.dlg.querySelector('.instrukcja');
    this.spis = document.getElementById('instrukcja-rozdzialy');
    this.tresc = document.getElementById('instrukcja-tresc');
    this.numer = document.getElementById('instrukcja-numer');
    this.wstecz = document.getElementById('instrukcja-wstecz');
    this.dalej = document.getElementById('instrukcja-dalej');
    this.wybor = document.getElementById('instrukcja-wybor');
    this.szukaj = document.getElementById('instrukcja-szukaj');
    this.indeks = -1; // -1 = strona główna instrukcji
    this.przygotujTresc();
    // Zmiana motywu przy otwartej instrukcji podmienia zrzuty na pasujące.
    document.addEventListener('motyw', () => { if (this.dlg?.open) this.pokaz(this.indeks, { przewin: false }); });
    // Nowy język: treść instrukcji i zrzuty w tym języku (#334, #346).
    document.addEventListener('jezyk', async () => {
      await wczytajTrescInstrukcji();
      this.przygotujTresc();
      if (this.dlg?.open) this.pokaz(this.indeks, { przewin: false });
    });
    this.szukaj?.addEventListener('input', () => this.filtruj(this.szukaj.value));
    this.wybor?.addEventListener('click', () => this.przelaczSpis());
    this.dlg.querySelector('[data-akcja="instrukcja-spis-zamknij"]')?.addEventListener('click', () => this.przelaczSpis(false));
    this.dlg.querySelector('.instrukcja-tlo-spisu')?.addEventListener('click', () => this.przelaczSpis(false));

    // Kliknięcia w spisie, okruszkach, na stronie głównej i w treści: rozdział, podrozdział, kopiowanie, powiększenie obrazu.
    this.dlg.addEventListener('click', async (e) => {
      const start = e.target.closest('[data-instrukcja-start]');
      if (start) { e.preventDefault(); this.pokaz(-1); this.przelaczSpis(false); return; }
      const cel = e.target.closest('[data-cel]');
      if (cel) { e.preventDefault(); this.przejdz(cel.dataset.cel); this.przelaczSpis(false); return; }
      const czesc = e.target.closest('[data-czesc-przelacz]');
      if (czesc) { e.preventDefault(); this.przelaczCzesc(czesc.closest('li.czesc-spisu')); return; }
      const kop = e.target.closest('[data-kopiuj-prompt]');
      if (kop) {
        const ok = await kopiujTekst(kop.closest('.prompt-instrukcji').querySelector('pre').textContent);
        const tekst = kop.lastChild;
        const przed = tekst.textContent;
        tekst.textContent = ok ? tt('instrukcja.skopiowano') : tt('instrukcja.zaznaczISkopiujRecznie');
        setTimeout(() => { tekst.textContent = przed; }, 1800);
        return;
      }
      const obraz = e.target.closest('.instrukcja-tresc figure img');
      if (obraz) { this.powieksz(obraz); return; }
      if (e.target.closest('.instrukcja-lupa')) this.powieksz(null);
    });
    this.wstecz.addEventListener('click', () => this.pokaz(this.indeks - 1));
    this.dalej.addEventListener('click', () => {
      if (this.indeks < ROZDZIALY.length - 1) this.pokaz(this.indeks + 1);
      else this.pokaz(-1);
    });
    this.dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.uklad.classList.contains('spis-otwarty')) { e.preventDefault(); this.przelaczSpis(false); return; }
      if (e.key === 'Escape' && this.dlg.querySelector('.instrukcja-lupa')) { e.preventDefault(); this.powieksz(null); return; }
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight' && this.indeks < ROZDZIALY.length - 1) this.pokaz(this.indeks + 1);
      if (e.key === 'ArrowLeft' && this.indeks >= 0) this.pokaz(this.indeks - 1);
    });
    this.dlg.addEventListener('close', () => {
      this.przelaczSpis(false);
      this.powieksz(null);
      // Instrukcja otwarta z adresu #/instrukcja – po zamknięciu adres wraca na poprzedni.
      if (/^#\/instrukcja/.test(location.hash)) history.replaceState(null, '', this.adresPrzed || '#/');
    });
  }

  // Spis: części (zwijane) z rozdziałami; rozdział otwarty pokazuje swoje podrozdziały.
  przygotujTresc() {
    this.teksty = ROZDZIALY.map((r) => r.sekcje.map((s) => naTekst(`${r.tytul} ${s.tytul} ${s.html}`)));
    this.zbudujSpis();
    if (this.szukaj?.value) this.filtruj(this.szukaj.value);
  }

  zbudujSpis() {
    const html = CZESCI.map((c) => `<li class="czesc-spisu" data-czesc="${c.nr}">`
      + `<button type="button" class="czesc-przycisk" data-czesc-przelacz aria-expanded="false"><span data-ikona="${c.ikona}" data-rozmiar="16"></span><span class="tytul">${esc(c.tytul)}</span><span class="strzalka" data-ikona="dalej" data-rozmiar="14"></span></button>`
      + `<ol class="rozdzialy-spisu">${c.rozdzialy.map((nr) => {
        const i = rozdzialNr(nr);
        const r = ROZDZIALY[i];
        return `<li data-i="${i}"><button type="button" class="rozdzial-przycisk" data-cel="${nr}"><small>${nr}</small><span>${esc(r.tytul)}</span></button>`
          + `<ol class="podrozdzialy-spisu">${r.sekcje.map((s) => `<li data-sekcja="${s.id}"><button type="button" data-cel="${s.id}"><small>${s.id}</small><span>${esc(s.tytul)}</span></button></li>`).join('')}</ol></li>`;
      }).join('')}</ol></li>`).join('');
    this.spis.innerHTML = html;
    wstawIkony(this.spis);
  }

  przelaczCzesc(li, otworz = null) {
    if (!li) return;
    const tak = otworz ?? !li.classList.contains('otwarta');
    li.classList.toggle('otwarta', tak);
    li.querySelector('.czesc-przycisk').setAttribute('aria-expanded', String(tak));
  }

  // Spis jako zasłonka na wąskim ekranie.
  przelaczSpis(otworz = null) {
    const tak = otworz ?? !this.uklad.classList.contains('spis-otwarty');
    this.uklad.classList.toggle('spis-otwarty', tak);
    this.wybor?.setAttribute('aria-expanded', String(tak));
    if (tak) this.przewinSpis(this.spis.querySelector('[aria-current="true"]'), true);
  }

  otworz(indeks = -1) {
    this.pokaz(indeks);
    if (!this.dlg.open) this.dlg.showModal();
    this.tresc.focus({ preventScroll: true });
  }

  // Z adresu #/instrukcja – zapamiętuje adres sprzed, żeby po zamknięciu do niego wrócić.
  otworzZAdresu(adresPrzed) {
    this.adresPrzed = adresPrzed;
    this.otworz(-1);
  }

  otworzRozdzial(tytul) {
    // Wywołania w kodzie podają polski tytuł – rozdział o tym samym numerze w bieżącym języku.
    const i = ZRODLO_PL.findIndex((r) => r.tytul === tytul);
    this.otworz(Math.max(0, i >= 0 ? i : ROZDZIALY.findIndex((r) => r.tytul === tytul)));
  }

  // „7” – rozdział, „7.3” – podrozdział (strona rozdziału przewinięta do niego).
  przejdz(cel) {
    const [nr] = String(cel).split('.');
    const i = rozdzialNr(nr);
    if (i < 0) return;
    if (!this.dlg.open) this.dlg.showModal();
    this.pokaz(i, { sekcja: String(cel).includes('.') ? cel : null });
  }

  filtruj(zapytanie) {
    const slowa = String(zapytanie || '').toLowerCase().split(/\s+/).filter(Boolean);
    this.uklad.classList.toggle('szukanie', slowa.length > 0);
    this.spis.querySelectorAll('li.czesc-spisu').forEach((cz) => {
      let jest = false;
      cz.querySelectorAll(':scope > ol > li[data-i]').forEach((li) => {
        const i = Number(li.dataset.i);
        let trafione = 0;
        li.querySelectorAll('li[data-sekcja]').forEach((p, j) => {
          const tak = slowa.length > 0 && slowa.every((s) => this.teksty[i][j].includes(s));
          p.hidden = slowa.length > 0 && !tak;
          if (tak) trafione += 1;
        });
        const tytulTak = slowa.length > 0 && slowa.every((s) => ROZDZIALY[i].tytul.toLowerCase().includes(s));
        if (tytulTak && !trafione) li.querySelectorAll('li[data-sekcja]').forEach((p) => { p.hidden = false; });
        const widac = !slowa.length || trafione > 0 || tytulTak;
        li.hidden = !widac;
        li.classList.toggle('trafiony', slowa.length > 0 && trafione > 0);
        if (widac) jest = true;
      });
      cz.hidden = !jest;
      if (slowa.length) this.przelaczCzesc(cz, jest);
    });
    if (!slowa.length) this.zaznaczWSpisie();
  }

  zaznaczWSpisie() {
    const r = ROZDZIALY[this.indeks];
    this.spis.querySelectorAll('li[data-i]').forEach((li) => {
      const tak = Number(li.dataset.i) === this.indeks;
      li.classList.toggle('otwarty', tak);
      li.querySelector('.rozdzial-przycisk').setAttribute('aria-current', String(tak));
    });
    if (this.uklad.classList.contains('szukanie')) return;
    this.spis.querySelectorAll('li.czesc-spisu').forEach((cz) => this.przelaczCzesc(cz, Boolean(r) && cz.dataset.czesc === CZESCI.find((c) => c.rozdzialy.includes(r.nr))?.nr));
  }

  zamknij() {
    this.dlg.close();
  }

  powieksz(img) {
    this.dlg.querySelector('.instrukcja-lupa')?.remove();
    if (!img) return;
    const lupa = document.createElement('div');
    lupa.className = 'instrukcja-lupa';
    lupa.setAttribute('role', 'button');
    lupa.setAttribute('aria-label', tt('instrukcja.zamknijPowiekszenie'));
    lupa.innerHTML = `<img src="${img.getAttribute('src')}" alt="${esc(img.alt)}">`;
    this.uklad.append(lupa);
  }

  stronaGlowna() {
    return `<header class="instrukcja-naglowek"><h1 class="instrukcja-h1">${tt('instrukcja.tytulGlowny')}</h1>`
      + `<p class="instrukcja-lead">${tt('instrukcja.lead')}</p></header>`
      + `<div class="instrukcja-czesci">${CZESCI.map((c) => `<section class="karta-czesci"><h2><span data-ikona="${c.ikona}" data-rozmiar="18"></span>${tt('instrukcja.czesc')} ${c.nr}. ${esc(c.tytul)}</h2>`
        + `<p class="ciche">${esc(c.opis)}</p><ol>${c.rozdzialy.map((nr) => `<li><a href="#" data-cel="${nr}"><small>${nr}</small>${esc(ROZDZIALY[rozdzialNr(nr)].tytul)}</a></li>`).join('')}</ol></section>`).join('')}</div>`;
  }

  stronaRozdzialu(r, i) {
    // Zrzuty w języku interfejsu (#334): img/instrukcja/<język>/[ciemny/]; gdy jakiegoś brakuje – polski.
    const motyw = czyCiemny() ? 'ciemny/' : '';
    const j = biezacyJezyk();
    const katalog = `img/instrukcja/${j !== 'pl' ? `${j}/` : ''}${motyw}`;
    const zapas = `img/instrukcja/${motyw}`;
    const html = r.sekcje.map((s) => `<section class="podrozdzial" id="${idSekcji(s.id)}" data-sekcja="${s.id}"><h2><small>${s.id}</small>${esc(s.tytul)}</h2>${s.html}</section>`).join('')
      .replace(/src="img\/instrukcja\/([^"]+)"/g, (_, plik) => (katalog === zapas ? `src="${zapas}${plik}"`
        : tt('instrukcja.srcOnerrorThisOnerror', { katalog, plik, zapas })));
    // Bez okruszków (#169): część i rozdział pokazuje już spis z boku, a na telefonie przycisk nad treścią.
    return `<header class="instrukcja-naglowek"><h1 class="instrukcja-h1"><small>${r.nr}.</small> ${esc(r.tytul)}</h1>`
      + (r.wstep ? `<p class="instrukcja-lead wstep-rozdzialu">${r.wstep}</p>` : '')
      + (r.sekcje.length > 1 ? `<nav class="w-rozdziale" aria-label="${tt('instrukcja.wTymRozdziale')}"><span class="ciche">${tt('instrukcja.wTymRozdziale')}</span><ol>${r.sekcje.map((s) => `<li><a href="#" data-cel="${s.id}"><small>${s.id}</small>${esc(s.tytul)}</a></li>`).join('')}</ol></nav>` : '')
      + `</header><div class="instrukcja-dokument">${html}</div>`;
  }

  pokaz(i, { sekcja = null, przewin = true } = {}) {
    if (i < -1 || i >= ROZDZIALY.length) return;
    const gora = this.tresc.scrollTop;
    this.indeks = i;
    const r = ROZDZIALY[i];
    this.tresc.innerHTML = r ? this.stronaRozdzialu(r, i) : this.stronaGlowna();
    this.tresc.querySelectorAll('[data-wstaw="pola"]').forEach((d) => { d.outerHTML = tabelaPol(); });
    this.tresc.querySelectorAll('[data-wstaw="skroty"]').forEach((d) => { d.outerHTML = tabelaSkrotow(); });
    wstawIkony(this.tresc);
    this.zaznaczWSpisie();
    // Bieżący rozdział na przycisku spisu (wąski ekran) i numer w stopce.
    const tytul = this.wybor?.querySelector('.instrukcja-wybor-tytul');
    if (tytul) tytul.textContent = r ? `${r.nr}. ${r.tytul}` : tt('instrukcja.spisTresci');
    const podpis = this.wybor?.querySelector('.instrukcja-wybor-czesc');
    if (podpis) podpis.textContent = r ? r.czesc : tt('instrukcja.instrukcja');
    this.numer.textContent = r ? tt('instrukcja.numerZ', { nr: i + 1, razem: ROZDZIALY.length }) : '';
    this.wstecz.disabled = i < 0;
    this.dalej.textContent = r ? (i === ROZDZIALY.length - 1 ? tt('instrukcja.spisTresci') : tt('instrukcja.nastepny')) : tt('instrukcja.zacznijCzytac');
    if (sekcja) {
      const el = this.tresc.querySelector(`#${idSekcji(sekcja)}`);
      if (el) { this.tresc.scrollTop += el.getBoundingClientRect().top - this.tresc.getBoundingClientRect().top - 8; el.classList.add('wskazany'); setTimeout(() => el.classList.remove('wskazany'), 1600); }
    } else this.tresc.scrollTop = przewin ? 0 : gora;
    this.przewinSpis(this.spis.querySelector(`li[data-i="${i}"]`));
  }

  // Przewija tylko spis (scrollIntoView przesunąłby też okno, gdy spis jest schowaną zasłonką).
  przewinSpis(el, naSrodek = false) {
    if (!el) return;
    const s = this.spis.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (naSrodek) this.spis.scrollTop += r.top - s.top - s.height / 2 + r.height / 2;
    else if (r.top < s.top) this.spis.scrollTop += r.top - s.top - 8;
    else if (r.bottom > s.bottom) this.spis.scrollTop += Math.min(r.bottom - s.bottom + 8, r.top - s.top - 8);
  }
}
