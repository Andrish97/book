// Raport przeniesienia (#232): co przy zapisie do innego programu (albo odczycie z niego) przeszło bez zmian, co
// zamieniło się w obraz, co uproszczono, a co się nie przeniosło – z miejscem (strona, element), żeby dało się to
// pokazać w edytorze. Zapis zbiera wpisy w trakcie (te same reguły, które decydują o kształcie pliku), odczyt –
// tak samo, a elementy uproszczone przy odczycie dostają oznaczenie `z_importu` (widać je w „Sprawdź przed drukiem”).

export const RODZAJE = {
  obraz: 'Zamienione w obraz (wygląda tak samo, ale nie da się edytować)',
  uproszczone: 'Uproszczone',
  pominiete: 'Nie przeniesione',
  uwaga: 'Do zrobienia po stronie programu',
};

export class Raport {
  constructor() { this.wpisy = []; this.ok = 0; }
  // Element przeniesiony bez zmian.
  bezZmian(ile = 1) { this.ok += ile; }
  // rodzaj: klucz RODZAJE; powod – krótki opis (grupuje wpisy); miejsce: { idStrony, idObiektu, nr }.
  dodaj(rodzaj, powod, miejsce = {}) {
    this.wpisy.push({ rodzaj, powod, ...miejsce });
  }
  // Grupy: [{ rodzaj, powod, ile, strony: [nr…], pierwszy: { idStrony, idObiektu } }] w kolejności RODZAJE.
  grupy() {
    const mapa = new Map();
    for (const w of this.wpisy) {
      const k = `${w.rodzaj}|${w.powod}`;
      if (!mapa.has(k)) mapa.set(k, { rodzaj: w.rodzaj, powod: w.powod, ile: 0, strony: new Set(), pierwszy: null });
      const g = mapa.get(k);
      g.ile += 1;
      if (w.nr) g.strony.add(w.nr);
      if (!g.pierwszy && w.idStrony) g.pierwszy = { idStrony: w.idStrony, idObiektu: w.idObiektu || null };
    }
    const kolej = Object.keys(RODZAJE);
    return [...mapa.values()].map((g) => ({ ...g, strony: [...g.strony].sort((a, b) => a - b) }))
      .sort((a, b) => kolej.indexOf(a.rodzaj) - kolej.indexOf(b.rodzaj) || b.ile - a.ile);
  }
  // Tekst do pliku CZYTAJ-MNIE.txt.
  tekst() {
    const linie = [`Przeniesione bez zmian: ${this.ok} ${this.ok === 1 ? 'element' : 'elementów'}.`];
    for (const [rodzaj, nazwa] of Object.entries(RODZAJE)) {
      const g = this.grupy().filter((x) => x.rodzaj === rodzaj);
      if (!g.length) continue;
      linie.push('', `${nazwa}:`);
      for (const x of g) linie.push(`  – ${x.powod}${x.ile > 1 ? ` (${x.ile})` : ''}${x.strony.length ? ` – ${x.strony.length > 8 ? `strony ${x.strony.slice(0, 8).join(', ')}…` : `${x.strony.length === 1 ? 'strona' : 'strony'} ${x.strony.join(', ')}`}` : ''}`);
    }
    return linie.join('\n');
  }
}

// Dlaczego element nie może przejść jako tekst albo kształt programu docelowego – opis albo null.
export function powodObrazu(o) {
  const typ = String(o.type || '').toLowerCase();
  if (o.tabela) return 'tabela';
  if (o.kalendarz) return 'kalendarz miesiąca';
  if (o.wykres) return 'wykres';
  if (o.kod) return 'kod QR albo kreskowy';
  if (o.kolaz) return 'kolaż zdjęć';
  if (typ === 'group' || typ === 'activeselection') return 'grupa elementów';
  if (typ === 'image') return null; // zdjęcie zostaje zdjęciem
  if (o.shadow) return 'element z cieniem';
  if ((o.opacity ?? 1) < 0.999) return 'element z przezroczystością';
  if (o.fill && typeof o.fill === 'object') return 'wypełnienie gradientem albo wzorem';
  if (o.stroke && typeof o.stroke === 'object') return 'obrys gradientem';
  if (o.strokeDashArray?.length) return 'linia przerywana';
  if (o.skewX || o.skewY || o.flipX || o.flipY) return 'element pochylony albo odbity';
  if (o.clipPath || o.miekkie_krawedzie) return 'element przycięty albo z miękkimi krawędziami';
  if (o.filters?.length || o.filtry) return 'element z filtrami';
  if (o.ksztalt_tekstu) return 'tekst po łuku, w okręgu albo wygięty';
  return 'element bez odpowiednika w programie';
}

