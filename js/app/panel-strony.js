// Panel właściwości, gdy nic nie jest zaznaczone: ustawienia strony albo wzorca. Do tego lista pól, które można wstawić w tekst.

import { FORMATY, stronyZWzorcem, tloStrony, WZORCE_Z_SEKCJI, stronySekcji, normalizujWydruk } from '../projekt.js';
import { bokStrony, rozwin, tabelaSerii, tabeleSerii } from '../serie.js';
import { POLA_DOKUMENTU } from '../pola.js';
import { $ } from '../ui.js';
import { liczba, stan, biezacyWzorzec, biezacaSekcja, biezacaStrona, edytor, tenSamRozmiar } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { panel, dane } from './skladniki.js';
import { renderujListe, przeniesStroneDoSekcji } from './lista-stron.js';
import { otworzUstawieniaSekcji } from './sekcje.js';

function opisMarginesow(wydruk, rozkladowki) {
  const m = wydruk.marginesy;
  if (m.gora === m.dol && m.dol === m.wewnetrzny && m.wewnetrzny === m.zewnetrzny) return `marginesy ${liczba(m.gora)} mm`;
  const [a, b] = rozkladowki ? ['wewn.', 'zewn.'] : ['lewy', 'prawy'];
  return `marginesy: góra ${liczba(m.gora)}, dół ${liczba(m.dol)}, ${a} ${liczba(m.wewnetrzny)}, ${b} ${liczba(m.zewnetrzny)} mm`;
}

export function nazwaFormatu(w, pelny = false, rozkladowki = false) {
  const standard = Boolean(FORMATY[w.format]);
  const orient = standard && w.szerokosc_mm > w.wysokosc_mm ? ' poziomo' : '';
  if (!pelny) return standard ? `${w.format}${orient}` : `${liczba(w.szerokosc_mm)}×${liczba(w.wysokosc_mm)} mm`;
  return `${standard ? `${w.format}${orient}` : 'Format własny'} – ${liczba(w.szerokosc_mm)} × ${liczba(w.wysokosc_mm)} mm, spad ${liczba(w.spad_mm)} mm, ${opisMarginesow(w, rozkladowki)}.`;
}

export function odswiezPasekEdytora() {
  const wz = stan.tryb === 'wzorzec';
  document.body.classList.toggle('tryb-wzorca', wz);
  $('#pasek-wzorca').hidden = !wz;
  if (wz) {
    const w = biezacyWzorzec();
    const n = stronyZWzorcem(stan.projekt, w.id).length;
    $('#pasek-wzorca-tekst').textContent = `Edytujesz wzorzec „${w.nazwa}” · ${n ? `widoczny na ${n} ${n === 1 ? 'stronie' : 'stronach'}` : 'nieużywany'}`;
    $('#opis-formatu').textContent = `Wzorzec · ${liczba(w.wydruk.szerokosc_mm)}×${liczba(w.wydruk.wysokosc_mm)}`;
  } else {
    const sek = biezacaSekcja();
    const bok = bokStrony(biezacaStrona(), rozwin(stan.projekt));
    $('#opis-formatu').textContent = `${sek.nazwa} · ${nazwaFormatu(sek.wydruk)}${bok ? ` · ${bok}` : ''}`;
  }
  $('#przycisk-format').disabled = wz;
}

// ---------- Pola: co można wstawić i co jest znane na otwartej stronie ----------

export const NAZWY_POL_DOKUMENTU = new Set(POLA_DOKUMENTU.map(([nazwa]) => nazwa));

// Tabela, z której strona bierze dane (przez swoją serię), albo null.
export function tabelaStrony(strona) {
  const seria = stan.projekt.serie.find((s) => s.id === strona?.seria);
  return seria ? tabelaSerii(stan.projekt, seria) : null;
}

// Wszystkie tabele serii strony: główna i dodatkowe (albo pusta lista).
export function tabeleStrony(strona) {
  const seria = stan.projekt.serie.find((s) => s.id === strona?.seria);
  return seria ? tabeleSerii(stan.projekt, seria) : [];
}

