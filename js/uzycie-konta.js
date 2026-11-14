// Panel użycia konta w ustawieniach (sekcja „Miejsce”, decyzja #93): każdy widzi swoje zużycie – paski wobec
// limitów konta (projekty, obrazy w największym projekcie), rozbicie na projekty (pliki, obrazy, strony, ostatnia
// zmiana) z „Otwórz” i „Pokaż obrazy”, klucze AI i linki. Projekty innych osób – osobno, bez liczenia do limitów.
// Dane: funkcja bazy uzycie_projektow() i rozbicie plików na projekty z przekaźnika (GET /pliki/_miejsce).

import { $ } from './ui.js';
import * as chmura from './chmura.js';
import { rozmiar } from './miejsce.js';

const liczba = (x) => Number(x) || 0;
const procent = (x) => `${Math.min(100, Math.round(x * 100))}%`;
const data = (d) => (d ? new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const odmiana = (n, jeden, kilka, wiele) => {
  if (n === 1) return jeden;
  const j = n % 10;
  const d = n % 100;
  return j >= 2 && j <= 4 && (d < 12 || d > 14) ? kilka : wiele;
};

let ostatnie = null; // { m, uzycie } – do ponownego sortowania bez pytania bazy
let sortowanie = 'rozmiar';

function pasek(etykieta, wartosc, limit, opis) {
  const udzial = limit ? wartosc / limit : 0;
  const el = document.createElement('div');
  el.className = `miejsce-aplikacji${udzial >= 0.8 ? ' wysoko' : ''}`;
  el.innerHTML = `
    <div class="miejsce-naglowek"><strong></strong><span></span></div>
    <div class="miejsce-pasek" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span class="moje"></span></div>`;
  el.querySelector('strong').textContent = etykieta;
  el.querySelector('.miejsce-naglowek span').textContent = opis;
  el.querySelector('.miejsce-pasek').setAttribute('aria-label', etykieta);
  el.querySelector('.miejsce-pasek').setAttribute('aria-valuenow', String(Math.round(udzial * 100)));
  el.querySelector('.miejsce-pasek .moje').style.width = procent(udzial);
  return el;
}

function wierszProjektu(p, najwiekszy, { cudzy = false } = {}) {
  const li = document.createElement('li');
  li.className = 'uzycie-projekt';
  li.dataset.id = p.id;
  const meta = [
    cudzy ? `właściciel: ${p.wlasciciel || '—'} · ${p.rola === 'odczyt' ? 'oglądasz' : 'edytujesz'}` : rozmiar(p.bajty),
    `${p.obrazy} ${odmiana(p.obrazy, 'obraz', 'obrazy', 'obrazów')}`,
    `${p.strony} ${odmiana(p.strony, 'strona', 'strony', 'stron')}`,
    `zmieniono ${data(p.zmieniono)}`,
  ];
  const dodatki = [];
  if (!cudzy && p.klucze_ai) dodatki.push(`${p.klucze_ai} ${odmiana(p.klucze_ai, 'klucz AI', 'klucze AI', 'kluczy AI')}`);
  if (!cudzy && (p.link || p.link_chroniony)) dodatki.push(p.link_chroniony ? 'link z hasłem' : 'link do podglądu');
  li.innerHTML = `
    <div class="uzycie-opis"><strong></strong><span class="ciche uzycie-meta"></span></div>
    ${cudzy ? '' : '<div class="uzycie-slupek" aria-hidden="true"><span></span></div>'}
    <div class="uzycie-akcje">
      <button type="button" class="przycisk maly" data-rola="otworz">Otwórz</button>
      <button type="button" class="przycisk maly" data-rola="obrazy">Pokaż obrazy</button>
    </div>`;
  li.querySelector('strong').textContent = p.nazwa || 'Projekt';
  li.querySelector('.uzycie-meta').textContent = [...meta, ...dodatki].join(' · ');
  if (!cudzy) li.querySelector('.uzycie-slupek span').style.width = najwiekszy ? `${Math.max(2, (p.bajty / najwiekszy) * 100)}%` : '0';
  li.querySelector('[data-rola="otworz"]').addEventListener('click', () => { location.hash = `#/p/${p.id}`; });
  li.querySelector('[data-rola="obrazy"]').addEventListener('click', () => { location.hash = `#/p/${p.id}/obrazy`; });
  return li;
}

const SORTOWANIE = {
  rozmiar: (a, b) => b.bajty - a.bajty || String(a.nazwa).localeCompare(String(b.nazwa), 'pl'),
  nazwa: (a, b) => String(a.nazwa).localeCompare(String(b.nazwa), 'pl', { numeric: true }),
  zmiana: (a, b) => String(b.zmieniono).localeCompare(String(a.zmieniono)),
};

function rysuj() {
  if (!ostatnie) return;
  const { m, uzycie } = ostatnie;
  const plikiProjektow = m.projekty || {};
  const wlasne = (uzycie.wlasne || []).map((p) => ({
    ...p, obrazy: liczba(p.obrazy), strony: liczba(p.strony), bajty: liczba(plikiProjektow[p.id]?.bajty) + liczba(plikiProjektow[p.id]?.podglady),
  })).sort(SORTOWANIE[sortowanie] || SORTOWANIE.rozmiar);
  const najwiekszyRozmiar = Math.max(0, ...wlasne.map((p) => p.bajty));
  const najwiecejObrazow = wlasne.reduce((w, p) => (p.obrazy > (w?.obrazy ?? -1) ? p : w), null);

  const paski = $('#uzycie-paski');
  paski.replaceChildren(
    pasek('Projekty', wlasne.length, liczba(m.limit_projektow), `${wlasne.length} z ${liczba(m.limit_projektow)}`),
    pasek(
      'Obrazy w największym projekcie',
      liczba(najwiecejObrazow?.obrazy),
      liczba(m.obrazy_w_projekcie),
      najwiecejObrazow ? `${najwiecejObrazow.obrazy} z ${liczba(m.obrazy_w_projekcie)} („${najwiecejObrazow.nazwa}”)` : `0 z ${liczba(m.obrazy_w_projekcie)}`,
    ),
  );
  const lista = $('#uzycie-lista');
  lista.replaceChildren(...wlasne.map((p) => wierszProjektu(p, najwiekszyRozmiar)));
  $('#uzycie-pusto').hidden = wlasne.length > 0;
  const klucze = wlasne.reduce((s, p) => s + liczba(p.klucze_ai), 0);
  const linki = wlasne.filter((p) => p.link || p.link_chroniony).length;
  $('#uzycie-dodatki').textContent = `Aktywne klucze AI: ${klucze}. Linki do podglądu: ${linki}.`;
  const uInnych = (uzycie.u_innych || []).map((p) => ({ ...p, obrazy: liczba(p.obrazy), strony: liczba(p.strony) }));
  const inni = $('#uzycie-u-innych');
  inni.hidden = !uInnych.length;
  $('#uzycie-u-innych-licznik').textContent = String(uInnych.length);
  $('#uzycie-lista-innych').replaceChildren(...uInnych.map((p) => wierszProjektu(p, 0, { cudzy: true })));
}

// m – wynik miejsce() (już pobrany przez sekcję „Miejsce”).
export async function pokazUzycie(m) {
  if (!$('#uzycie-projektow')) return;
  try {
    const sb = await chmura.supabase();
    const { data: uzycie, error } = await sb.rpc('uzycie_projektow');
    if (error) throw new Error(error.message);
    ostatnie = { m, uzycie: uzycie || { wlasne: [], u_innych: [] } };
    rysuj();
  } catch {
    $('#uzycie-dodatki').textContent = 'Nie udało się wczytać rozbicia na projekty – brak połączenia z kontem.';
  }
}

$('#uzycie-sortuj')?.addEventListener('change', (e) => { sortowanie = e.target.value; rysuj(); });