// Uwagi do całego projektu przy zapisie (to, czego nie widać w pojedynczych elementach).
export function uwagiProjektu(projekt, raport, { serieRozwiniete = true, wzorceWtopione = true } = {}) {
  if (serieRozwiniete && (projekt.serie || []).some((s) => projekt.strony.some((st) => st.seria === s.id))) {
    raport.dodaj('uproszczone', 'serie rozwinięte w gotowe strony z wpisanymi danymi (pola nie przechodzą – do korespondencji seryjnej w programie: „Seria dla innego programu”)');
  }
  if (wzorceWtopione && (projekt.wzorce || []).some((w) => (w.obiekty || []).length)) {
    raport.dodaj('uproszczone', 'wzorce (stopki, tła, numery stron) wtopione w każdą stronę – bez stron wzorcowych programu');
  }
  if ((projekt.style || []).length || (projekt.style_znakowe || []).length) raport.dodaj('uproszczone', 'style tekstu zapisane jako zwykłe formatowanie (bez nazwanych stylów)');
  if ((projekt.kolory_dodatkowe || projekt.kolory_druku?.dodatkowe || []).length) raport.dodaj('uproszczone', 'kolory dodatkowe (Pantone) zapisane jako RGB');
}

// Uwaga o elemencie tekstowym przy zapisie (połączone ramki, przypisy, linki, dzielenie…).
export function uwagiTekstu(o, raport, miejsce) {
  if (o.watek) raport.dodaj('uproszczone', 'połączone ramki tekstu rozdzielone – każda ma swój kawałek tekstu, tekst się nie przelewa', miejsce);
  if (o.przypisy && Object.keys(o.przypisy).length) raport.dodaj('pominiete', 'przypisy dolne (zostają jako numery w tekście)', miejsce);
  if (o.link) raport.dodaj('pominiete', 'link (klikalny adres)', miejsce);
  if (o.lista) raport.dodaj('uproszczone', 'wypunktowanie albo numerowanie – znaki listy jako zwykły tekst albo bez nich', miejsce);
  if (o.dziel_wyrazy) raport.dodaj('uwaga', 'dzielenie wyrazów – włącz je w programie (łamanie wierszy może wyjść inaczej)', miejsce);
  if (o.do_siatki) raport.dodaj('uwaga', 'wyrównanie do siatki linii bazowych – ustaw siatkę w programie', miejsce);
  if (o.inicjal) raport.dodaj('pominiete', 'inicjał (duża pierwsza litera)', miejsce);
}

// Okno raportu: lista grup z „Pokaż” (otwiera stronę z elementem). Zwraca Promise<boolean> – true: „Pobierz”.
export function pokazRaport({ tytul, wstep, raport, przycisk = 'Pobierz', anuluj = 'Anuluj', pokaz }) {
  let dlg = document.getElementById('dlg-raport-przeniesienia');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-raport-przeniesienia';
    dlg.className = 'okno-raportu';
    dlg.innerHTML = '<form method="dialog" class="formularz"><h2></h2><p class="ciche raport-wstep"></p><p class="raport-ok"></p><div class="raport-lista"></div><div class="przyciski-dialogu"><button class="przycisk" value="nie"></button><button class="przycisk glowny" value="tak"></button></div></form>';
    document.body.append(dlg);
  }
  dlg.querySelector('h2').textContent = tytul;
  dlg.querySelector('.raport-wstep').textContent = wstep || '';
  dlg.querySelector('.raport-ok').textContent = `Bez zmian: ${raport.ok} ${raport.ok === 1 ? 'element' : 'elementów'}.`;
  const lista = dlg.querySelector('.raport-lista');
  lista.replaceChildren();
  const grupy = raport.grupy();
  for (const [rodzaj, nazwa] of Object.entries(RODZAJE)) {
    const g = grupy.filter((x) => x.rodzaj === rodzaj);
    if (!g.length) continue;
    const h = document.createElement('h3');
    h.textContent = nazwa;
    const ul = document.createElement('ul');
    ul.className = `lista-uwag raport-${rodzaj}`;
    for (const x of g) {
      const li = document.createElement('li');
      const opis = document.createElement('span');
      const gdzie = x.strony.length ? ` – ${x.strony.length === 1 ? 'strona' : 'strony'} ${x.strony.length > 10 ? `${x.strony.slice(0, 10).join(', ')}…` : x.strony.join(', ')}` : '';
      opis.textContent = `${x.powod}${x.ile > 1 ? ` (${x.ile})` : ''}${gdzie}`;
      li.append(opis);
      if (pokaz && x.pierwszy) {
        const b = Object.assign(document.createElement('button'), { type: 'button', className: 'przycisk maly', textContent: 'Pokaż', title: 'Zamknij okno i pokaż pierwszy taki element w edytorze' });
        b.addEventListener('click', () => { dlg.close('nie'); pokaz(x.pierwszy.idStrony, x.pierwszy.idObiektu); });
        li.append(b);
      }
      ul.append(li);
    }
    lista.append(h, ul);
  }
  if (!grupy.length) {
    const p = document.createElement('p');
    p.textContent = 'Wszystko przeszło bez zmian.';
    lista.append(p);
  }
  const [bNie, bTak] = dlg.querySelectorAll('.przyciski-dialogu button');
  bNie.textContent = anuluj;
  bNie.hidden = !anuluj;
  bTak.textContent = przycisk;
  return new Promise((ok) => {
    dlg.addEventListener('close', () => ok(dlg.returnValue === 'tak'), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