// Grupy do listy „Wstaw pole”: najpierw tabele bieżącej strony (główna, potem dodatkowe),
// dalej pozostałe, na końcu pola dokumentu. Pole z tabeli dodatkowej wstawia się z nazwą
// tabeli („Tygodnie.haslo”), żeby było jasne, skąd pochodzi.
export function polaDoWstawienia() {
  const { projekt } = stan;
  const wlasne = stan.tryb === 'strona' ? tabeleStrony(biezacaStrona()) : [];
  const [glowna, ...dodatkowe] = wlasne.length && tabelaStrony(biezacaStrona()) === wlasne[0] ? wlasne : [null, ...wlasne];
  const reszta = projekt.tabele.filter((t) => !wlasne.includes(t));
  return [
    ...(glowna ? [{ grupa: `Tabela tej strony: ${glowna.nazwa}`, pola: glowna.kolumny.map((k) => [k, '']) }] : []),
    ...dodatkowe.map((t) => ({ grupa: `Tabela dodatkowa serii: ${t.nazwa}`, pola: t.kolumny.map((k) => [`${t.nazwa}.${k}`, '']) })),
    ...reszta.map((t) => ({ grupa: `Tabela: ${t.nazwa}`, pola: t.kolumny.map((k) => [k, '']) })),
    { grupa: 'Pola dokumentu', pola: POLA_DOKUMENTU },
  ];
}

// ---------- Panel: strona i wzorzec ----------

export function nazwyWzorcow(ids) {
  const nazwy = stan.projekt.wzorce.filter((w) => ids.includes(w.id)).map((w) => w.nazwa);
  return nazwy.length ? nazwy.join(', ') : 'bez wzorców';
}

export async function poZmianieWzorcowStrony(strona) {
  zapiszBiezacyCel();
  stan.miniatury.delete(strona.id);
  await zaladujCel();
  panel.zbuduj();
  zaplanujZapis();
}

export function panelStrony(p) {
  const { projekt } = stan;
  const strona = biezacaStrona();
  const sekcja = biezacaSekcja();
  const bok = bokStrony(strona, rozwin(projekt));
  const s = p.sekcja('Strona');
  s.append(p.tekst('Nazwa strony', () => strona.nazwa, (v) => {
    strona.nazwa = v || strona.nazwa;
    renderujListe();
    zaplanujZapis();
  }, true, false));

  const sel = p.wybor('Sekcja', projekt.sekcje.map((x) => [x.id, x.nazwa]), () => strona.sekcja, (v) => przeniesStroneDoSekcji(strona, v));
  sel.classList.add('szeroki');
  s.append(sel);

  s.append(p.kolor('Tło', () => edytor.tloAktywnej, (v) => edytor.ustawTlo(v), { bezZatwierdzania: true }));
  if (strona.tlo) {
    s.append(p.akcje([['cofnij', 'Tło z wzorca', () => {
      edytor.ustawTlo(tloStrony(projekt, { ...strona, tlo: null }));
      strona.tlo = null;
      panel.zbuduj();
    }]]));
  }

  if (edytor.maSchowek) {
    s.append(p.akcje([['wklej', 'Wklej skopiowane elementy', () => edytor.wklej()]]));
  }

  // Seria: powielanie strony według tabeli albo zadaną liczbę razy.
  const se = p.sekcja('Seria (powielanie)');
  const seria = projekt.serie.find((x) => x.id === strona.seria);
  const wyborSerii = p.wybor('Seria', [['', 'Brak – strona pojedyncza'], ...projekt.serie.map((x) => [x.id, x.nazwa]), ['+', '+ Nowa seria…']], () => strona.seria || '', async (v) => {
    const nowa = v === '+' ? dane.nowaSeria() : null;
    if (v === '') delete strona.seria; else strona.seria = nowa ? nowa.id : v;
    zapiszBiezacyCel();
    stan.miniatury.clear();
    await zaladujCel();
    panel.zbuduj();
    zaplanujZapis();
    if (nowa) dane.otworzSerie(nowa.id);
  });
  wyborSerii.classList.add('szeroki');
  se.append(wyborSerii);
  if (seria) {
    se.append(p.wskazowka(dane.opisSerii(seria)));
    const braki = dane.brakiSerii(seria);
    if (braki) se.append(p.wskazowka(braki, true));
    se.append(p.akcje([['suwaki', 'Ustawienia serii', () => dane.otworzSerie(seria.id)], ['dane', 'Dane', () => dane.otworz(seria.tabela)]]));
  } else {
    se.append(p.wskazowka('Strony z tą samą serią, leżące obok siebie, powielają się razem – np. według wierszy tabeli.'));
  }

  if (projekt.wzorce.length) {
    const w = p.sekcja('Wzorce');
    const tryb = p.wybor('Wzorce na tej stronie', [
      ['sekcja', `Jak w sekcji (${nazwyWzorcow(sekcja.wzorce)})`],
      ['wlasne', 'Własny wybór'],
    ], () => (strona.wzorce === WZORCE_Z_SEKCJI ? 'sekcja' : 'wlasne'), (v) => {
      strona.wzorce = v === 'sekcja' ? WZORCE_Z_SEKCJI : [...sekcja.wzorce];
      poZmianieWzorcowStrony(strona);
    });
    tryb.classList.add('szeroki');
    w.append(tryb);
    if (strona.wzorce !== WZORCE_Z_SEKCJI) {
      for (const wz of projekt.wzorce) {
        w.append(p.przelacznik(wz.nazwa, () => strona.wzorce.includes(wz.id), (v) => {
          strona.wzorce = v ? [...strona.wzorce, wz.id] : strona.wzorce.filter((id) => id !== wz.id);
          poZmianieWzorcowStrony(strona);
        }));
      }
    }
  }

  const f = p.sekcja(`Sekcja „${sekcja.nazwa}”`);
  f.append(p.wskazowka(`${sekcja.uklad === 'rozkladowki' ? `Rozkładówki – to strona ${bok}. ` : ''}${nazwaFormatu(sekcja.wydruk, true, sekcja.uklad === 'rozkladowki')}`));
  if (edytor.rozkladowka) f.append(p.wskazowka('Obie strony rozkładówki edytujesz razem. Element może leżeć przez grzbiet – na każdej stronie wydrukuje się jego część.'));
  f.append(p.akcje([['format', 'Ustawienia sekcji', () => otworzUstawieniaSekcji(sekcja.id)]]));

  p.legendaProwadnic(Boolean(bok));
}

export function panelWzorca(p) {
  const { projekt } = stan;
  const w = biezacyWzorzec();
  const s = p.sekcja('Wzorzec');
  s.append(p.tekst('Nazwa wzorca', () => w.nazwa, (v) => {
    w.nazwa = v || w.nazwa;
    renderujListe();
    odswiezPasekEdytora();
    zaplanujZapis();
  }, true, false));
  s.append(p.kolor('Tło stron', () => edytor.tloAktywnej, (v) => edytor.ustawTlo(v), { bezZatwierdzania: true }));
  s.append(p.wskazowka('Białe tło znaczy „bez tła” – wzorzec nie zmienia wtedy koloru strony.'));
  s.append(p.przelacznik('Odbijaj lustrzanie na lewych stronach rozkładówek', () => w.lustro, (v) => {
    w.lustro = v;
    for (const st of stronyZWzorcem(projekt, w.id)) stan.miniatury.delete(st.id);
    zaplanujZapis();
  }));
  s.append(p.wskazowka('Elementy wzorca leżą pod treścią stron. Zaznacz element i włącz „Nad treścią strony”, jeśli ma ją przykrywać (np. ramka albo znak wodny).'));

  const u = p.sekcja('Gdzie jest używany');
  for (const sek of projekt.sekcje) {
    const inny = tenSamRozmiar(sek.wydruk, w.wydruk) ? '' : ' – inny rozmiar';
    u.append(p.przelacznik(`Sekcja „${sek.nazwa}”${inny}`, () => sek.wzorce.includes(w.id), (v) => {
      sek.wzorce = v ? [...sek.wzorce, w.id] : sek.wzorce.filter((id) => id !== w.id);
      for (const st of stronySekcji(projekt, sek)) stan.miniatury.delete(st.id);
      odswiezPasekEdytora();
      renderujListe();
      zaplanujZapis();
    }));
  }
  u.append(p.wskazowka('Strona może mieć kilka wzorców naraz (np. tło + stopka). Pojedynczym stronom wybierzesz je w ich właściwościach.'));

  const r = p.sekcja('Rozmiar');
  r.append(p.wskazowka(nazwaFormatu(w.wydruk, true)));
  const dopasuj = p.wybor('Ustaw rozmiar jak w sekcji', [['', '— wybierz sekcję —'], ...projekt.sekcje.map((x) => [x.id, x.nazwa])], () => '', async (v) => {
    const sek = projekt.sekcje.find((x) => x.id === v);
    if (!sek) return;
    zapiszBiezacyCel();
    w.wydruk = normalizujWydruk(sek.wydruk);
    await zaladujCel({ dopasuj: true });
    panel.zbuduj();
    zaplanujZapis();
  });
  dopasuj.classList.add('szeroki');
  r.append(dopasuj);

  const z = p.sekcja('Numer strony i inne zmienne');
  const lista = document.createElement('ul');
  lista.className = 'lista-zmiennych szeroki';
  lista.innerHTML = [
    ['{nr}', 'numer strony (według numeracji sekcji)'],
    ['{nr_w_sekcji}', 'kolejny numer strony w jej sekcji'],
    ['{liczba_stron}', 'najwyższy numer strony'],
    ['{sekcja}', 'nazwa sekcji'],
    ['{strona}', 'nazwa strony'],
  ].map(([k, o]) => `<li><code>${k}</code> ${o}</li>`).join('');
  z.append(p.wskazowka('Wpisz w dowolnym tekście wzorca, np. „Strona {nr} z {liczba_stron}”. Na stronach pojawi się właściwa wartość.'), lista);

  p.legendaProwadnic();
}
