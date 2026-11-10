/* global fabric */
// Silnik edycji arkusza (sekcja 4 planu). Arkusz to jedna strona albo
// rozkładówka: dwie strony obok siebie na wspólnym płótnie, żeby element
// mógł leżeć przez grzbiet.
//
// Wszystkie obiekty Fabric mają współrzędne w milimetrach. Punkt (0, 0) to
// lewy górny róg arkusza po przycięciu (bez spadu); prawa strona rozkładówki
// zaczyna się w x = szerokość strony. Na piksele przeliczamy tylko widok:
// viewportTransform = skala (px/mm × zoom) + przesunięcie o spad.

import { WLASNE_POLA, toZaznaczenie } from './fabric-ustawienia.js';
import { uid, ptNaMm, scalRozkladowke } from './projekt.js';
import { DOMYSLNA, zapewnijCzcionki, zapewnijRodziny } from './czcionki.js';
import { podmienZasoby, zrodloObrazu, wzorzecPrzezGrzbiet } from './zlozenie.js';
import { przyciagnij, pomiary, przyciagnijKrawedz } from './przyciaganie.js';
import { znajdzPola, polaZDanych } from './pola.js';
import { nieMiesciSie } from './tekst-ramka.js';
import { przygotujKopie, rozmiarOryginalu } from './obrazy.js';
import { watki, rozlej, kolejnoscCzytania, przeniesTekst, odlaczRamke, WSPOLNE_W_WATKU } from './watki.js';
import {
  toTabela, nowaTabela, ulozTabele, przygotujTabele, komorkiTabeli, komorkaWPunkcie, miejsceKomorki, utrwalSkaleTabeli,
  dodajWiersz, usunWiersz, dodajKolumne, usunKolumne, scalKomorki, rozdzielKomorki, komorkaSchowana,
} from './tabela-obiekt.js';

export const PX_NA_MM = 96 / 25.4;

export { WLASNE_POLA };

export const TEKST_ZACHETY = 'Kliknij dwa razy, aby edytować';

// Punkty wielokąta foremnego (albo gwiazdy) wpisanego w okrąg o promieniu r,
// z wierzchołkiem u góry.
export function punktyWielokata(boki, gwiazda = false, r = 20) {
  const n = Math.min(24, Math.max(3, Math.round(boki) || 3));
  const punkty = [];
  const krokow = gwiazda ? n * 2 : n;
  for (let i = 0; i < krokow; i += 1) {
    const promien = gwiazda && i % 2 ? r * 0.45 : r;
    const kat = (i / krokow) * 2 * Math.PI - Math.PI / 2;
    punkty.push({ x: r + promien * Math.cos(kat), y: r + promien * Math.sin(kat) });
  }
  return punkty;
}


export class Edytor extends EventTarget {
  constructor(elementPlotna, kontener) {
    super();
    this.kontener = kontener;
    this.zoom = 1;
    this.pokazProwadnice = true;
    this.wydruk = null;
    this.strony = []; // strony arkusza: { x, marg }
    this.tla = ['#ffffff'];
    this.aktywna = 0; // strona arkusza, do której trafiają nowe elementy
    this.zasoby = {};
    this.ostrzezenia = [];
    this._poza = []; // ramki wątków leżące na innych stronach: [{ strona, o, odcisk }]
    this._wczytywanie = false;
    this._renderujeEksport = false;
    this._liniePrzyciagania = [];
    this._pomiary = []; // strzałki z odległościami do sąsiednich elementów
    this._cele = null; // ramki innych elementów, zapamiętane na czas jednego przeciągnięcia
    this.widok = { siatka_mm: 5, siatka: false, do_siatki: false, do_elementow: true };
    // Prowadnice własne: { os: 'x' | 'y', poz (mm na arkuszu), strona (indeks strony arkusza) }.
    // Pionowa (os x) stoi w poz na osi x; pozioma biegnie przez swoją stronę.
    this.prowadnice = [];
    this._prowadnicaWRuchu = null;
    // Czy pole {nazwa} jest znane na stronie arkusza o danym indeksie (ustawia aplikacja).
    this.znanePole = () => true;

    this.canvas = new fabric.Canvas(elementPlotna, {
      preserveObjectStacking: true,
      stopContextMenu: true,
      // Prawy i środkowy przycisk myszy nie zaczynają zaznaczania ani przesuwania prowadnic
      // (Fabric 7 domyślnie zgłasza je jak zwykłe kliknięcie).
      fireRightClick: false,
      fireMiddleClick: false,
      selectionColor: 'rgba(37, 99, 235, 0.08)',
      selectionBorderColor: '#2563eb',
      selectionLineWidth: 1,
      targetFindTolerance: 6,
    });

    const c = this.canvas;
    c.on('before:render', (e) => this._rysujTla(e.ctx));
    c.on('after:render', (e) => this._poRenderowaniu(e.ctx));
    // Kliknięcie w drugą stronę rozkładówki robi z niej stronę bieżącą.
    c.on('mouse:down', (e) => {
      if (this.strony.length < 2 || !e.scenePoint) return;
      this.ustawAktywna(this.stronaW(e.scenePoint.x), true);
    });
    // Otwarta grupa zamyka się, gdy zaznaczenie wychodzi poza jej elementy (kliknięcie obok, inny element).
    for (const zdarzenie of ['selection:created', 'selection:updated', 'selection:cleared']) {
      c.on(zdarzenie, () => { if (this._otwarta && !this.wOtwartejGrupie()) this.zamknijGrupe(false); });
    }
    c.on('selection:created', () => this._emitujZaznaczenie());
    c.on('selection:updated', () => this._emitujZaznaczenie());
    c.on('selection:cleared', () => this._emitujZaznaczenie());
    c.on('object:moving', (e) => this._przyciagnij(e.target, e.e));
    c.on('object:scaling', (e) => this._przyciagnijRozmiar(e.target, e.e, e.transform));
    // Tabela skalowana uchwytem: kolumny i wiersze zmieniają wymiary od razu, pismo zostaje w swoim rozmiarze.
    c.on('object:scaling', (e) => this._skalujTabele(e.target, e.transform));
    c.on('object:resizing', (e) => this._przyciagnijRozmiar(e.target, e.e, e.transform));
    c.on('object:rotating', (e) => {
      // Z Shiftem obrót skacze co 15°.
      if (e.e?.shiftKey) e.target.rotate(Math.round(e.target.angle / 15) * 15);
    });
    c.on('mouse:down', () => { this._cele = null; this._kopiaZAlt = false; });
    c.on('mouse:down', (e) => this._chwycProwadnice(e));
    c.on('mouse:move', (e) => this._ruchNadProwadnica(e));
    // Pióro i edycja punktów kształtu: kliknięcia i ruch myszy idą do nich, nie do zaznaczania.
    c.on('mouse:down', (e) => {
      if (!e.scenePoint || this.reka || e.e?.button > 0) return;
      if (this._pioro) this._pioroMyszWDol(e); else if (this._punkty) this._punktyMyszWDol(e);
    });
    c.on('mouse:move', (e) => {
      if (!e.scenePoint) return;
      if (this._pioro) this._pioroRuch(e); else if (this._punkty) this._punktyRuch(e);
    });
    c.on('mouse:up', () => {
      if (this._pioro) this._pioro.ciagnie = null;
      if (this._punkty) this._punkty.ciagnie = null;
    });
    c.on('mouse:dblclick', (e) => {
      if (this._pioro) this.zakonczKsztaltPiora();
      else if (this._punkty && e.scenePoint && !this._wezelPod(e.scenePoint)) this.dodajPunkt(e.scenePoint);
    });
    c.on('object:removed', (e) => { if (this._punkty && e.target === this._punkty.obj) this.zakonczPunkty(false); });
    c.on('mouse:up', () => {
      this._cele = null;
      this._kopiaZAlt = false;
      if (this._liniePrzyciagania.length || (this._pomiary.length && !this._pomiaryStale)) {
        this._liniePrzyciagania = [];
        this._pomiary = [];
        c.requestRenderAll();
      }
    });
    c.on('object:modified', (e) => {
      utrwalSkaleTekstu(e.target);
      utrwalSkaleTabeli(e.target);
      this.oznaczZmiane();
    });
    c.on('object:added', (e) => {
      if (toTabela(e.target) && !e.target.zWzorca) this._przygotujTabele(e.target);
      if (this._wczytywanie || e.target?.zWzorca) return;
      this._uporzadkujWzorce();
      this.oznaczZmiane();
    });
    c.on('object:removed', () => this.oznaczZmiane());
    c.on('text:editing:exited', (e) => { this._poKomorce(e.target); this.oznaczZmiane(); });
    // Kadrowanie: podwójne kliknięcie obrazu zaczyna, kliknięcie poza ramką kończy.
    // Tabela: podwójne kliknięcie komórki zaczyna w niej pisanie.
    // Zwykła grupa: podwójne kliknięcie otwiera ją i zaznacza element pod kursorem.
    c.on('mouse:dblclick', (e) => {
      const cel = e.target;
      if (!cel || cel.zWzorca) return;
      if (cel.type === 'image') this.kadruj(cel);
      else if (cel.type === 'path') this.edytujPunkty(cel);
      else if (toTabela(cel)) this.edytujKomorke(cel, komorkaWPunkcie(cel, e.scenePoint || c.getScenePoint(e.e)), e.e);
      else if (this._doOtwarcia(cel)) this.otworzGrupe(cel, this._elementGrupyWPunkcie(cel, e.scenePoint || c.getScenePoint(e.e)));
    });
    // W trakcie pisania w tabeli kliknięcie innej komórki przenosi tam pisanie.
    c.on('mouse:down', (e) => {
      const a = c.getActiveObject();
      if (a && a === e.target && a.type === 'textbox' && toTabela(a.group) && !a.isEditing) this.edytujKomorke(a.group, a, e.e);
    });
    c.on('selection:cleared', () => { if (this._kadr) this.zakonczKadrowanie(true); });
    c.on('selection:updated', () => { if (this._kadr && this.aktywny !== this._kadr.ramka) this.zakonczKadrowanie(true); });
    c.on('text:changed', (e) => {
      // Komórka tabeli: wiersz rośnie razem z tekstem.
      if (toTabela(e.target?.group)) { ulozTabele(e.target.group); c.requestRenderAll(); }
      this._przelejPrzyPisaniu(e.target);
      this._emitujZaznaczenie();
    });
    c.on('text:selection:changed', () => this._emitujZaznaczenie());
    c.on('text:editing:entered', () => this._emitujZaznaczenie());
    // Podczas przesuwania/skalowania odświeżamy pola liczbowe na bieżąco.
    for (const zdarzenie of ['object:moving', 'object:scaling', 'object:rotating']) {
      c.on(zdarzenie, () => this._emitujZaznaczenie());
    }

    // Klawisze na granicy połączonych ramek tekstu – przed obsługą klawiszy samego tekstu.
    document.addEventListener('keydown', (e) => this._klawiszNaGranicyRamek(e), true);

    this._obslugaGestow();
  }

  // ---------- Geometria widoku ----------

  get skala() {
    return PX_NA_MM * this.zoom;
  }

  // marginesy: { lewy, prawy, gora, dol, grzbiet: 'lewy' | 'prawy' | null }
  // – już przeliczone dla konkretnej strony (w rozkładówkach są lustrzane).
  // Tablica dwóch zestawów = rozkładówka: [lewa strona, prawa strona].
  ustawWydruk(wydruk, marginesy) {
    this.wydruk = { ...wydruk };
    const m = wydruk.marginesy || {};
    const lista = [].concat(marginesy || { lewy: m.wewnetrzny ?? 10, prawy: m.zewnetrzny ?? 10, gora: m.gora ?? 10, dol: m.dol ?? 10, grzbiet: null });
    this.strony = lista.map((marg, i) => ({ x: i * wydruk.szerokosc_mm, marg }));
    this.aktywna = Math.min(this.aktywna, this.strony.length - 1);
    this._dopasujRozmiar();
    this.przeliczOstrzezenia();
  }

  // Marginesy strony bieżącej.
  get marg() { return this.strony[this.aktywna].marg; }
  get rozkladowka() { return this.strony.length > 1; }
  get szerokoscArkusza() { return this.strony.length * this.wydruk.szerokosc_mm; }

  // Indeks strony arkusza, na której leży punkt x (mm).
  stronaW(x) {
    return Math.min(this.strony.length - 1, Math.max(0, Math.floor(x / this.wydruk.szerokosc_mm)));
  }

  ustawAktywna(i, zKlikniecia = false) {
    const nowa = Math.min(this.strony.length - 1, Math.max(0, i));
    if (nowa === this.aktywna) return;
    this.aktywna = nowa;
    this.dispatchEvent(new Event('geometria')); // linijki liczą od rogu strony bieżącej
    if (zKlikniecia) this.dispatchEvent(new CustomEvent('strona', { detail: nowa }));
  }

  // Środek obiektu w układzie arkusza – także wtedy, gdy obiekt jest częścią zaznaczenia.
  _srodekObiektu(o) {
    return o.getCenterPoint();
  }

  _dopasujRozmiar() {
    const { wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    const s = this.skala;
    this.canvas.setDimensions({
      width: Math.round((w + 2 * b) * s),
      height: Math.round((h + 2 * b) * s),
    });
    this.canvas.setViewportTransform([s, 0, 0, s, b * s, b * s]);
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
    this.dispatchEvent(new Event('geometria'));
  }

  ustawZoom(zoom, punktEkranu = null) {
    const nowy = Math.min(8, Math.max(0.1, zoom));
    const k = this.kontener;
    // Punkt (w px płótna), który ma zostać pod palcem / kursorem.
    let px; let py; let ex; let ey;
    const rect = this.canvas.upperCanvasEl.getBoundingClientRect();
    if (punktEkranu) {
      ex = punktEkranu.x; ey = punktEkranu.y;
    } else {
      const kr = k.getBoundingClientRect();
      ex = kr.left + kr.width / 2; ey = kr.top + kr.height / 2;
    }
    px = (ex - rect.left) / this.zoom;
    py = (ey - rect.top) / this.zoom;
    this.zoom = nowy;
    this._dopasujRozmiar();
    const rect2 = this.canvas.upperCanvasEl.getBoundingClientRect();
    k.scrollLeft += rect2.left + px * nowy - ex;
    k.scrollTop += rect2.top + py * nowy - ey;
    this.dispatchEvent(new CustomEvent('zoom', { detail: nowy }));
  }

  dopasujDoOkna() {
    if (!this.wydruk) return;
    const { wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    // Odstęp na pływający pasek narzędzi (u góry) i kontrolki widoku (u dołu).
    const arkusz = this.kontener.firstElementChild;
    const st = arkusz ? getComputedStyle(arkusz) : null;
    const px = (v) => parseFloat(v) || 0;
    const mw = st ? px(st.paddingLeft) + px(st.paddingRight) : 48;
    const mh = st ? px(st.paddingTop) + px(st.paddingBottom) : 48;
    const dw = Math.max(100, this.kontener.clientWidth - mw);
    const dh = Math.max(100, this.kontener.clientHeight - mh);
    const z = Math.min(dw / ((w + 2 * b) * PX_NA_MM), dh / ((h + 2 * b) * PX_NA_MM));
    this.zoom = Math.max(0.1, z);
    this._dopasujRozmiar();
    this.dispatchEvent(new CustomEvent('zoom', { detail: this.zoom }));
  }

  // ---------- Wczytywanie i zapis arkusza ----------

  // warstwy: { pod: [], nad: [] } – gotowe elementy wzorców (zlozenie.js):
  // widoczne, ale niezaznaczalne i niezapisywane razem ze stroną.
  wczytajStrone(strona, zasoby, warstwy = null) {
    return this.wczytajArkusz([{ ...strona, warstwy }], zasoby);
  }

  // strony: [{ id, obiekty, tlo, warstwy }] – jedna albo dwie (lewa, prawa),
  // tyle samo, ile zestawów marginesów dostało ustawWydruk.
  async wczytajArkusz(strony, zasoby) {
    this._poza = [];
    await zapewnijCzcionki(strony.flatMap((s) => s.obiekty || [])); // tekst mierzy się właściwą czcionką
    await przygotujKopie(zasoby, strony.flatMap((s) => s.obiekty || []));
    const w = this.wydruk.szerokosc_mm;
    const b = this.wydruk.spad_mm;
    const h = this.wydruk.wysokosc_mm;
    this.zasoby = zasoby;
    this._znacznikStrony = strony.map((s) => s.id).join('+') || Symbol('strona');
    this.tla = strony.map((s) => s.tlo || '#ffffff');
    this.prowadnice = strony.flatMap((s, i) => [
      ...(s.prowadnice?.x || []).map((poz) => ({ os: 'x', poz: poz + i * w, strona: i })),
      ...(s.prowadnice?.y || []).map((poz) => ({ os: 'y', poz, strona: i })),
    ]);
    this._warstwy = { pod: [], nad: [] };
    strony.forEach((s, i) => {
      for (const rodzaj of ['pod', 'nad']) {
        for (const o of s.warstwy?.[rodzaj] || []) {
          if (strony.length > 1) {
            // Element wzorca należy do swojej strony i jest do niej przycięty – chyba że wychodzi przez
            // grzbiet dalej niż na spad: wtedy, jak zwykły element, leży na obu stronach rozkładówki.
            const przezGrzbiet = wzorzecPrzezGrzbiet(o, i === 0 ? 'lewa' : 'prawa', w, b);
            o.set({ left: o.left + i * w });
            if (!przezGrzbiet) {
              o.clipPath = new fabric.Rect({
                left: i === 0 ? -b : w, top: -b, width: w + b, height: h + 2 * b, absolutePositioned: true,
              });
            }
            o.setCoords();
          }
          this._warstwy[rodzaj].push(o);
        }
      }
    });
    this._wczytywanie = true;
    this._zapomnijOtwarta();
    this.canvas.discardActiveObject();
    const json = strony.length > 1
      ? scalRozkladowke(strony[0].obiekty, strony[1].obiekty).map(({ o, bok }) => (bok === 'prawa' ? { ...o, left: (o.left || 0) + w } : o))
      : strony[0].obiekty;
    const obiekty = podmienZasoby(json, zrodloObrazu(zasoby));
    await this.canvas.loadFromJSON({ objects: obiekty });
    for (const o of this.canvas.getObjects()) if (!o.id) o.id = uid('o'); // starsze projekty
    this._dodajWzorce();
    this._zastosujBlokady();
    this._dopasujRozmiar();
    this._wczytywanie = false;
    this.przeliczOstrzezenia();
    this._emitujZaznaczenie();
  }

  _dodajWzorce() {
    const { pod, nad } = this._warstwy;
    pod.forEach((o, i) => this.canvas.insertAt(i, o));
    nad.forEach((o) => this.canvas.add(o));
    this.canvas.requestRenderAll();
  }

  // Elementy wzorców „pod” zawsze na samym dole, „nad” zawsze na wierzchu.
  _uporzadkujWzorce() {
    const { pod, nad } = this._warstwy || { pod: [], nad: [] };
    if (!pod.length && !nad.length) return;
    const bylo = this._wczytywanie;
    this._wczytywanie = true;
    for (let i = pod.length - 1; i >= 0; i -= 1) this.canvas.sendObjectToBack(pod[i]);
    for (const o of nad) this.canvas.bringObjectToFront(o);
    this._wczytywanie = bylo;
  }

  get maWzorce() {
    return Boolean(this._warstwy && (this._warstwy.pod.length || this._warstwy.nad.length));
  }

  // Obiekty arkusza w postaci do zapisu (obrazy jako "zasob:<id>"), osobno dla
  // każdej strony: [[...], [...]]. Na rozkładówce element należy do strony, na
  // której leży jego środek; współrzędne są liczone od rogu tej strony, a pole
  // `z` pamięta kolejność na wspólnym płótnie.
  // Elementy wzorca mają excludeFromExport, więc nie trafiają do zapisu.
  obiektyStron() {
    const zywe = this.canvas.getObjects().filter((o) => !o.excludeFromExport);
    const json = podmienZasoby(this.canvas.toObject().objects, null);
    if (!this.rozkladowka) return [json];
    const w = this.wydruk.szerokosc_mm;
    const wynik = this.strony.map(() => []);
    json.forEach((o, k) => {
      const i = zywe[k] ? this.stronaW(this._srodekObiektu(zywe[k]).x) : 0;
      wynik[i].push({ ...o, left: (o.left || 0) - i * w, z: k });
    });
    return wynik;
  }

  // Obiekty pojedynczej strony (arkusz z jedną stroną albo wzorzec).
  obiektyStrony() {
    return this.obiektyStron().flat();
  }

  get tloAktywnej() { return this.tla[this.aktywna] || '#ffffff'; }

  ustawTlo(kolor, i = this.aktywna) {
    this.tla[i] = kolor;
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
  }

  // Tła stron rysujemy pod obiektami (każda strona rozkładówki ma swoje).
  _rysujTla(ctx) {
    if (!this.wydruk) return;
    const { szerokosc_mm: w, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const v = this.canvas.viewportTransform;
    const n = this.strony.length;
    ctx.save();
    ctx.transform(v[0], 0, 0, v[3], v[4], v[5]);
    this.strony.forEach((s, i) => {
      ctx.fillStyle = this.tla[i] || '#ffffff';
      const x1 = i === 0 ? -b : s.x;
      const x2 = i === n - 1 ? s.x + w + b : s.x + w;
      ctx.fillRect(x1, -b, x2 - x1, h + 2 * b);
    });
    ctx.restore();
  }

  // Wycinek płótna z jedną stroną arkusza (ze spadem), w pikselach płótna.
  _wycinek(i) {
    if (!this.rozkladowka) return {};
    const { szerokosc_mm: w, spad_mm: b } = this.wydruk;
    const s = this.skala;
    return { left: this.strony[i].x * s, top: 0, width: (w + 2 * b) * s, height: this.canvas.getHeight() };
  }

  _obraz(mnoznik, i) {
    this._renderujeEksport = true;
    try {
      return this.canvas.toDataURL({ format: 'png', multiplier: mnoznik, ...this._wycinek(i) });
    } finally {
      this._renderujeEksport = false;
      this.canvas.requestRenderAll();
    }
  }

  // Miniatura strony arkusza (bez prowadnic i uchwytów).
  miniatura(szerokoscPx = 160, i = this.aktywna) {
    const { szerokosc_mm: w, spad_mm: b } = this.wydruk;
    return this._obraz(szerokoscPx / ((w + 2 * b) * this.skala), i);
  }

  // PNG strony arkusza w zadanej rozdzielczości (ze spadem).
  png(dpi = 150, i = this.aktywna) {
    return this._obraz((dpi / 25.4) / this.skala, i);
  }

  // ---------- Zmiany i historia (cofanie) ----------

  oznaczZmiane() {
    if (this._wczytywanie || this._kadr) return;
    this._ulozOtwarta();
    this._pilnujWatkow();
    this.przeliczOstrzezenia();
    this.dispatchEvent(new Event('zmiana'));
  }

  // ---------- Dodawanie obiektów ----------

  _wstaw(obj) {
    // Wstawienie innego elementu kończy pióro i edycję punktów.
    if (this._pioro) this.ustawPioro(false);
    if (this._punkty) this.zakonczPunkty(true);
    obj.set({ id: uid('o') });
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    return obj;
  }

  // Położenie nowego elementu: środek strony bieżącej.
  _srodek(szer, wys) {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    return { left: this.strony[this.aktywna].x + (w - szer) / 2, top: (h - wys) / 2 };
  }

  dodajTekst(tresc = TEKST_ZACHETY) {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const szer = Math.max(20, w - this.marg.lewy - this.marg.prawy);
    const t = new fabric.Textbox(tresc, {
      left: this.strony[this.aktywna].x + this.marg.lewy,
      top: (h - 10) / 2,
      width: szer,
      fontFamily: DOMYSLNA,
      fontSize: ptNaMm(14),
      lineHeight: 1.2,
      fill: '#1a1a1a',
      textAlign: 'left',
      strokeWidth: 0, // domyślne 1 (= 1 mm) poszerzałoby ramkę obiektu
    });
    return this._wstaw(t);
  }

  dodajProstokat() {
    return this._wstaw(new fabric.Rect({
      ...this._srodek(40, 25), width: 40, height: 25,
      fill: '#d9e6f2', stroke: '#1a1a1a', strokeWidth: 0.3, strokeUniform: true,
    }));
  }

  dodajElipse() {
    return this._wstaw(new fabric.Ellipse({
      ...this._srodek(36, 24), rx: 18, ry: 12,
      fill: '#f2e2d9', stroke: '#1a1a1a', strokeWidth: 0.3, strokeUniform: true,
    }));
  }

  // Wielokąt foremny (domyślnie trójkąt); liczbę boków i gwiazdę zmienia się we właściwościach.
  dodajWielokat(boki = 3, gwiazda = false) {
    const p = new fabric.Polygon(punktyWielokata(boki, gwiazda, 18), {
      fill: '#e2f2d9', stroke: '#1a1a1a', strokeWidth: 0.3, strokeUniform: true, boki, gwiazda: gwiazda || undefined,
    });
    p.set(this._srodek(p.width, p.height));
    return this._wstaw(p);
  }

  // Zmienia liczbę boków wielokąta albo robi z niego gwiazdę; środek i wielkość zostają.
  przeksztalcWielokat(obj, boki, gwiazda) {
    const srodek = obj.getRelativeCenterPoint();
    const [w, h] = [obj.getScaledWidth(), obj.getScaledHeight()];
    obj.set({ boki: Math.min(24, Math.max(3, Math.round(boki) || 3)), gwiazda: gwiazda || undefined });
    obj.set({ points: punktyWielokata(obj.boki, gwiazda, 18) });
    obj.setBoundingBox();
    obj.set({ scaleX: w / (obj.width + obj.strokeWidth), scaleY: h / (obj.height + obj.strokeWidth) });
    obj.setPositionByOrigin(srodek, 'center', 'center');
    obj.dirty = true;
    obj.setCoords();
  }

  // ---------- Rysowanie odręczne ----------
  // W tym trybie przeciągnięcie po stronie rysuje wygładzoną linię (zwykły element: można go
  // przesuwać, skalować, zmieniać kolor i grubość). Tryb zostaje włączony do wyłączenia albo Esc.

  get rysuje() { return Boolean(this.canvas.isDrawingMode); }

  ustawRysowanie(wlacz, { kolor = '#1a1a1a', grubosc = 0.6 } = {}) {
    const c = this.canvas;
    if (wlacz === this.rysuje) return;
    if (wlacz) {
      if (this._kadr) this.zakonczKadrowanie(true);
      if (this._pioro) this.ustawPioro(false);
      if (this._punkty) this.zakonczPunkty(true);
      c.discardActiveObject();
      const pedzel = new fabric.PencilBrush(c);
      pedzel.color = kolor;
      pedzel.width = grubosc;
      pedzel.decimate = 0.4; // wygładza drżenie ręki
      pedzel.strokeLineCap = 'round';
      pedzel.strokeLineJoin = 'round';
      c.freeDrawingBrush = pedzel;
      if (!this._rysunekPodpiety) {
        this._rysunekPodpiety = true;
        c.on('path:created', (e) => {
          e.path.set({ id: uid('o'), fill: '', strokeUniform: true, strokeLineCap: 'round', strokeLineJoin: 'round' });
          e.path.setCoords();
          this.oznaczZmiane();
        });
      }
    }
    c.isDrawingMode = Boolean(wlacz);
    c.requestRenderAll();
    this.dispatchEvent(new CustomEvent('rysowanie', { detail: this.rysuje }));
  }

  // ---------- Pióro: kształt z punktów i krzywych ----------
  // Kliknięcie stawia punkt (odcinek prosty), kliknięcie z przeciągnięciem – punkt gładki z uchwytami
  // (krzywa). Enter albo podwójne kliknięcie kończy kształt otwarty, kliknięcie w pierwszy punkt zamyka,
  // Backspace cofa ostatni punkt, Esc porzuca zaczęty kształt (bez zaczętego – wyłącza pióro).
  // Punkt: { x, y, wx, wy (uchwyt wychodzący), ux, uy (uchwyt wchodzący) } – uchwyty tylko w punktach gładkich.

  get pioro() { return Boolean(this._pioro); }

  // Tryby, w których kliknięcia na płótnie nie zaznaczają elementów (pióro, edycja punktów).
  _trybPunktow() { return Boolean(this._pioro || this._punkty); }

  _ustawTrybPunktow() {
    const c = this.canvas;
    const wl = this._trybPunktow();
    c.skipTargetFind = wl || Boolean(this.reka);
    c.selection = !c.skipTargetFind;
    c.defaultCursor = wl ? 'crosshair' : 'default';
    c.requestRenderAll();
  }

  ustawPioro(wlacz) {
    if (Boolean(wlacz) === this.pioro) return;
    if (wlacz) {
      if (this._kadr) this.zakonczKadrowanie(true);
      if (this._punkty) this.zakonczPunkty(true);
      this.ustawRysowanie(false);
      if (this.aktywny?.isEditing) this.aktywny.exitEditing();
      this.canvas.discardActiveObject();
      this._pioro = { punkty: [], ciagnie: null, kursor: null };
    } else {
      if (this._pioro.punkty.length > 1) this._ksztaltZPiora(false);
      this._pioro = null;
    }
    this._ustawTrybPunktow();
    this.dispatchEvent(new CustomEvent('pioro', { detail: this.pioro }));
    this._emitujZaznaczenie();
  }

  // Ile punktów ma zaczęty kształt (do panelu i testów).
  get punktyPiora() { return this._pioro ? this._pioro.punkty.length : 0; }

  _pioroMyszWDol(e) {
    const p = e.scenePoint;
    const { punkty } = this._pioro;
    const prog = 8 / this.skala;
    const blisko = (q) => q && Math.hypot(q.x - p.x, q.y - p.y) <= prog;
    // Kliknięcie w pierwszy punkt zamyka kształt.
    if (punkty.length > 1 && blisko(punkty[0])) { this._ksztaltZPiora(true); return; }
    // Drugie kliknięcie w to samo miejsce (podwójne kliknięcie) nie stawia drugiego punktu.
    if (blisko(punkty.at(-1))) return;
    const punkt = { x: p.x, y: p.y };
    punkty.push(punkt);
    this._pioro.ciagnie = punkt;
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
  }

  _pioroRuch(e) {
    const p = e.scenePoint;
    const { ciagnie } = this._pioro;
    if (ciagnie) {
      // Przeciągnięcie od postawionego punktu wyciąga z niego dwa uchwyty, symetrycznie.
      if (Math.hypot(p.x - ciagnie.x, p.y - ciagnie.y) > 3 / this.skala) Object.assign(ciagnie, { wx: p.x, wy: p.y, ux: 2 * ciagnie.x - p.x, uy: 2 * ciagnie.y - p.y });
    }
    this._pioro.kursor = { x: p.x, y: p.y };
    this.canvas.requestRenderAll();
  }

  // Polecenia ścieżki z punktów pióra (współrzędne w mm arkusza).
  _sciezkaZPunktow(punkty, zamknieta) {
    const l = (n) => Math.round(n * 1000) / 1000;
    const odcinek = (q, p) => (q.wx != null || p.ux != null
      ? ['C', l(q.wx ?? q.x), l(q.wy ?? q.y), l(p.ux ?? p.x), l(p.uy ?? p.y), l(p.x), l(p.y)]
      : ['L', l(p.x), l(p.y)]);
    const d = [['M', l(punkty[0].x), l(punkty[0].y)]];
    for (let i = 1; i < punkty.length; i += 1) d.push(odcinek(punkty[i - 1], punkty[i]));
    if (zamknieta) {
      const q = punkty.at(-1);
      if (q.wx != null || punkty[0].ux != null) d.push(odcinek(q, punkty[0]));
      d.push(['Z']);
    }
    return d;
  }

  // Zamienia zaczęty kształt w element strony. Pióro zostaje włączone – można rysować następny.
  _ksztaltZPiora(zamknieta) {
    const { punkty } = this._pioro;
    this._pioro.punkty = [];
    this._pioro.ciagnie = null;
    if (punkty.length < 2) { this.canvas.requestRenderAll(); return null; }
    const d = this._sciezkaZPunktow(punkty, zamknieta).map((k) => k.join(' ')).join(' ');
    const ksztalt = new fabric.Path(d, {
      id: uid('o'), fill: '', stroke: '#1a1a1a', strokeWidth: 0.6, strokeUniform: true, strokeLineCap: 'round', strokeLineJoin: 'round',
    });
    this.canvas.add(ksztalt);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    return ksztalt;
  }

  // Enter / podwójne kliknięcie: kończy kształt otwarty.
  zakonczKsztaltPiora() { return this._pioro ? this._ksztaltZPiora(false) : null; }

  // Backspace: cofa ostatni punkt.
  cofnijPunktPiora() {
    if (!this._pioro?.punkty.length) return;
    this._pioro.punkty.pop();
    this._pioro.ciagnie = null;
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
  }

  // Esc: porzuca zaczęty kształt; gdy nic nie zaczęto – wyłącza pióro.
  anulujPioro() {
    if (!this._pioro) return;
    if (!this._pioro.punkty.length) { this.ustawPioro(false); return; }
    this._pioro.punkty = [];
    this._pioro.ciagnie = null;
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
  }

  // ---------- Edycja punktów kształtu (z pióra i z rysowania odręcznego) ----------
  // Na czas edycji przekształcenie elementu (obrót, skala) jest wpisywane w jego punkty – współrzędne
  // ścieżki to wtedy po prostu milimetry arkusza. Punkty i uchwyty przeciąga się myszą; podwójne
  // kliknięcie w linię dodaje punkt, Delete usuwa zaznaczony. Enter zatwierdza, Esc przywraca kształt.

  get edytujePunkty() { return Boolean(this._punkty); }

  edytujPunkty(obj = this.aktywny) {
    if (this._punkty || !obj || obj.type !== 'path' || obj.zWzorca || obj.zablokowany || obj.group) return false;
    if (this._pioro) this.ustawPioro(false);
    this.ustawRysowanie(false);
    const przed = {
      path: obj.path.map((k) => [...k]), pathOffset: new fabric.Point(obj.pathOffset.x, obj.pathOffset.y), width: obj.width, height: obj.height,
      left: obj.left, top: obj.top, angle: obj.angle, scaleX: obj.scaleX, scaleY: obj.scaleY, skewX: obj.skewX, skewY: obj.skewY,
      flipX: obj.flipX, flipY: obj.flipY, strokeWidth: obj.strokeWidth, strokeUniform: obj.strokeUniform,
    };
    const m = obj.calcTransformMatrix();
    const o = obj.pathOffset;
    const sciezka = obj.path.map(([co, ...l]) => {
      const n = [co];
      for (let i = 0; i < l.length; i += 2) { const p = new fabric.Point(l[i] - o.x, l[i + 1] - o.y).transform(m); n.push(p.x, p.y); }
      return n;
    });
    if (!obj.strokeUniform) obj.strokeWidth *= (Math.abs(obj.scaleX) + Math.abs(obj.scaleY)) / 2;
    obj.set({ path: sciezka, angle: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, flipX: false, flipY: false, strokeUniform: true });
    this._punkty = { obj, przed, wybrany: null, ciagnie: null, zmienione: false };
    this._odswiezKsztalt();
    this.canvas.discardActiveObject();
    this._ustawTrybPunktow();
    this.dispatchEvent(new CustomEvent('punkty', { detail: true }));
    this._emitujZaznaczenie();
    return true;
  }

  // Po zmianie punktów: wymiary i położenie elementu liczone od nowa, punkty zostają na swoich miejscach.
  _odswiezKsztalt() {
    const { obj } = this._punkty;
    obj.setBoundingBox(true);
    obj.setCoords();
    obj.dirty = true;
    this.canvas.requestRenderAll();
  }

  // Punkty kształtu: [{ i (numer polecenia), a (miejsce współrzędnej w poleceniu), x, y, uchwyt, kotwica }].
  // Uchwyt krzywej należy do punktu, przy którym leży: pierwszy uchwyt polecenia C – do punktu początkowego,
  // drugi – do końcowego; uchwyt polecenia Q jest wspólny i przypisujemy go do punktu końcowego.
  _wezlyKsztaltu() {
    const wezly = [];
    let poprzedni = -1;
    this._punkty.obj.path.forEach((k, i) => {
      const [co] = k;
      if (co === 'M' || co === 'L') { wezly.push({ i, a: 1, x: k[1], y: k[2] }); poprzedni = wezly.length - 1; return; }
      if (co === 'C') {
        wezly.push({ i, a: 1, x: k[1], y: k[2], uchwyt: true, kotwica: poprzedni });
        wezly.push({ i, a: 5, x: k[5], y: k[6] });
        const koniec = wezly.length - 1;
        wezly.push({ i, a: 3, x: k[3], y: k[4], uchwyt: true, kotwica: koniec });
        poprzedni = koniec;
      } else if (co === 'Q') {
        wezly.push({ i, a: 3, x: k[3], y: k[4] });
        const koniec = wezly.length - 1;
        wezly.push({ i, a: 1, x: k[1], y: k[2], uchwyt: true, kotwica: koniec });
        poprzedni = koniec;
      }
    });
    return wezly;
  }

  // Liczba punktów kształtu (bez uchwytów) i zaznaczony punkt – do panelu i testów.
  get punktyKsztaltu() {
    if (!this._punkty) return null;
    const wezly = this._wezlyKsztaltu();
    const w = this._punkty.wybrany;
    return { ile: wezly.filter((x) => !x.uchwyt).length, wybrany: w ? wezly.filter((x) => !x.uchwyt).findIndex((x) => x.i === w.i && x.a === w.a) : -1, punkty: wezly.filter((x) => !x.uchwyt).map((x) => [x.x, x.y]) };
  }

  _wezelPod(p) {
    const prog = 7 / this.skala;
    const wezly = this._wezlyKsztaltu();
    const w = this._punkty.wybrany;
    const wybrany = w ? wezly.findIndex((x) => !x.uchwyt && x.i === w.i && x.a === w.a) : -1;
    const blisko = (x) => Math.hypot(x.x - p.x, x.y - p.y) <= prog;
    // Uchwyty widać tylko przy zaznaczonym punkcie – i tylko te da się złapać.
    return wezly.find((x) => x.uchwyt && x.kotwica === wybrany && blisko(x)) || wezly.find((x) => !x.uchwyt && blisko(x)) || null;
  }

  _punktyMyszWDol(e) {
    const stan = this._punkty;
    const p = e.scenePoint;
    const wezel = this._wezelPod(p);
    if (!wezel) { stan.wybrany = null; this.canvas.requestRenderAll(); this._emitujZaznaczenie(); return; }
    const sciezka = stan.obj.path;
    // Co przesuwa się razem: punkt ciągnie swoje uchwyty; pierwszy punkt zamkniętego kształtu – także
    // pokrywający się z nim koniec ostatniego odcinka.
    const razem = [[wezel.i, wezel.a]];
    if (!wezel.uchwyt) {
      stan.wybrany = { i: wezel.i, a: wezel.a };
      const wezly = this._wezlyKsztaltu();
      const nr = wezly.indexOf(wezly.find((x) => x.i === wezel.i && x.a === wezel.a));
      for (const u of wezly) if (u.uchwyt && u.kotwica === nr && sciezka[u.i][0] === 'C') razem.push([u.i, u.a]);
      if (wezel.i === 0) {
        const ostatni = [...wezly].reverse().find((x) => !x.uchwyt);
        if (ostatni && ostatni.i !== 0 && Math.hypot(ostatni.x - wezel.x, ostatni.y - wezel.y) < 0.01) {
          razem.push([ostatni.i, ostatni.a]);
          const nrOstatniego = wezly.indexOf(ostatni);
          for (const u of wezly) if (u.uchwyt && u.kotwica === nrOstatniego && sciezka[u.i][0] === 'C') razem.push([u.i, u.a]);
        }
      }
    }
    stan.ciagnie = { od: { x: p.x, y: p.y }, razem: razem.map(([i, a]) => ({ i, a, x: sciezka[i][a], y: sciezka[i][a + 1] })) };
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
  }

  _punktyRuch(e) {
    const stan = this._punkty;
    if (!stan.ciagnie) return;
    const dx = e.scenePoint.x - stan.ciagnie.od.x;
    const dy = e.scenePoint.y - stan.ciagnie.od.y;
    for (const r of stan.ciagnie.razem) { stan.obj.path[r.i][r.a] = r.x + dx; stan.obj.path[r.i][r.a + 1] = r.y + dy; }
    stan.zmienione = true;
    this._odswiezKsztalt();
  }

  // Przesuwa punkt kształtu o wektor w mm (do skryptów i testów; myszą robi to przeciągnięcie).
  przesunPunkt(nr, dx, dy) {
    if (!this._punkty) return false;
    const punkt = this._wezlyKsztaltu().filter((x) => !x.uchwyt)[nr];
    if (!punkt) return false;
    this._punktyMyszWDol({ scenePoint: { x: punkt.x, y: punkt.y } });
    this._punktyRuch({ scenePoint: { x: punkt.x + dx, y: punkt.y + dy } });
    this._punkty.ciagnie = null;
    return true;
  }

  // Delete: usuwa zaznaczony punkt (kształt musi zachować co najmniej dwa punkty, zamknięty – trzy).
  usunPunkt() {
    const stan = this._punkty;
    if (!stan?.wybrany) return false;
    const sciezka = stan.obj.path;
    const zamkniety = sciezka.some((k) => k[0] === 'Z');
    const ile = this._wezlyKsztaltu().filter((x) => !x.uchwyt).length;
    if (ile <= (zamkniety ? 3 : 2)) return false;
    const { i } = stan.wybrany;
    if (i === 0) {
      // Początek przechodzi do końca następnego odcinka.
      const nast = sciezka[1];
      sciezka.splice(0, 2, ['M', nast.at(-2), nast.at(-1)]);
      // Zamknięty kształt: odcinek, który wracał do dawnego początku, kończy się teraz w nowym.
      const ostatni = [...sciezka].reverse().find((k) => k[0] !== 'Z');
      if (zamkniety && ostatni && ostatni !== sciezka[0] && ostatni[0] === 'C') { ostatni[5] = sciezka[0][1]; ostatni[6] = sciezka[0][2]; }
    } else sciezka.splice(i, 1);
    stan.wybrany = null;
    stan.zmienione = true;
    this._odswiezKsztalt();
    this._emitujZaznaczenie();
    return true;
  }

  // Odcinki kształtu z punktami początkowymi: [{ i, od: [x, y], k (polecenie) }]; odcinek zamykający ma i = -1.
  _odcinkiKsztaltu() {
    const odcinki = [];
    let tu = null;
    let start = null;
    this._punkty.obj.path.forEach((k, i) => {
      if (k[0] === 'M') { tu = [k[1], k[2]]; start = tu; return; }
      if (k[0] === 'Z') { if (tu && start && Math.hypot(tu[0] - start[0], tu[1] - start[1]) > 0.01) odcinki.push({ i: -1, przedZ: i, od: tu, k: ['L', start[0], start[1]] }); return; }
      odcinki.push({ i, od: tu, k });
      tu = [k.at(-2), k.at(-1)];
    });
    return odcinki;
  }

  // Dodaje punkt na linii kształtu najbliżej podanego miejsca (podwójne kliknięcie w linię).
  dodajPunkt(p) {
    const stan = this._punkty;
    if (!stan) return false;
    const mieszaj = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const naOdcinku = (o, t) => {
      const { k, od } = o;
      if (k[0] === 'L') return mieszaj(od, [k[1], k[2]], t);
      if (k[0] === 'Q') { const a = mieszaj(od, [k[1], k[2]], t); const b = mieszaj([k[1], k[2]], [k[3], k[4]], t); return mieszaj(a, b, t); }
      const a = mieszaj(od, [k[1], k[2]], t); const b = mieszaj([k[1], k[2]], [k[3], k[4]], t); const c = mieszaj([k[3], k[4]], [k[5], k[6]], t);
      return mieszaj(mieszaj(a, b, t), mieszaj(b, c, t), t);
    };
    let najlepszy = null;
    for (const o of this._odcinkiKsztaltu()) {
      for (let n = 1; n < 40; n += 1) {
        const t = n / 40;
        const q = naOdcinku(o, t);
        const d = Math.hypot(q[0] - p.x, q[1] - p.y);
        if (!najlepszy || d < najlepszy.d) najlepszy = { d, o, t, q };
      }
    }
    if (!najlepszy || najlepszy.d > 8 / this.skala) return false;
    const { o, t, q } = najlepszy;
    const { k, od } = o;
    const sciezka = stan.obj.path;
    let nowe;
    if (k[0] === 'L') nowe = [['L', q[0], q[1]], ['L', k[1], k[2]]];
    else if (k[0] === 'Q') {
      const a = mieszaj(od, [k[1], k[2]], t); const b = mieszaj([k[1], k[2]], [k[3], k[4]], t);
      nowe = [['Q', a[0], a[1], q[0], q[1]], ['Q', b[0], b[1], k[3], k[4]]];
    } else {
      const a = mieszaj(od, [k[1], k[2]], t); const b = mieszaj([k[1], k[2]], [k[3], k[4]], t); const c = mieszaj([k[3], k[4]], [k[5], k[6]], t);
      const ab = mieszaj(a, b, t); const bc = mieszaj(b, c, t);
      nowe = [['C', a[0], a[1], ab[0], ab[1], q[0], q[1]], ['C', bc[0], bc[1], c[0], c[1], k[5], k[6]]];
    }
    if (o.i < 0) sciezka.splice(o.przedZ, 0, nowe[0]); // odcinek zamykający: nowy punkt przed „Z”
    else sciezka.splice(o.i, 1, ...nowe);
    const i = o.i < 0 ? o.przedZ : o.i;
    stan.wybrany = { i, a: sciezka[i][0] === 'C' ? 5 : (sciezka[i][0] === 'Q' ? 3 : 1) };
    stan.zmienione = true;
    this._odswiezKsztalt();
    this._emitujZaznaczenie();
    return true;
  }

  // Koniec edycji punktów: zatwierdzenie (krok historii) albo powrót do kształtu sprzed edycji.
  zakonczPunkty(zatwierdz = true) {
    const stan = this._punkty;
    if (!stan) return;
    this._punkty = null;
    const { obj } = stan;
    const naPlotnie = this.canvas.getObjects().includes(obj);
    if (naPlotnie && !zatwierdz) { obj.set(stan.przed); obj.setCoords(); obj.dirty = true; }
    this._ustawTrybPunktow();
    if (naPlotnie) {
      this.canvas.setActiveObject(obj);
      if (stan.zmienione) this.oznaczZmiane(); // także po anulowaniu: projekt ma trzymać to, co widać
    }
    this.dispatchEvent(new CustomEvent('punkty', { detail: false }));
    this._emitujZaznaczenie();
  }

  // Rysuje na wierzchu płótna: zaczęty kształt pióra albo punkty i uchwyty edytowanego kształtu.
  _rysujPunkty(ctx, X, Y) {
    const NIEBIESKI = '#2563eb';
    const kwadrat = (x, y, pelny, r = 3.5) => { ctx.beginPath(); ctx.rect(X(x) - r, Y(y) - r, 2 * r, 2 * r); ctx.fillStyle = pelny ? NIEBIESKI : '#ffffff'; ctx.fill(); ctx.stroke(); };
    const kolko = (x, y, r = 3) => { ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke(); };
    const ramie = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); };
    ctx.save();
    ctx.strokeStyle = NIEBIESKI;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    if (this._pioro) {
      const { punkty, kursor, ciagnie } = this._pioro;
      if (punkty.length) {
        ctx.beginPath();
        ctx.moveTo(X(punkty[0].x), Y(punkty[0].y));
        for (let i = 1; i < punkty.length; i += 1) {
          const q = punkty[i - 1]; const p = punkty[i];
          if (q.wx != null || p.ux != null) ctx.bezierCurveTo(X(q.wx ?? q.x), Y(q.wy ?? q.y), X(p.ux ?? p.x), Y(p.uy ?? p.y), X(p.x), Y(p.y)); else ctx.lineTo(X(p.x), Y(p.y));
        }
        ctx.stroke();
        // Odcinek do kursora – podgląd tego, co powstanie po kliknięciu.
        const q = punkty.at(-1);
        if (kursor && !ciagnie) {
          ctx.save(); ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X(q.x), Y(q.y));
          if (q.wx != null) ctx.bezierCurveTo(X(q.wx), Y(q.wy), X(kursor.x), Y(kursor.y), X(kursor.x), Y(kursor.y)); else ctx.lineTo(X(kursor.x), Y(kursor.y));
          ctx.stroke(); ctx.restore();
        }
        ctx.lineWidth = 1;
        if (q.wx != null) { ramie(q.ux, q.uy, q.wx, q.wy); kolko(q.ux, q.uy); kolko(q.wx, q.wy); }
        punkty.forEach((p, i) => kwadrat(p.x, p.y, i === punkty.length - 1, i === 0 && punkty.length > 1 ? 5 : 3.5));
      }
    } else if (this._punkty && this.canvas.getObjects().includes(this._punkty.obj)) {
      const wezly = this._wezlyKsztaltu();
      const w = this._punkty.wybrany;
      const wybrany = w ? wezly.findIndex((x) => !x.uchwyt && x.i === w.i && x.a === w.a) : -1;
      ctx.lineWidth = 1;
      for (const u of wezly) if (u.uchwyt && u.kotwica === wybrany) { ramie(wezly[wybrany].x, wezly[wybrany].y, u.x, u.y); kolko(u.x, u.y); }
      wezly.forEach((x, nr) => { if (!x.uchwyt) kwadrat(x.x, x.y, nr === wybrany); });
    }
    ctx.restore();
  }

  dodajLinie() {
    const { left, top } = this._srodek(60, 0);
    return this._wstaw(new fabric.Line([left, top, left + 60, top], {
      stroke: '#1a1a1a', strokeWidth: 0.5, strokeUniform: true,
    }));
  }

  // dataUrl -> obraz dopasowany do 60% szerokości strony.
  async dodajObraz(dataUrl, nazwaPliku, zasoby) {
    const id = uid('z');
    zasoby[id] = { nazwa: nazwaPliku, dataUrl };
    // Duże zdjęcie pokazujemy lżejszą kopią roboczą; wymiary obiektu zostają w pikselach oryginału.
    await przygotujKopie(zasoby, [{ type: 'image', zasob: id }]);
    let img;
    try { img = await fabric.FabricImage.fromURL(zrodloObrazu(zasoby)(id)); } catch { throw new Error('Nie udało się wczytać obrazu.'); }
    const { nw, nh } = rozmiarOryginalu(img);
    img.set({ width: nw, height: nh });
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const skala = Math.min((w * 0.6) / img.width, (h * 0.6) / img.height);
    img.set({ zasob: id, nazwa: nazwaPliku, scaleX: skala, scaleY: skala });
    img.set(this._srodek(img.width * skala, img.height * skala));
    this.dispatchEvent(new Event('zasoby'));
    return this._wstaw(img);
  }

  // ---------- Operacje na zaznaczeniu ----------

  get aktywny() {
    return this.canvas.getActiveObject() || null;
  }

  usun() {
    const obiekty = this.canvas.getActiveObjects();
    if (!obiekty.length) return;
    if (this.aktywny?.isEditing) return;
    if (this._otwarta) { this._usunZOtwartej(); return; }
    this.canvas.discardActiveObject();
    // Tekst usuwanej ramki wątku przechodzi do sąsiedniej – znika ramka, nie treść.
    for (const o of obiekty) {
      const zostaja = this._calyWatek(o.watek).filter((r) => !obiekty.includes(r));
      if (!zostaja.length) continue;
      const przed = zostaja.filter((r) => r.watek_nr < o.watek_nr).at(-1);
      przeniesTekst(o, przed || zostaja[0], Boolean(przed));
    }
    obiekty.forEach((o) => this.canvas.remove(o));
    this.canvas.requestRenderAll();
  }

  async duplikuj() {
    const akt = this.aktywny;
    if (!akt) return;
    const kopie = await this._kopie(akt);
    const g = this._otwarta;
    if (g && akt.parent === g && kopie.length === 1) {
      // Kopia elementu otwartej grupy zostaje w tej grupie (grupa sama przelicza jej położenie i swoją ramkę).
      const [k] = kopie;
      k.set({ id: uid('o'), left: k.left + 5, top: k.top + 5 });
      k.setCoords();
      g.add(k);
      this.canvas.setActiveObject(k);
      this.canvas.requestRenderAll();
      this.oznaczZmiane();
      return;
    }
    this.canvas.discardActiveObject();
    for (const k of kopie) k.set({ left: k.left + 5, top: k.top + 5 });
    this._wstawKopie(kopie);
  }

  // Kopie zaznaczonego elementu albo wszystkich elementów zaznaczenia – każda z położeniem
  // na arkuszu (element w zaznaczeniu ma położenie liczone względem tego zaznaczenia).
  async _kopie(obj) {
    const obiekty = toZaznaczenie(obj) ? obj.getObjects() : [obj];
    return Promise.all(obiekty.map(async (o) => {
      const k = await o.clone();
      if (o.group) fabric.util.applyTransformToObject(k, o.calcTransformMatrix());
      k.set({ evented: true });
      k.setCoords();
      return k;
    }));
  }

  // Wstawia kopie na arkusz (każda dostaje nowy identyfikator) i zaznacza je.
  _wstawKopie(kopie) {
    for (const k of kopie) { k.set({ id: uid('o') }); this.canvas.add(k); }
    this.canvas.setActiveObject(kopie.length === 1 ? kopie[0] : new fabric.ActiveSelection(kopie, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  // ---------- Przelewanie tekstu między ramkami, kolumny, tabela ----------

  // Ramki wątku leżące na płótnie (w kolejności czytania).
  _ramkiWatku(obj) {
    return obj?.watek ? (watki(this.canvas.getObjects().filter((o) => !o.zWzorca)).get(obj.watek) || []) : [];
  }

  // Cały wątek: ramki z płótna i ramki z innych stron (trzymane w pamięci), w kolejności czytania.
  _calyWatek(id) {
    if (!id) return [];
    const ramki = [...(this._poza || []).filter((p) => p.o.watek === id).map((p) => p.o), ...this.canvas.getObjects().filter((o) => !o.zWzorca && o.type === 'textbox' && o.watek === id)];
    return ramki.sort((a, b) => (a.watek_nr || 0) - (b.watek_nr || 0));
  }

  // Ramki wątków, które mają część na otwartych stronach, a część na innych: [{ strona: id, json }].
  // Ramki z innych stron żyją w pamięci, biorą udział w przelewaniu i wracają do projektu przy zapisie.
  async ustawRamkiPoza(lista) {
    const zywe = lista.length ? await fabric.util.enlivenObjects(lista.map((x) => JSON.parse(JSON.stringify(x.json)))) : [];
    this._poza = lista.map((x) => ({ strona: x.strona, o: zywe.find((o) => o.id === x.json.id) })).filter((x) => x.o);
    for (const p of this._poza) p.odcisk = this._odciskRamki(p.o);
    this.canvas.requestRenderAll();
  }

  _polaRamkiPoza(o) {
    const pola = { text: o.text, styles: fabric.util.stylesToArray(o.styles || {}, o.text), watek: o.watek, watek_nr: o.watek_nr, lacznik: o.lacznik, lista_start: o.lista_start, ramka_h: o.ramka_h };
    for (const k of WSPOLNE_W_WATKU) pola[k] = o[k];
    return pola;
  }

  _odciskRamki(o) { return JSON.stringify(this._polaRamkiPoza(o)); }

  // Ramki z innych stron zmienione od ostatniego zapisu: [{ strona, id, pola }] (pole undefined = usuń z zapisu).
  ramkiPozaDoZapisu() {
    const wynik = [];
    for (const p of this._poza || []) {
      const odcisk = this._odciskRamki(p.o);
      if (odcisk === p.odcisk) continue;
      p.odcisk = odcisk;
      wynik.push({ strona: p.strona, id: p.o.id, pola: this._polaRamkiPoza(p.o) });
    }
    return wynik;
  }

  // Opis wątku zaznaczonej ramki albo null: { nr, ile, innychStron, poprzednia, nastepna } –
  // poprzednia/nastepna to { strona, id } ramki leżącej na innej stronie (albo null).
  watekRamki(obj = this.aktywny) {
    const ramki = this._calyWatek(obj?.watek);
    if (ramki.length < 2 || !ramki.includes(obj)) return null;
    const i = ramki.indexOf(obj);
    const poza = (r) => { const p = r && (this._poza || []).find((x) => x.o === r); return p ? { strona: p.strona, id: r.id } : null; };
    return {
      nr: i + 1, ile: ramki.length,
      innychStron: new Set((this._poza || []).filter((p) => p.o.watek === obj.watek).map((p) => p.strona)).size,
      poprzednia: poza(ramki[i - 1]), nastepna: poza(ramki[i + 1]),
    };
  }

  // Po wybraniu czcionki, której przeglądarka jeszcze nie pobrała: gdy pliki dojdą, teksty tą czcionką
  // są mierzone od nowa (do tej chwili były rysowane czcionką zastępczą).
  async doczytajCzcionke(rodzina) {
    await zapewnijRodziny([rodzina]);
    const przelicz = (lista) => {
      for (const o of lista) {
        if (o._objects) { przelicz(o._objects); if (o.tabela) ulozTabele(o); continue; }
        if (typeof o.text !== 'string') continue;
        const uzywa = o.fontFamily === rodzina || Object.values(o.styles || {}).some((w) => Object.values(w || {}).some((s) => s?.fontFamily === rodzina));
        if (uzywa) { o.initDimensions(); o.setCoords(); o.dirty = true; }
      }
    };
    przelicz(this.canvas.getObjects());
    this._pilnujWatkow();
    this.przeliczOstrzezenia();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
  }

  // Przelewa tekst od razu (np. po dodaniu ramki na innej stronie).
  przelejWatki() {
    this._pilnujWatkow();
    this.canvas.requestRenderAll();
  }

  // Porządkuje wątki po każdej zmianie i przelewa tekst. Kopia ramki (powielenie,
  // wklejenie) ma ten sam numer co oryginał – zostaje zwykłą, niepołączoną ramką.
  _pilnujWatkow() {
    const akt = this.aktywny;
    const naPlotnie = watki(this.canvas.getObjects().filter((o) => !o.zWzorca));
    const poza = this._poza || [];
    for (const id of new Set([...naPlotnie.keys(), ...poza.map((p) => p.o.watek).filter(Boolean)])) {
      const zInnychStron = poza.filter((p) => p.o.watek === id).map((p) => p.o);
      const numery = new Set(zInnychStron.map((r) => r.watek_nr));
      const tutaj = [];
      for (const r of naPlotnie.get(id) || []) {
        if (numery.has(r.watek_nr)) odlaczRamke(r); else { numery.add(r.watek_nr); tutaj.push(r); }
      }
      const ramki = [...zInnychStron, ...tutaj].sort((a, b) => (a.watek_nr || 0) - (b.watek_nr || 0));
      if (ramki.length < 2) { ramki.forEach(odlaczRamke); continue; }
      ramki.forEach((r, i) => {
        r.watek_nr = i;
        if (!(r.ramka_h > 0)) r.ramka_h = r.height; // tekst płynie dalej tylko z ramki o stałej wysokości
      });
      // W trakcie pisania tekst przelewa się osobno, z pilnowaniem kursora (_przelejPrzyPisaniu).
      if (ramki.some((r) => r.isEditing)) continue;
      if (ramki.includes(akt)) {
        for (const r of ramki) if (r !== akt) for (const k of WSPOLNE_W_WATKU) if (r[k] !== akt[k]) r.set(k, akt[k]);
      }
      rozlej(ramki);
    }
  }

  // Miejsce początku części ramki w sklejonym tekście całego wątku.
  _poczatekWWatku(ramki, r) {
    let dl = 0;
    let bylo = false;
    for (const x of ramki) {
      const lacznik = bylo && x.text ? (x.lacznik ?? '\n').length : 0;
      if (x === r) return dl + lacznik;
      if (!x.text) continue;
      dl += lacznik + x.text.length;
      bylo = true;
    }
    return dl;
  }

  // Przenosi pisanie do innej ramki na płótnie, z kursorem przy znaku `indeks`.
  _piszW(cel, indeks, z) {
    if (z?.isEditing) z.exitEditing();
    this.canvas.setActiveObject(cel);
    cel.enterEditing();
    const gdzie = Math.min(Math.max(0, indeks), cel._text.length);
    cel.selectionStart = gdzie; cel.selectionEnd = gdzie;
    cel._updateTextarea?.();
    this.canvas.requestRenderAll();
  }

  // Przelewa wątek i stawia kursor przy znaku, który w sklejonym tekście wątku stoi na miejscu `kursor`.
  // Jeśli znak trafił do innej ramki na tej stronie, pisanie przenosi się tam; jeśli do ramki na innej
  // stronie – kursor zostaje w `obj` (gdyPoza: 'koniec' albo 'poczatek' tej ramki).
  // zawsze: ustaw kursor także wtedy, gdy przelewanie niczego nie przesunęło.
  _przelejZKursorem(ramki, obj, kursor, { gdyPoza = 'koniec', zawsze = false } = {}) {
    if (!rozlej(ramki) && !zawsze) return;
    const znakow = (r, n) => (r.graphemeSplit ? r.graphemeSplit(r.text.slice(0, n)).length : n);
    let cel = ramki.at(-1);
    for (const r of ramki) if (kursor <= this._poczatekWWatku(ramki, r) + r.text.length) { cel = r; break; }
    const lokalnie = Math.max(0, kursor - this._poczatekWWatku(ramki, cel));
    if (cel === obj || !this.canvas.getObjects().includes(cel)) {
      const gdzie = cel === obj ? Math.min(znakow(obj, lokalnie), obj._text.length) : (gdyPoza === 'poczatek' ? 0 : obj._text.length);
      obj.selectionStart = gdzie; obj.selectionEnd = gdzie;
      if (obj.hiddenTextarea) obj.hiddenTextarea.value = obj.text;
      obj._updateTextarea?.();
      // Dalszy ciąg jest na innej stronie – kursor zostaje tutaj.
      if (cel !== obj && gdyPoza === 'koniec') this.dispatchEvent(new CustomEvent('tekst-na-innej-stronie', { detail: (this._poza || []).find((p) => p.o === cel)?.strona }));
    } else this._piszW(cel, znakow(cel, lokalnie), obj);
    this.canvas.requestRenderAll();
  }

  // Pisanie w połączonej ramce: tekst, który przestał się mieścić, od razu płynie dalej, a zwolnione
  // miejsce wypełnia tekst z następnych ramek. Kursor zostaje przy tym samym znaku – jeśli znak
  // przeszedł do następnej ramki na tej stronie, pisanie przenosi się tam.
  _przelejPrzyPisaniu(obj) {
    if (!obj?.watek || !obj.isEditing || obj.inCompositionMode || obj.zWzorca) return;
    const ramki = this._calyWatek(obj.watek);
    if (ramki.length < 2) return;
    const kursor = this._poczatekWWatku(ramki, obj) + obj._text.slice(0, obj.selectionStart).join('').length;
    this._przelejZKursorem(ramki, obj, kursor);
  }

  // Klawisze na granicy połączonych ramek. Backspace na samym początku ramki usuwa znak sprzed kursora –
  // czyli koniec poprzedniej części (albo odstęp między częściami); Delete na końcu – początek następnej.
  // Strzałki w lewo i w prawo przechodzą do sąsiedniej ramki, jeśli leży na tej stronie.
  _klawiszNaGranicyRamek(e) {
    const o = this.aktywny;
    if (!o?.isEditing || !o.watek || o.zWzorca || o.inCompositionMode || e.target !== o.hiddenTextarea) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    if (o.selectionStart !== o.selectionEnd) return;
    const wstecz = e.key === 'Backspace' || e.key === 'ArrowLeft';
    if (o.selectionStart !== (wstecz ? 0 : o._text.length)) return;
    const ramki = this._calyWatek(o.watek);
    const i = ramki.indexOf(o);
    // Wstecz: najbliższa wcześniejsza ramka z tekstem; w przód: najbliższa dalsza z tekstem.
    const sasiad = wstecz ? ramki.slice(0, i).reverse().find((r) => r.text) : ramki.slice(i + 1).find((r) => r.text);
    if (!sasiad) return;
    const naPlotnie = this.canvas.getObjects().includes(sasiad);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!naPlotnie) return;
      e.preventDefault(); e.stopPropagation();
      this._piszW(sasiad, wstecz ? sasiad._text.length : 0, o);
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (wstecz) {
      // Między częściami stoi łącznik (spacja albo nowy akapit) – on znika pierwszy; inaczej ostatni znak poprzedniej części.
      if (o.text && (o.lacznik ?? '\n')) o.lacznik = '';
      else sasiad.removeChars(sasiad._text.length - 1, sasiad._text.length);
      this._przelejZKursorem(ramki, o, this._poczatekWWatku(ramki, o), { gdyPoza: 'poczatek', zawsze: true });
    } else {
      const kursor = this._poczatekWWatku(ramki, o) + o.text.length;
      if (ramki.slice(0, ramki.indexOf(sasiad)).some((r) => r.text) && (sasiad.lacznik ?? '\n')) sasiad.lacznik = '';
      else sasiad.removeChars(0, 1);
      this._przelejZKursorem(ramki, o, kursor, { gdyPoza: 'koniec', zawsze: true });
    }
  }

  // Łączy zaznaczone ramki tekstu: tekst, który nie mieści się w pierwszej,
  // płynie do następnej (kolejność: z góry na dół, obok siebie – od lewej).
  polaczRamki() {
    const akt = this.aktywny;
    if (!akt || !toZaznaczenie(akt)) return false;
    const wybrane = akt.getObjects();
    if (wybrane.length < 2 || wybrane.some((o) => o.type !== 'textbox' || o.zWzorca)) return false;
    this.canvas.discardActiveObject(); // poza zaznaczeniem ramki mają położenie na stronie
    const id = uid('w');
    kolejnoscCzytania(wybrane).forEach((r, i) => {
      if (r.text === TEKST_ZACHETY && i) { r.text = ''; r.styles = {}; }
      r.set({ watek: id, watek_nr: i, lacznik: i ? '\n' : undefined });
      if (!(r.ramka_h > 0)) r.ramka_h = r.height;
      r.autodopasowanie = undefined;
    });
    this.canvas.setActiveObject(new fabric.ActiveSelection(wybrane, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return true;
  }

  // Nowa ramka z ciągiem dalszym tekstu: obok zaznaczonej, a gdy się nie mieści – pod nią.
  async dodajRamkeDalsza(odstep = 5) {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'textbox' || akt.zWzorca || akt.isEditing) return null;
    const ramki = this._calyWatek(akt.watek);
    const nowa = await akt.clone();
    const szer = akt.getScaledWidth();
    const wys = akt.getScaledHeight();
    const prawaKrawedz = this.strony[this.aktywna].x + this.wydruk.szerokosc_mm;
    const obok = akt.left + 2 * szer + odstep <= prawaKrawedz + 0.01;
    if (!(akt.ramka_h > 0)) akt.ramka_h = akt.height;
    akt.autodopasowanie = undefined;
    if (!akt.watek) akt.set({ watek: uid('w'), watek_nr: 0 });
    for (const r of ramki) if (r.watek_nr > akt.watek_nr) r.watek_nr += 1;
    nowa.set({
      id: uid('o'), text: '', styles: {}, evented: true,
      left: obok ? akt.left + szer + odstep : akt.left,
      top: obok ? akt.top : akt.top + wys + odstep,
      ramka_h: akt.ramka_h, autodopasowanie: undefined,
      watek: akt.watek, watek_nr: akt.watek_nr + 1, lacznik: '\n',
    });
    this.canvas.add(nowa);
    this.canvas.setActiveObject(nowa);
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return nowa;
  }

  // Dzieli ramkę na n kolumn: połączone ramki obok siebie, przez które płynie tekst.
  async podzielNaKolumny(n, odstep = 4) {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'textbox' || akt.zWzorca || akt.isEditing || akt.watek || !(n > 1)) return false;
    const szer = akt.getScaledWidth();
    const kolumna = (szer - (n - 1) * odstep) / n;
    if (kolumna < 8) return false;
    const stala = akt.ramka_h > 0;
    akt.autodopasowanie = undefined;
    akt.set({ width: kolumna / akt.scaleX });
    akt.initDimensions();
    if (!stala) {
      // Kolumny równej wysokości: tyle wierszy na kolumnę, żeby tekst rozłożył się po równo.
      const wierszy = Math.ceil(akt._textLines.length / n);
      let h = 0;
      for (let i = 0; i < wierszy; i += 1) h += akt.getHeightOfLine(i);
      akt.ramka_h = Math.max(h, akt.getHeightOfLine(0)) + 0.01;
      akt.initDimensions();
    }
    // Najpierw wszystkie kopie (to trwa chwilę), dopiero potem łączenie – jednym ruchem,
    // żeby porządkowanie wątków nie zobaczyło ramki połączonej z niczym.
    const nowe = await Promise.all(Array.from({ length: n - 1 }, () => akt.clone()));
    const id = uid('w');
    akt.set({ watek: id, watek_nr: 0 });
    nowe.forEach((nowa, i) => {
      nowa.set({ id: uid('o'), text: '', styles: {}, evented: true, left: akt.left + (i + 1) * (kolumna + odstep), watek: id, watek_nr: i + 1, lacznik: '\n' });
      this.canvas.add(nowa);
    });
    akt.setCoords();
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return true;
  }

  // Rozłącza wątek zaznaczonej ramki: każda ramka zostaje ze swoją częścią tekstu.
  rozlaczRamki() {
    const akt = this.aktywny;
    const zaznaczone = toZaznaczenie(akt) ? akt.getObjects() : [akt];
    const ramki = new Set(zaznaczone.flatMap((o) => this._calyWatek(o?.watek)));
    if (!ramki.size) return false;
    ramki.forEach(odlaczRamke);
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return true;
  }

  // Tabela: jeden element strony (js/tabela-obiekt.js). Pojedyncze kliknięcie zaznacza całość,
  // podwójne kliknięcie komórki zaczyna w niej pisanie.
  dodajTabele({ wiersze = 3, kolumny = 3, naglowek = true, wysokoscWiersza = 9 } = {}) {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const szer = Math.max(20, w - this.marg.lewy - this.marg.prawy);
    const tabela = nowaTabela({
      wiersze, kolumny, naglowek, wysokoscWiersza, szerokosc: szer,
      lewo: this.strony[this.aktywna].x + this.marg.lewy, gora: 0,
      wyglad: { fontFamily: DOMYSLNA, fontSize: ptNaMm(9) },
    }, uid);
    tabela.set({ top: Math.max(this.marg.gora, (h - tabela.height) / 2) });
    tabela.setCoords();
    this.canvas.discardActiveObject();
    this.canvas.add(tabela);
    this.canvas.setActiveObject(tabela);
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    return tabela;
  }

  // Skalowanie tabeli uchwytem narożnym na bieżąco: skala zamienia się w wymiary kolumn i wierszy,
  // a narożnik naprzeciwko uchwytu zostaje na miejscu.
  _skalujTabele(tabela, przeksztalcenie) {
    if (!toTabela(tabela) || !przeksztalcenie) return;
    const { originX, originY } = przeksztalcenie;
    const kotwica = tabela.translateToOriginPoint(tabela.getRelativeCenterPoint(), originX, originY);
    if (!utrwalSkaleTabeli(tabela)) return;
    tabela.setPositionByOrigin(kotwica, originX, originY);
    tabela.setCoords();
  }

  // Uchwyty kolumn i klawisz Tab w komórkach – dla każdej tabeli na płótnie.
  _przygotujTabele(tabela) {
    przygotujTabele(tabela, { naTab: (komorka, wstecz) => this._nastepnaKomorka(komorka, wstecz) });
  }

  // Komórki tabeli wierszami (do skryptów i testów).
  komorkiTabeli(tabela = this.aktywny) { return toTabela(tabela) ? komorkiTabeli(tabela) : []; }

  // Zaczyna pisanie w komórce. komorka: obiekt komórki albo [wiersz, kolumna]; zdarzenie: kliknięcie
  // (kursor staje w miejscu kliknięcia) – bez niego zaznaczony jest cały tekst komórki.
  edytujKomorke(tabela, komorka, zdarzenie) {
    if (!toTabela(tabela) || tabela.zWzorca) return null;
    const c = Array.isArray(komorka) ? komorkiTabeli(tabela)[komorka[0] * tabela.tabela.kolumny.length + komorka[1]] : komorka;
    if (!c || c.group !== tabela) return null;
    const poprzednia = this.aktywny;
    this._miedzyKomorkami = true;
    if (poprzednia?.isEditing && poprzednia !== c) poprzednia.exitEditing();
    this._miedzyKomorkami = false;
    // Na czas pisania komórki tabeli dają się wskazać; po wyjściu tabela znów jest jednym elementem.
    tabela.set({ subTargetCheck: true, interactive: true });
    this.canvas.setActiveObject(c);
    c.enterEditing(zdarzenie);
    if (zdarzenie) c.setCursorByClick(zdarzenie); else c.selectAll();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    return c;
  }

  // Tab / Shift+Tab: następna / poprzednia komórka. Tab w ostatniej komórce dodaje wiersz.
  _nastepnaKomorka(komorka, wstecz) {
    const tabela = komorka.group;
    if (!toTabela(tabela)) return;
    let lista = komorkiTabeli(tabela);
    const krok = wstecz ? -1 : 1;
    let i = lista.indexOf(komorka) + krok;
    // Komórki schowane pod scaleniem są pomijane.
    while (lista[i] && komorkaSchowana(tabela, lista[i])) i += krok;
    if (i < 0) return;
    if (i >= lista.length) {
      const pierwsza = lista.length;
      if (dodajWiersz(tabela, uid) < 0) return;
      this._przygotujTabele(tabela);
      lista = komorkiTabeli(tabela);
      i = pierwsza;
      while (lista[i] && komorkaSchowana(tabela, lista[i])) i += 1;
      if (!lista[i]) return;
    }
    this.edytujKomorke(tabela, lista[i]);
  }

  // Po wyjściu z pisania w komórce: układ tabeli od nowa i powrót do zaznaczenia całej tabeli
  // (chyba że pisanie przeszło do innej komórki albo kliknięto coś innego).
  _poKomorce(komorka) {
    const tabela = komorka?.group;
    if (!toTabela(tabela)) return;
    ulozTabele(tabela);
    if (this._miedzyKomorkami) return;
    Promise.resolve().then(() => {
      const a = this.canvas.getActiveObject();
      if (a?.group === tabela && a.isEditing) return;
      tabela.set({ subTargetCheck: false, interactive: false });
      if (a?.group === tabela) this.canvas.setActiveObject(tabela);
      this.canvas.requestRenderAll();
      this._emitujZaznaczenie();
    });
  }

  // Wiersze, kolumny i scalenia tabeli. co: 'wiersz+' | 'wiersz-' | 'kolumna+' | 'kolumna-' – gdzie: numer
  // wiersza albo kolumny (dodawanie – za nim, usuwanie – ten; bez numeru chodzi o ostatni);
  // 'scal-prawo' | 'scal-dol' | 'rozdziel' – gdzie: { w, k } komórki.
  zmienTabele(tabela, co, gdzie) {
    if (!toTabela(tabela)) return false;
    const akt = this.aktywny;
    let pisana = akt?.group === tabela && akt.isEditing ? akt : null;
    if (pisana) { this._miedzyKomorkami = true; pisana.exitEditing(); this._miedzyKomorkami = false; }
    const scal = (kierunek) => { const c = scalKomorki(tabela, gdzie.w, gdzie.k, kierunek); if (c && pisana) pisana = c; return Boolean(c); };
    const wynik = {
      'wiersz+': () => dodajWiersz(tabela, uid, gdzie) >= 0,
      'wiersz-': () => usunWiersz(tabela, gdzie),
      'kolumna+': () => dodajKolumne(tabela, uid, gdzie) >= 0,
      'kolumna-': () => usunKolumne(tabela, gdzie),
      'scal-prawo': () => scal('prawo'),
      'scal-dol': () => scal('dol'),
      rozdziel: () => rozdzielKomorki(tabela, gdzie.w, gdzie.k),
    }[co]?.();
    this._przygotujTabele(tabela);
    // Pisanie wraca do tej samej komórki, jeśli jeszcze istnieje i jest widoczna (po scaleniu – do scalonej).
    if (pisana && pisana.group === tabela && komorkaSchowana(tabela, pisana)) {
      const m = miejsceKomorki(tabela, pisana);
      const s = tabela.tabela.scalenia?.find((x) => m.w >= x.w && m.w < x.w + x.ileW && m.k >= x.k && m.k < x.k + x.ileK);
      pisana = s ? komorkiTabeli(tabela)[s.w * tabela.tabela.kolumny.length + s.k] : null;
    }
    if (pisana && pisana.group === tabela) this.edytujKomorke(tabela, pisana);
    else { tabela.set({ subTargetCheck: false, interactive: false }); this.canvas.setActiveObject(tabela); }
    tabela.setCoords();
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
    this._emitujZaznaczenie();
    return Boolean(wynik);
  }

  // Miejsce komórki w tabeli: { w, k } albo null.
  miejsceKomorki(komorka = this.aktywny) { return toTabela(komorka?.group) ? miejsceKomorki(komorka.group, komorka) : null; }

  // Scalenie, do którego należy komórka: { w, k, ileW, ileK } albo null.
  scalenieKomorki(komorka = this.aktywny) {
    const m = this.miejsceKomorki(komorka);
    return (m && komorka.group.tabela.scalenia?.find((s) => m.w >= s.w && m.w < s.w + s.ileW && m.k >= s.k && m.k < s.k + s.ileK)) || null;
  }

  // ---------- Schowek (kopiuj / wklej, także między stronami) ----------

  get maSchowek() { return Boolean(this._schowek); }

  async kopiuj() {
    const akt = this.aktywny;
    if (!akt || akt.isEditing) return false;
    this._schowek = await this._kopie(akt);
    this._wklejen = 0;
    this._schowekZ = this._znacznikStrony;
    this._schowekX = this.strony[this.stronaW(this._srodekObiektu(akt).x)].x;
    // Schowek systemu dostaje tekst elementu (albo jego nazwę). Dzięki temu Ctrl+V wkleja to,
    // co skopiowano ostatnio – a nie obraz, który został w schowku systemu sprzed godziny.
    navigator.clipboard?.writeText(akt.type === 'textbox' && akt.text ? akt.text : `Seriodruk: ${opisObiektu(akt)}`).catch(() => {});
    this.dispatchEvent(new Event('schowek'));
    return true;
  }

  async wytnij() {
    if (await this.kopiuj()) this.usun();
  }

  // Na tym samym arkuszu wklejka jest lekko przesunięta, na innym trafia w to
  // samo miejsce strony bieżącej.
  async wklej() {
    if (!this._schowek) return;
    if (this._schowekZ === this._znacznikStrony) this._wklejen += 1;
    else {
      const dx = this.strony[this.aktywna].x - this._schowekX;
      for (const o of this._schowek) o.set({ left: o.left + dx });
      this._schowekX += dx;
      this._wklejen = 0;
      this._schowekZ = this._znacznikStrony;
    }
    const d = 5 * this._wklejen;
    const kopie = await Promise.all(this._schowek.map((o) => o.clone()));
    this.canvas.discardActiveObject();
    for (const k of kopie) k.set({ left: k.left + d, top: k.top + d, evented: true });
    this._wstawKopie(kopie);
  }

  // ---------- Wyrównywanie i rozmieszczanie ----------

  // Rozbija zaznaczenie na obiekty z położeniem na stronie, wykonuje fn i zaznacza ponownie.
  _naZaznaczonych(fn) {
    const akt = this.aktywny;
    if (!akt || this._otwarta) return; // element otwartej grupy wyrównuje się ręcznie albo liczbami
    const obiekty = toZaznaczenie(akt) ? akt.getObjects().slice() : [akt];
    this.canvas.discardActiveObject();
    const ramki = obiekty.map((o) => { o.setCoords(); const r = o.getBoundingRect(); return { o, x: r.left, y: r.top, w: r.width, h: r.height }; });
    fn(ramki);
    for (const { o } of ramki) o.setCoords();
    if (obiekty.length > 1) this.canvas.setActiveObject(new fabric.ActiveSelection(obiekty, { canvas: this.canvas }));
    else this.canvas.setActiveObject(obiekty[0]);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // jak: 'lewo' | 'srodekX' | 'prawo' | 'gora' | 'srodekY' | 'dol'.
  // Kilka obiektów wyrównuje się do siebie, jeden – do obszaru w marginesach
  // strony, na której leży (element przez grzbiet: do obu stron razem).
  wyrownaj(jak) {
    this._naZaznaczonych((ramki) => {
      const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
      const obszar = (r) => {
        const przez = this._przezGrzbiet(r.x, r.x + r.w);
        const a = przez ? this.strony[0] : this.strony[this.stronaW(r.x + r.w / 2)];
        const z = przez ? this.strony[1] : a;
        return { x1: a.x + a.marg.lewy, x2: z.x + w - z.marg.prawy, y1: a.marg.gora, y2: h - a.marg.dol };
      };
      const pole = ramki.length > 1
        ? {
          x1: Math.min(...ramki.map((r) => r.x)), x2: Math.max(...ramki.map((r) => r.x + r.w)),
          y1: Math.min(...ramki.map((r) => r.y)), y2: Math.max(...ramki.map((r) => r.y + r.h)),
        }
        : obszar(ramki[0]);
      for (const r of ramki) {
        if (r.o.zablokowany) continue;
        const dx = { lewo: pole.x1 - r.x, srodekX: (pole.x1 + pole.x2) / 2 - (r.x + r.w / 2), prawo: pole.x2 - (r.x + r.w) }[jak] || 0;
        const dy = { gora: pole.y1 - r.y, srodekY: (pole.y1 + pole.y2) / 2 - (r.y + r.h / 2), dol: pole.y2 - (r.y + r.h) }[jak] || 0;
        r.o.set({ left: r.o.left + dx, top: r.o.top + dy });
      }
    });
  }

  // Równe odstępy między trzema lub więcej obiektami. os: 'x' | 'y'.
  rozloz(os) {
    this._naZaznaczonych((ramki) => {
      if (ramki.length < 3) return;
      const [p, d, wl] = os === 'x' ? ['x', 'w', 'left'] : ['y', 'h', 'top'];
      const kolejno = ramki.slice().sort((a, b) => a[p] - b[p]);
      const zakres = kolejno.at(-1)[p] + kolejno.at(-1)[d] - kolejno[0][p];
      const odstep = (zakres - kolejno.reduce((suma, r) => suma + r[d], 0)) / (kolejno.length - 1);
      let nastepny = kolejno[0][p];
      for (const r of kolejno) {
        if (!r.o.zablokowany) r.o.set(wl, r.o[wl] + (nastepny - r[p]));
        nastepny += r[d] + odstep;
      }
    });
  }

  // ---------- Blokada położenia i rozmiaru ----------

  ustawBlokade(obj, wlaczona) {
    obj.zablokowany = wlaczona || undefined;
    const b = Boolean(wlaczona);
    obj.set({
      lockMovementX: b, lockMovementY: b, lockScalingX: b, lockScalingY: b, lockRotation: b,
      hasControls: !b, hoverCursor: b ? 'default' : null,
    });
    this.canvas.requestRenderAll();
  }

  _zastosujBlokady() {
    for (const o of this.canvas.getObjects()) if (o.zablokowany && !o.zWzorca) this.ustawBlokade(o, true);
  }

  grupuj() {
    const akt = this.aktywny;
    if (!akt || !toZaznaczenie(akt) || this._otwarta) return;
    const obiekty = akt.getObjects().slice();
    const c = this.canvas;
    const bylo = this._wczytywanie;
    this._wczytywanie = true; // jedna zmiana, nie osobna na każdy element
    c.discardActiveObject(); // elementy wracają do położenia na arkuszu
    // Kolejność w grupie taka jak na arkuszu.
    const kolejno = c.getObjects().filter((o) => obiekty.includes(o));
    c.remove(...kolejno);
    const grupa = new fabric.Group(kolejno, { id: uid('o') });
    c.add(grupa);
    this._wczytywanie = bylo;
    this._uporzadkujWzorce();
    c.setActiveObject(grupa);
    c.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  rozgrupuj() {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'group' || toTabela(akt) || akt.parent) return; // tabela jest jednym elementem
    const c = this.canvas;
    const bylo = this._wczytywanie;
    this._wczytywanie = true;
    c.discardActiveObject();
    c.remove(akt);
    const obiekty = akt.removeAll(); // elementy wracają do położenia na arkuszu
    for (const o of obiekty) { if (!o.id) o.id = uid('o'); o.setCoords(); }
    c.add(...obiekty);
    this._wczytywanie = bylo;
    this._uporzadkujWzorce();
    c.setActiveObject(obiekty.length === 1 ? obiekty[0] : new fabric.ActiveSelection(obiekty, { canvas: c }));
    c.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  warstwa(kierunek) {
    const akt = this.aktywny;
    if (!akt) return;
    const c = this.canvas;
    // Element otwartej grupy zmienia kolejność wśród elementów tej grupy.
    const stos = this._otwarta && akt.parent === this._otwarta ? this._otwarta : c;
    if (stos === c && this._otwarta) return;
    ({
      wierzch: () => stos.bringObjectToFront(akt),
      wyzej: () => stos.bringObjectForward(akt),
      nizej: () => stos.sendObjectBackwards(akt),
      spod: () => stos.sendObjectToBack(akt),
    })[kierunek]();
    if (stos !== c) stos.set('dirty', true);
    this._uporzadkujWzorce();
    c.requestRenderAll();
    this.oznaczZmiane();
  }

  przesun(dx, dy) {
    const akt = this.aktywny;
    if (!akt || akt.isEditing || akt.zablokowany) return;
    const d = this._wUkladzieRodzica(akt, dx, dy);
    akt.set({ left: akt.left + d.x, top: akt.top + d.y });
    akt.setCoords();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Elementy, które da się zaznaczyć (bez elementów wzorców i ukrytych).
  _zaznaczalne() {
    return this.canvas.getObjects().filter((o) => !o.zWzorca && !o.kadr && o.visible !== false && o.selectable !== false);
  }

  zaznaczWszystko() {
    const obiekty = this._zaznaczalne();
    if (!obiekty.length) return;
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(obiekty.length === 1 ? obiekty[0] : new fabric.ActiveSelection(obiekty, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  odznacz() {
    // W otwartej grupie Esc wraca do całej grupy.
    if (this.zamknijGrupe(true)) return;
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  // Następny (1) albo poprzedni (−1) element w kolejności warstw.
  zaznaczSasiedni(kierunek) {
    // W otwartej grupie Tab chodzi po jej elementach.
    const obiekty = this._otwarta ? this._otwarta.getObjects().filter((o) => o.visible !== false) : this._zaznaczalne();
    if (!obiekty.length) return;
    const i = obiekty.indexOf(this.aktywny);
    const nastepny = obiekty[(i + kierunek + obiekty.length) % obiekty.length] || obiekty[0];
    if (this._otwarta) { this.canvas.setActiveObject(nastepny); this.canvas.requestRenderAll(); return; }
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(i < 0 && kierunek < 0 ? obiekty.at(-1) : nastepny);
    this.canvas.requestRenderAll();
  }

  edytujTekst() {
    const akt = this.aktywny;
    if (!akt || akt.type !== 'textbox' || akt.isEditing) return;
    akt.enterEditing();
    akt.selectAll();
    this.canvas.requestRenderAll();
  }

  przelaczBlokade() {
    const akt = this.aktywny;
    if (!akt || this._otwarta) return; // blokuje się całą grupę, nie jej element
    const obiekty = toZaznaczenie(akt) ? akt.getObjects() : [akt];
    const wlacz = !obiekty.every((o) => o.zablokowany);
    for (const o of obiekty) this.ustawBlokade(o, wlacz);
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Formatowanie tekstu ze skrótu: w trakcie pisania dotyczy zaznaczonego
  // fragmentu, poza tym – całego tekstu. zmiana(czytaj) zwraca właściwości do
  // ustawienia; caly = właściwość całego akapitu (np. wyrównanie).
  formatujTekst(zmiana, caly = false) {
    const obj = this.aktywny;
    if (!obj || obj.type !== 'textbox') return false;
    const fragment = !caly && obj.isEditing && obj.selectionStart !== obj.selectionEnd;
    const czytaj = (klucz) => {
      if (!fragment) return obj[klucz];
      const st = obj.getSelectionStyles(obj.selectionStart, obj.selectionStart + 1, true)[0] || {};
      return st[klucz] ?? obj[klucz];
    };
    const wlasciwosci = zmiana(czytaj);
    if (fragment) obj.setSelectionStyles(wlasciwosci);
    else {
      if (!caly) for (const klucz of Object.keys(wlasciwosci)) obj.removeStyle?.(klucz);
      obj.set(wlasciwosci);
    }
    obj.initDimensions?.();
    obj.dirty = true;
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
    return true;
  }

  // Wstawia pole {nazwa} do zaznaczonego tekstu: w trakcie pisania – w miejscu
  // kursora, poza tym – na końcu tekstu.
  wstawPole(nazwa) {
    const obj = this.aktywny;
    if (!obj || obj.type !== 'textbox') return;
    const pole = `{${nazwa}}`;
    if (obj.isEditing) {
      const start = obj.selectionStart;
      obj.insertChars(pole, null, start, obj.selectionEnd);
      obj.selectionStart = start + pole.length;
      obj.selectionEnd = start + pole.length;
      if (obj.hiddenTextarea) obj.hiddenTextarea.value = obj.text;
      obj._updateTextarea?.();
    } else {
      const t = obj.text || '';
      obj.set('text', t === 'Kliknij dwa razy, aby edytować' ? pole : `${t}${t && !/\s$/.test(t) ? ' ' : ''}${pole}`);
    }
    obj.initDimensions();
    obj.dirty = true;
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Pola nieznane na stronie, na której leży tekst (do ostrzeżeń i podświetlenia).
  _nieznanePola(o) {
    if (o.type !== 'textbox' || !o.text.includes('{') || o.bez_pol) return [];
    const strona = this.strony.length > 1 ? this.stronaW(this._srodekObiektu(o).x) : 0;
    return znajdzPola(o.text).filter((p) => !this.znanePole(p.nazwa, strona));
  }

  // Połączone ramki: gdy zaznaczona jest jedna z nich, linia pokazuje, dokąd płynie tekst.
  _rysujWatek(ctx, X, Y) {
    const akt = this.aktywny;
    const zaznaczone = toZaznaczenie(akt) ? akt.getObjects() : (akt ? [akt] : []);
    const ramka = zaznaczone.find((o) => o.watek);
    if (!ramka || toZaznaczenie(akt)) return;
    const ramki = this._ramkiWatku(ramka);
    if (ramki.length < 2) return;
    ctx.save();
    ctx.strokeStyle = '#7c3aed';
    ctx.fillStyle = '#7c3aed';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (let i = 0; i < ramki.length - 1; i += 1) {
      const a = ramki[i].aCoords?.br;
      const b = ramki[i + 1].aCoords?.tl;
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Tło pod polami {…} w tekstach: fioletowe – pole zostanie podstawione,
  // czerwone – takiego pola nie ma. Tylko w edytorze, nie w wydruku.
  _podswietlPola(ctx, X, Y) {
    for (const o of this.canvas.getObjects()) {
      if (o.zWzorca || o.type !== 'textbox' || o.visible === false || o.bez_pol || !o.text.includes('{') || !o.__charBounds) continue;
      const pola = znajdzPola(o.text);
      if (!pola.length) continue;
      const nieznane = new Set(this._nieznanePola(o).map((x) => x.start));
      const m = o.calcTransformMatrix();
      const lewo0 = o._getLeftOffset();
      const gora0 = o._getTopOffset();
      const goraWiersza = [];
      for (const p of pola) {
        // Prostokąty pola – osobny dla każdego wiersza, przez który przechodzi.
        const czesci = new Map();
        for (let i = p.start; i < p.koniec; i += 1) {
          const { lineIndex: w, charIndex: z } = o.get2DCursorLocation(i);
          const znak = o.__charBounds[w]?.[z];
          if (!znak) continue;
          const x = lewo0 + o._getLineLeftOffset(w) + znak.left;
          const cz = czesci.get(w);
          if (cz) cz.x2 = Math.max(cz.x2, x + znak.kernedWidth); else czesci.set(w, { x1: x, x2: x + znak.kernedWidth });
        }
        ctx.fillStyle = nieznane.has(p.start) ? 'rgba(220, 38, 38, 0.22)' : 'rgba(124, 58, 237, 0.16)';
        for (const [w, cz] of czesci) {
          if (goraWiersza[w] === undefined) {
            let y = gora0;
            for (let k = 0; k < w; k += 1) y += o.getHeightOfLine(k);
            goraWiersza[w] = y;
          }
          const y1 = goraWiersza[w];
          const y2 = y1 + o.getHeightOfLine(w) / o.lineHeight;
          ctx.beginPath();
          [[cz.x1, y1], [cz.x2, y1], [cz.x2, y2], [cz.x1, y2]].forEach(([px, py], n) => {
            const pkt = new fabric.Point(px, py).transform(m);
            if (n === 0) ctx.moveTo(X(pkt.x), Y(pkt.y)); else ctx.lineTo(X(pkt.x), Y(pkt.y));
          });
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // Po zmianie właściwości z panelu.
  zatwierdz() {
    const akt = this.aktywny;
    // Zmiana w tabeli albo w jej komórce: układ liczy się od nowa.
    const tabela = toTabela(akt) ? akt : (toTabela(akt?.group) ? akt.group : null);
    if (tabela) { if (!utrwalSkaleTabeli(tabela)) ulozTabele(tabela); this._przygotujTabele(tabela); }
    if (akt) akt.setCoords();
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
  }

  zaznacz(id) {
    const obj = this.canvas.getObjects().find((o) => o.id === id);
    if (!obj) {
      // Element wewnątrz zwykłej grupy: grupa otwiera się i zaznaczony jest ten element.
      for (const g of this.canvas.getObjects()) {
        const d = this._doOtwarcia(g) && g.getObjects().find((o) => o.id === id);
        if (d) { this.otworzGrupe(g, d); return; }
      }
      return;
    }
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
  }

  // ---------- Element w grupie bez rozgrupowywania ----------
  //
  // Podwójne kliknięcie zwykłej grupy „otwiera” ją: jej elementy dają się zaznaczać, przesuwać, skalować
  // i zmieniać pojedynczo (grupa Fabric w trybie interactive). Kliknięcie poza elementami grupy albo Esc
  // zamyka ją – znów jest jednym elementem, z ramką policzoną od nowa. Grupa przez cały czas zostaje na
  // swoim miejscu w stosie i ma ten sam identyfikator.

  get otwartaGrupa() { return this._otwarta || null; }

  // Czy grupę da się otworzyć: zwykła grupa na arkuszu – nie tabela, nie element wzorca, nie zablokowana.
  _doOtwarcia(g) {
    return Boolean(g && g.type === 'group' && !toTabela(g) && !g.zWzorca && !g.zablokowany && !g.parent && g.canvas === this.canvas);
  }

  // Czy element leży w otwartej grupie (także głębiej – np. komórka tabeli wstawionej do grupy).
  wOtwartejGrupie(o = this.aktywny) {
    if (!this._otwarta || !o || toZaznaczenie(o)) return false;
    for (let p = o.parent; p; p = p.parent) if (p === this._otwarta) return true;
    return false;
  }

  // Element grupy (jej bezpośredni składnik) leżący w punkcie arkusza albo null.
  _elementGrupyWPunkcie(g, punkt) {
    const bylo = { subTargetCheck: g.subTargetCheck, interactive: g.interactive };
    g.set({ subTargetCheck: true, interactive: true });
    g.setCoords(); // elementy grupy dostają aktualne położenie do wskazywania
    let cel = this.canvas.searchPossibleTargets([g], punkt).target;
    g.set(bylo);
    while (cel && cel !== g && cel.parent !== g) cel = cel.parent;
    return cel && cel !== g ? cel : null;
  }

  // Otwiera grupę i zaznacza jej element. grupa: obiekt albo identyfikator; element: obiekt, numer w grupie
  // (od spodu) albo nic – wtedy element z wierzchu. Zwraca zaznaczony element albo null.
  otworzGrupe(grupa, element) {
    const g = typeof grupa === 'string' ? this._poId(grupa) : grupa;
    if (!this._doOtwarcia(g)) return null;
    const dzieci = g.getObjects();
    const d = typeof element === 'number' ? dzieci[element] : (element || dzieci.filter((x) => x.visible !== false).at(-1));
    if (!d || d.parent !== g || d.visible === false) return null;
    if (this._otwarta && this._otwarta !== g) this.zamknijGrupe(false);
    if (this._pioro) this.ustawPioro(false);
    if (this._punkty) this.zakonczPunkty(true);
    if (this._kadr) this.zakonczKadrowanie(true);
    const a = this.aktywny;
    if (a?.isEditing && a !== d) a.exitEditing();
    for (const x of dzieci) if (!x.id) x.id = uid('o');
    if (this._otwarta !== g) {
      // W otwartej grupie zaznacza się po jednym elemencie (bez Shift+kliknięcie).
      this._klawiszZaznaczania = this.canvas.selectionKey;
      this.canvas.selectionKey = null;
      this._otwarta = g;
    }
    g.set({ subTargetCheck: true, interactive: true });
    g.setCoords();
    this.canvas.setActiveObject(d);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    return d;
  }

  // Zamyka otwartą grupę. zaznacz: po zamknięciu zaznaczona jest cała grupa (gdy zaznaczony był jej element).
  // Zwraca true, gdy jakaś grupa była otwarta.
  zamknijGrupe(zaznacz = true) {
    const g = this._otwarta;
    if (!g) return false;
    const a = this.aktywny;
    const wSrodku = this.wOtwartejGrupie(a);
    this._zapomnijOtwarta();
    if (wSrodku) {
      if (a.isEditing) a.exitEditing();
      this.canvas.discardActiveObject();
    }
    const zamknij = (x) => { x.set({ subTargetCheck: false, interactive: false }); for (const d of x.getObjects()) if (d.getObjects) zamknij(d); };
    zamknij(g);
    if (g.canvas === this.canvas) {
      g.triggerLayout();
      g.setCoords();
      g.set('dirty', true);
      if (zaznacz && wSrodku) this.canvas.setActiveObject(g);
    }
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    return true;
  }

  _zapomnijOtwarta() {
    if (!this._otwarta) return;
    this._otwarta = null;
    this.canvas.selectionKey = this._klawiszZaznaczania ?? 'shiftKey';
  }

  // Po zmianie elementu otwartej grupy jej ramka liczy się od nowa; elementy zostają na swoich miejscach.
  _ulozOtwarta() {
    const g = this._otwarta;
    if (!g) return;
    if (g.canvas !== this.canvas) { this._zapomnijOtwarta(); return; }
    g.triggerLayout();
    g.setCoords();
    g.set('dirty', true);
  }

  // Usuwa zaznaczony element otwartej grupy; gdy był ostatni, znika cała grupa.
  _usunZOtwartej() {
    const g = this._otwarta;
    const d = this.aktywny;
    if (!g || d?.parent !== g) return;
    this.zamknijGrupe(true);
    if (g.getObjects().length <= 1) { this.canvas.remove(g); this.canvas.requestRenderAll(); return; }
    g.remove(d);
    g.triggerLayout();
    g.setCoords();
    g.set('dirty', true);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Przesunięcie podane w milimetrach arkusza → w układzie grupy, w której leży element (grupa może być
  // obrócona albo przeskalowana). Element spoza grupy: bez zmian.
  _wUkladzieRodzica(o, dx, dy) {
    const v = new fabric.Point(dx, dy);
    return o.parent ? v.transform(fabric.util.invertTransform(o.parent.calcTransformMatrix()), true) : v;
  }

  // Położenie elementu na arkuszu (jego lewy górny róg). Element grupy ma własne położenie liczone od środka
  // grupy – do pokazania i wpisania liczbą trzeba je przeliczyć.
  polozenieNaArkuszu(o) {
    const p = new fabric.Point(o.left, o.top);
    return o.parent ? p.transform(o.parent.calcTransformMatrix()) : p;
  }

  ustawPolozenieNaArkuszu(o, { x, y }) {
    const teraz = this.polozenieNaArkuszu(o);
    const cel = new fabric.Point(x ?? teraz.x, y ?? teraz.y);
    const p = o.parent ? cel.transform(fabric.util.invertTransform(o.parent.calcTransformMatrix())) : cel;
    o.set({ left: p.x, top: p.y });
  }

  // Skala i obrót grupy, w której leży element – do przeliczenia jego rozmiaru i kąta na arkusz.
  ukladRodzica(o) {
    if (!o.parent) return { sx: 1, sy: 1, kat: 0 };
    const r = fabric.util.qrDecompose(o.parent.calcTransformMatrix());
    return { sx: Math.abs(r.scaleX) || 1, sy: Math.abs(r.scaleY) || 1, kat: r.angle || 0 };
  }

  // Ramka otwartej grupy na płótnie: przerywana linia i podpis – widać, że zmiany dotyczą jej elementów.
  _rysujOtwarta(ctx, X, Y) {
    const g = this._otwarta;
    if (!g || g.canvas !== this.canvas) return;
    const rogi = g.getCoords();
    ctx.save();
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    rogi.forEach((p, i) => { if (i === 0) ctx.moveTo(X(p.x), Y(p.y)); else ctx.lineTo(X(p.x), Y(p.y)); });
    ctx.closePath();
    ctx.stroke();
    const tekst = 'Grupa otwarta – Esc zamyka';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    const lewy = Math.min(...rogi.map((p) => X(p.x)));
    const gora = Math.min(...rogi.map((p) => Y(p.y)));
    ctx.setLineDash([]);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.roundRect(lewy, gora - 20, ctx.measureText(tekst).width + 10, 16, 4); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(tekst, lewy + 5, gora - 11.5);
    ctx.restore();
  }

  _emitujZaznaczenie() {
    this.dispatchEvent(new CustomEvent('zaznaczenie', { detail: this.aktywny }));
  }

  // ---------- Ostrzeżenia o układzie (4.5) ----------

  // Czy ramka x1..x2 leży świadomie na obu stronach rozkładówki: zaczyna się
  // przed wewnętrznym marginesem lewej strony i kończy za wewnętrznym prawej.
  // Element, który tylko wystaje w pas przy grzbiecie, nadal dostaje ostrzeżenie.
  _przezGrzbiet(x1, x2) {
    if (!this.rozkladowka) return false;
    const [l, p] = this.strony;
    return x1 < p.x - l.marg.prawy && x2 > p.x + p.marg.lewy;
  }

  przeliczOstrzezenia() {
    if (!this.wydruk) return;
    const { szerokosc_mm: wStrony, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    const tol = 0.05;
    const lista = [];
    for (const o of this.canvas.getObjects()) {
      if (o.bez_ostrzezen || o.zWzorca || o.kadr || o === this._kadr?.obj) continue;
      o.setCoords();
      const r = this._prostokatNaStronie(o);
      const x1 = r.left; const y1 = r.top;
      const x2 = r.left + r.width; const y2 = r.top + r.height;
      // Obszar bezpieczny: marginesy strony z elementem albo – dla elementu
      // przez grzbiet – zewnętrzne marginesy obu stron.
      const przez = this._przezGrzbiet(x1, x2);
      const a = przez ? this.strony[0] : this.strony[this.stronaW((x1 + x2) / 2)];
      const z = przez ? this.strony[1] : a;
      const m = { lewy: a.x + a.marg.lewy, prawy: w - (z.x + wStrony - z.marg.prawy), gora: a.marg.gora, dol: a.marg.dol };
      let typ = null;
      if (x2 < -b || y2 < -b || x1 > w + b || y1 > h + b) {
        typ = 'poza_strona';
      } else if (x1 < -b - tol || y1 < -b - tol || x2 > w + b + tol || y2 > h + b + tol) {
        typ = 'poza_spadem';
      } else if (x1 < m.lewy - tol || y1 < m.gora - tol || x2 > w - m.prawy + tol || y2 > h - m.dol + tol) {
        typ = 'w_marginesie';
      }
      if (typ) lista.push({ id: o.id, typ, obiekt: opisObiektu(o) });
      if (nieMiesciSie(o)) lista.push({ id: o.id, typ: 'nie_miesci_sie', obiekt: opisObiektu(o) });
      const nrStrony = this.strony.length > 1 ? this.stronaW(this._srodekObiektu(o).x) : 0;
      const nieznane = [...this._nieznanePola(o).map((p) => p.nazwa), ...polaZDanych(o).filter((n) => !this.znanePole(n, nrStrony))];
      if (nieznane.length) lista.push({ id: o.id, typ: 'nieznane_pole', obiekt: opisObiektu(o), pola: [...new Set(nieznane)] });
    }
    this.ostrzezenia = lista;
    this.dispatchEvent(new CustomEvent('ostrzezenia', { detail: lista }));
  }

  // Prostokąt opisany na elemencie, w milimetrach strony. Element z zaznaczenia
  // kilku naraz ma położenie liczone względem tego zaznaczenia – trzeba je przeliczyć.
  _prostokatNaStronie(o) {
    return o.getBoundingRect();
  }

  // ---------- Przyciąganie: prowadnice, inne elementy, równe odstępy, siatka ----------

  // widok: { siatka_mm, siatka, do_siatki, do_elementow } – ustawienia projektu.
  ustawWidok(widok) {
    this.widok = { ...this.widok, ...widok };
    this.canvas.requestRenderAll();
  }

  _ramka(o) {
    o.setCoords();
    const r = o.getBoundingRect();
    const ramka = { x: r.left, y: r.top, w: r.width, h: r.height };
    // Obrócony element: do pomiarów idzie jego prawdziwy kształt (cztery rogi), nie prostokąt otaczający.
    if ((o.angle || 0) % 90 !== 0 && !o.group && o.aCoords) ramka.wielokat = ['tl', 'tr', 'br', 'bl'].map((k) => ({ x: o.aCoords[k].x, y: o.aCoords[k].y }));
    return ramka;
  }

  // Przyciąganie przy zmianie rozmiaru uchwytem: przesuwana krawędź zatrzymuje się na
  // prowadnicach, krawędziach i środkach innych elementów oraz na siatce. Ctrl wyłącza.
  _przyciagnijRozmiar(obj, zdarzenie, t) {
    if (!this.wydruk || !t?.corner) return;
    this._liniePrzyciagania = [];
    if (zdarzenie?.ctrlKey || zdarzenie?.metaKey || (obj.angle || 0) % 360 !== 0 || obj.group) return;
    const u = t.corner;
    const ruchX = u[1] === 'l' ? 'l' : (u[1] === 'r' ? 'r' : null);
    const ruchY = u === 'mt' || u[0] === 't' ? 't' : (u === 'mb' || u[0] === 'b' ? 'b' : null);
    const r = this._ramka(obj);
    if (!this._cele) this._cele = this.widok.do_elementow ? this._ramkiInnych(obj) : [];
    const linie = this._liniePomocnicze();
    const krok = this.widok.do_siatki ? this.widok.siatka_mm : 0;
    const prog = 6 / this.skala;
    const x = ruchX && przyciagnijKrawedz(ruchX === 'l' ? r.x : r.x + r.w, 'x', r, { linie: linie.x, inne: this._cele, siatka: krok ? { krok, poczatek: this.strony[this.stronaW(r.x + r.w / 2)].x } : null, prog });
    const y = ruchY && przyciagnijKrawedz(ruchY === 't' ? r.y : r.y + r.h, 'y', r, { linie: linie.y, inne: this._cele, siatka: krok ? { krok, poczatek: 0 } : null, prog });
    if (!x && !y) return;
    const kotwica = obj.translateToOriginPoint(obj.getRelativeCenterPoint(), t.originX, t.originY);
    const nowaSzer = x ? r.w + (ruchX === 'r' ? x.d : -x.d) : r.w;
    const nowaWys = y ? r.h + (ruchY === 'b' ? y.d : -y.d) : r.h;
    if (nowaSzer < 1 || nowaWys < 1) return;
    const narozny = Boolean(ruchX && ruchY);
    const proporcje = narozny && this.canvas.uniformScaling !== zdarzenie?.shiftKey && obj.type !== 'textbox';
    if (proporcje) {
      // Uchwyt narożny trzyma proporcje: decyduje krawędź, do której jest bliżej.
      const wybranyX = x && (!y || Math.abs(x.d) <= Math.abs(y.d));
      const f = wybranyX ? nowaSzer / r.w : nowaWys / r.h;
      obj.set({ scaleX: obj.scaleX * f, scaleY: obj.scaleY * f });
      this._liniePrzyciagania = [wybranyX ? x.linia : y.linia].filter(Boolean);
    } else {
      // Obrys o stałej grubości nie rośnie ze skalą – odejmujemy go przed przeliczeniem.
      if (x) {
        const obrys = r.w - obj.width * obj.scaleX;
        if (obj.type === 'textbox' && t.action === 'resizing') obj.set('width', Math.max(1, (nowaSzer - obrys) / obj.scaleX));
        else obj.set('scaleX', Math.max(0.001, (nowaSzer - obrys) / obj.width));
      }
      if (y && !(obj.type === 'textbox' && !(obj.ramka_h > 0))) {
        const obrys = r.h - obj.height * obj.scaleY;
        obj.set('scaleY', Math.max(0.001, (nowaWys - obrys) / obj.height));
      }
      this._liniePrzyciagania = [x?.linia, y?.linia].filter(Boolean);
    }
    obj.setPositionByOrigin(kotwica, t.originX, t.originY);
    obj.setCoords();
  }

  // Prostokąty pozostałych elementów (bez przesuwanego i bez ukrytych).
  _ramkiInnych(obj) {
    const pomijane = new Set(toZaznaczenie(obj) ? obj.getObjects() : [obj]);
    // Element otwartej grupy przyciąga się do pozostałych elementów tej grupy, a nie do jej ramki
    // (ta zmienia się razem z nim).
    const g = this.wOtwartejGrupie(obj) ? this._otwarta : null;
    const kandydaci = g ? [...this.canvas.getObjects().filter((o) => o !== g), ...g.getObjects()] : this.canvas.getObjects();
    return kandydaci.filter((o) => !pomijane.has(o) && o.visible !== false).map((o) => this._ramka(o));
  }

  // Prowadnice arkusza: krawędzie, marginesy i środki stron oraz prowadnice własne.
  _liniePomocnicze() {
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const m = this.marg;
    return {
      x: [...this.strony.flatMap((s) => [s.x, s.x + s.marg.lewy, s.x + w / 2, s.x + w - s.marg.prawy, s.x + w]), ...this.prowadnice.filter((p) => p.os === 'x').map((p) => p.poz)],
      y: [0, m.gora, h / 2, h - m.dol, h, ...this.prowadnice.filter((p) => p.os === 'y').map((p) => p.poz)],
    };
  }

  // Przeciąganie z Alt: w miejscu, z którego ruszył element, zostaje jego kopia.
  async _zostawKopie(obj) {
    const start = this.canvas._currentTransform?.original;
    if (!start) return;
    // Kopie stają tam, skąd ruszył element: cofamy im dotychczasowe przesunięcie.
    const dx = obj.left - start.left;
    const dy = obj.top - start.top;
    const kopie = await this._kopie(obj);
    const indeks = toZaznaczenie(obj) ? -1 : this.canvas.getObjects().indexOf(obj);
    for (const k of kopie) {
      k.set({ id: uid('o'), left: k.left - dx, top: k.top - dy });
      // Kopia zostaje pod przeciąganym elementem, na jego dotychczasowym miejscu w stosie.
      if (indeks >= 0) this.canvas.insertAt(indeks, k); else this.canvas.add(k);
      k.setCoords();
    }
    this._cele = null; // kopia też jest celem przyciągania
    this.canvas.requestRenderAll();
  }

  // Z Ctrl (⌘) przesuwanie jest swobodne – bez przyciągania.
  _przyciagnij(obj, zdarzenie) {
    if (!this.wydruk) return;
    this._liniePrzyciagania = [];
    this._pomiary = [];
    if (zdarzenie?.altKey && !this._kopiaZAlt && !obj.zablokowany && !obj.parent) {
      this._kopiaZAlt = true;
      this._zostawKopie(obj);
    }
    // Z Shiftem ruch tylko wzdłuż jednej osi – tej, w której przesunięcie jest większe.
    const start = this.canvas._currentTransform?.original;
    if (zdarzenie?.shiftKey && start) {
      if (Math.abs(obj.left - start.left) >= Math.abs(obj.top - start.top)) obj.top = start.top; else obj.left = start.left;
      obj.setCoords();
    }
    if (zdarzenie?.ctrlKey || zdarzenie?.metaKey) return;
    const r = this._ramka(obj);
    if (!this._cele) this._cele = this.widok.do_elementow ? this._ramkiInnych(obj) : [];
    const linie = this._liniePomocnicze();
    const krok = this.widok.do_siatki ? this.widok.siatka_mm : 0;
    const wynik = przyciagnij(r, {
      linieX: linie.x,
      linieY: linie.y,
      inne: this._cele,
      siatkaX: krok ? { krok, poczatek: this.strony[this.stronaW(r.x + r.w / 2)].x } : null,
      siatkaY: krok ? { krok, poczatek: 0 } : null,
      prog: 6 / this.skala, // 6 px na ekranie
    });
    const d = this._wUkladzieRodzica(obj, wynik.dx, wynik.dy);
    obj.left += d.x;
    obj.top += d.y;
    obj.setCoords();
    this._liniePrzyciagania = wynik.linie;
    this._pomiary = wynik.pomiary;
  }

  // ---------- Prowadnice własne ----------

  // Położenie na arkuszu (mm) dla punktu okna przeglądarki.
  naArkuszu(clientX, clientY) {
    const r = this.canvas.upperCanvasEl.getBoundingClientRect();
    const v = this.canvas.viewportTransform;
    return { x: (clientX - r.left - v[4]) / v[0], y: (clientY - r.top - v[5]) / v[3] };
  }

  // Ustawia przeciąganą prowadnicę w punkcie (mm). Położenie zaokrągla się do
  // kroku siatki (gdy przyciąganie do siatki jest włączone) albo do 0,5 mm.
  _ustawProwadnice(p, punkt, swobodnie = false) {
    const krok = this.widok.do_siatki ? this.widok.siatka_mm : 0.5;
    const strona = this.stronaW(punkt.x);
    const x0 = this.strony[strona].x;
    const zaokr = (v) => (swobodnie ? v : Math.round(v / krok) * krok);
    if (p.os === 'x') { p.poz = x0 + zaokr(punkt.x - x0); p.strona = this.stronaW(p.poz); } else { p.poz = zaokr(punkt.y); p.strona = strona; }
    p.pozaStrona = p.os === 'x' ? (punkt.x < 0 || punkt.x > this.szerokoscArkusza) : (punkt.y < 0 || punkt.y > this.wydruk.wysokosc_mm || punkt.x < 0 || punkt.x > this.szerokoscArkusza);
    this.canvas.requestRenderAll();
  }

  // Nowa prowadnica wyciągana z linijki: os 'x' = pionowa, 'y' = pozioma.
  // Zwraca funkcje { ruch(clientX, clientY, swobodnie), koniec() }.
  wyciagnijProwadnice(os) {
    const p = { os, poz: 0, strona: 0, pozaStrona: true };
    this._prowadnicaWRuchu = p;
    return {
      ruch: (clientX, clientY, swobodnie) => this._ustawProwadnice(p, this.naArkuszu(clientX, clientY), swobodnie),
      koniec: () => {
        this._prowadnicaWRuchu = null;
        if (!p.pozaStrona) { delete p.pozaStrona; this.prowadnice.push(p); this._poZmianieProwadnic(); }
        this.canvas.requestRenderAll();
      },
    };
  }

  _poZmianieProwadnic() {
    this.canvas.requestRenderAll();
    this.dispatchEvent(new Event('prowadnice'));
  }

  // Prowadnica pod kursorem (w zasięgu kilku pikseli) albo null.
  _prowadnicaPod(punkt) {
    if (!this.pokazProwadnice) return null;
    const prog = 4 / this.skala;
    const w = this.wydruk.szerokosc_mm;
    return this.prowadnice.find((p) => {
      if (p.os === 'x') return Math.abs(p.poz - punkt.x) <= prog;
      const s = this.strony[Math.min(p.strona, this.strony.length - 1)];
      return Math.abs(p.poz - punkt.y) <= prog && punkt.x >= s.x && punkt.x <= s.x + w;
    }) || null;
  }

  _punktZdarzenia(e) {
    return { x: e.scenePoint.x, y: e.scenePoint.y };
  }

  // Kliknięcie w prowadnicę (w pustym miejscu) zaczyna jej przesuwanie;
  // wyciągnięta poza stronę znika.
  _chwycProwadnice(e) {
    if (e.target || !e.scenePoint || this.reka || this.widok.blokada_prowadnic || this._trybPunktow()) return;
    const p = this._prowadnicaPod(this._punktZdarzenia(e));
    if (!p) return;
    this._prowadnicaWRuchu = p;
    this.canvas._groupSelector = null; // bez ramki zaznaczania
    const ruch = (ev) => this._ustawProwadnice(p, this.naArkuszu(ev.clientX, ev.clientY), ev.ctrlKey || ev.metaKey);
    const koniec = () => {
      window.removeEventListener('mousemove', ruch);
      window.removeEventListener('touchmove', dotyk);
      this._prowadnicaWRuchu = null;
      if (p.pozaStrona) this.prowadnice = this.prowadnice.filter((x) => x !== p);
      delete p.pozaStrona;
      this._poZmianieProwadnic();
    };
    const dotyk = (ev) => { if (ev.touches[0]) ruch(ev.touches[0]); };
    window.addEventListener('mousemove', ruch);
    window.addEventListener('touchmove', dotyk, { passive: true });
    window.addEventListener('mouseup', koniec, { once: true });
    window.addEventListener('touchend', koniec, { once: true });
  }

  _ruchNadProwadnica(e) {
    if (this._trybPunktow()) return; // pióro i edycja punktów mają własny kursor
    if (this._prowadnicaWRuchu) { this.canvas._groupSelector = null; return; }
    if (e.target || !e.scenePoint || !this.wydruk || this.widok.blokada_prowadnic) { this.canvas.defaultCursor = 'default'; return; }
    const p = this._prowadnicaPod(this._punktZdarzenia(e));
    this.canvas.defaultCursor = p ? (p.os === 'x' ? 'col-resize' : 'row-resize') : 'default';
  }

  // Prowadnica wpisana liczbą: os 'x' = pionowa (mm od lewej krawędzi strony), 'y' = pozioma (mm od góry).
  dodajProwadnice(os, mm, strona = this.aktywna) {
    const x0 = this.strony[strona]?.x || 0;
    this.prowadnice.push({ os, poz: os === 'x' ? x0 + mm : mm, strona });
    this._poZmianieProwadnic();
  }

  // Położenie prowadnicy nr i w mm od rogu jej strony; null usuwa prowadnicę.
  ustawProwadnice(i, mm) {
    const p = this.prowadnice[i];
    if (!p) return;
    if (mm === null) this.prowadnice.splice(i, 1);
    else p.poz = p.os === 'x' ? this.strony[p.strona].x + mm : mm;
    this._poZmianieProwadnic();
  }

  usunProwadnice() {
    if (!this.prowadnice.length) return;
    this.prowadnice = [];
    this._poZmianieProwadnic();
  }

  // Prowadnice do zapisu, osobno dla każdej strony arkusza: [{ x: [], y: [] }, …]
  // – położenia liczone od rogu strony.
  prowadniceStron() {
    return this.strony.map((s, i) => ({
      x: this.prowadnice.filter((p) => p.os === 'x' && p.strona === i).map((p) => Math.round((p.poz - s.x) * 100) / 100),
      y: this.prowadnice.filter((p) => p.os === 'y' && p.strona === i).map((p) => Math.round(p.poz * 100) / 100),
    }));
  }

  // ---------- Kadrowanie obrazu przeciąganiem ----------
  // Na czas kadrowania obraz pokazuje się cały, a ramka z uchwytami wyznacza
  // widoczny fragment. Reszta obrazu jest przyciemniona.

  get kadruje() { return Boolean(this._kadr); }

  kadruj(obj) {
    if (this._kadr || !obj || obj.type !== 'image' || obj.zablokowany) return false;
    if (obj.group) return false;
    const { nw, nh } = rozmiarOryginalu(obj);
    const start = { cropX: obj.cropX, cropY: obj.cropY, width: obj.width, height: obj.height, left: obj.left, top: obj.top, angle: obj.angle || 0, flipX: Boolean(obj.flipX), flipY: Boolean(obj.flipY) };
    // Obrócony albo odbity obraz na czas kadrowania jest prostowany (wokół swojego środka);
    // po zatwierdzeniu wraca do obrotu i odbicia, a przycięty fragment zostaje na swoim miejscu.
    const obrot = { ...start, srodek: obj.getRelativeCenterPoint() };
    if (start.angle % 360 !== 0 || start.flipX || start.flipY) {
      obj.set({ angle: 0, flipX: false, flipY: false });
      obj.setPositionByOrigin(obrot.srodek, 'center', 'center');
    }
    const ramka = new fabric.Rect({
      left: obj.left, top: obj.top, width: obj.width * obj.scaleX, height: obj.height * obj.scaleY,
      fill: 'rgba(0,0,0,0)', strokeWidth: 0, excludeFromExport: true, kadr: true, lockRotation: true,
    });
    ramka.setControlsVisibility({ mtr: false });
    this._kadr = { obj, ramka, start, nw, nh, obrot };
    obj.set({ left: obj.left - obj.cropX * obj.scaleX, top: obj.top - obj.cropY * obj.scaleY, cropX: 0, cropY: 0, width: nw, height: nh, selectable: false, evented: false });
    obj.setCoords();
    this.canvas.add(ramka);
    this.canvas.setActiveObject(ramka);
    this.canvas.requestRenderAll();
    return true;
  }

  zakonczKadrowanie(zatwierdz = true) {
    const k = this._kadr;
    if (!k) return;
    const { obj, ramka, start, nw, nh, obrot } = k;
    const r = { x1: ramka.left, y1: ramka.top, x2: ramka.left + ramka.getScaledWidth(), y2: ramka.top + ramka.getScaledHeight() };
    this._kadr = null;
    this.canvas.remove(ramka);
    if (zatwierdz) {
      // Ramka przycięta do obrazu; co najmniej 5% jego boku.
      const [ix, iy, iw, ih] = [obj.left, obj.top, nw * obj.scaleX, nh * obj.scaleY];
      const x1 = Math.min(Math.max(r.x1, ix), ix + iw * 0.95);
      const y1 = Math.min(Math.max(r.y1, iy), iy + ih * 0.95);
      const x2 = Math.min(Math.max(r.x2, x1 + iw * 0.05), ix + iw);
      const y2 = Math.min(Math.max(r.y2, y1 + ih * 0.05), iy + ih);
      obj.set({ cropX: (x1 - ix) / obj.scaleX, cropY: (y1 - iy) / obj.scaleY, width: (x2 - x1) / obj.scaleX, height: (y2 - y1) / obj.scaleY, left: x1, top: y1 });
      if (obrot.angle % 360 !== 0 || obrot.flipX || obrot.flipY) {
        // Środek przyciętego fragmentu przesunął się względem dawnego środka – to przesunięcie
        // trzeba odbić i obrócić tak jak obraz, zanim wróci obrót.
        const s = obj.getRelativeCenterPoint();
        const dx = (s.x - obrot.srodek.x) * (obrot.flipX ? -1 : 1);
        const dy = (s.y - obrot.srodek.y) * (obrot.flipY ? -1 : 1);
        const kat = (obrot.angle * Math.PI) / 180;
        const nowy = new fabric.Point(obrot.srodek.x + dx * Math.cos(kat) - dy * Math.sin(kat), obrot.srodek.y + dx * Math.sin(kat) + dy * Math.cos(kat));
        obj.set({ angle: obrot.angle, flipX: obrot.flipX, flipY: obrot.flipY });
        obj.setPositionByOrigin(nowy, 'center', 'center');
      }
    } else obj.set(start);
    obj.set({ selectable: true, evented: true });
    obj.setCoords();
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // ---------- Warstwy ----------

  // Elementy wzorców widoczne na tej stronie, od wierzchu: [{ id, opis, wzorzec, idWzorca, nad }].
  // Nie da się ich tu zmienić – edytuje się je we wzorcu.
  warstwyZeWzorcow() {
    return this.canvas.getObjects().filter((o) => o.zWzorca).reverse().map((o) => ({
      id: o.id, typ: o.type, opis: opisObiektu(o), wzorzec: o.nazwaWzorca || 'wzorzec', idWzorca: o.idWzorca || null, nad: o.warstwa === 'nad',
    }));
  }

  // Przesuwa element o jedno miejsce w stosie: kierunek +1 = wyżej (ku wierzchowi), −1 = niżej.
  przesunWarstwe(id, kierunek) {
    const lista = this.warstwy().map((w) => w.id); // od wierzchu
    const i = lista.indexOf(id);
    const j = i - kierunek;
    if (i < 0 || j < 0 || j >= lista.length) return;
    lista.splice(i, 1);
    lista.splice(j, 0, id);
    // „Nad którym elementem”: następny na liście (leżący bezpośrednio pod spodem).
    this.przeniesWarstwe(id, lista[j + 1] ?? null);
  }

  // Elementy arkusza od wierzchu do spodu (bez elementów wzorców).
  warstwy() {
    const akt = this.aktywny;
    const zaznaczone = new Set(akt ? (toZaznaczenie(akt) ? akt.getObjects() : [akt]) : []);
    return this.canvas.getObjects().filter((o) => !o.zWzorca && !o.kadr).reverse().map((o) => ({
      id: o.id, typ: o.type, opis: opisObiektu(o), ukryty: o.visible === false, zablokowany: Boolean(o.zablokowany), zaznaczony: zaznaczone.has(o),
      otwarta: o === this._otwarta, // grupa, w której zmieniany jest pojedynczy element
      // Zawartość grupy (od wierzchu); tabela jest jednym elementem i nie pokazuje swoich części.
      dzieci: o.type === 'group' && !toTabela(o) ? o.getObjects().map((d, nr) => ({ nr, typ: d.type, opis: opisObiektu(d), ukryty: d.visible === false, zaznaczony: zaznaczone.has(d) })).reverse() : null,
    }));
  }

  _wGrupie(id, nr) {
    const g = this._poId(id);
    return g?.type === 'group' && !toTabela(g) ? { g, d: g.getObjects()[nr] || null } : { g: null, d: null };
  }

  // Ukrywa albo pokazuje pojedynczy element grupy (nr = miejsce w grupie, od spodu).
  ustawWidocznoscWGrupie(id, nr, widoczny) {
    const { g, d } = this._wGrupie(id, nr);
    if (!d) return;
    if (!widoczny && this.aktywny === d) this.zamknijGrupe(true);
    d.set({ visible: widoczny });
    g.dirty = true;
    this.canvas.requestRenderAll();
    this.oznaczZmiane();
  }

  nazwijWGrupie(id, nr, nazwa) {
    const { d } = this._wGrupie(id, nr);
    if (!d) return;
    d.nazwa = nazwa || undefined;
    this.oznaczZmiane();
  }

  _poId(id) {
    return this.canvas.getObjects().find((o) => o.id === id && !o.zWzorca) || null;
  }

  // Ukryty element nie jest widoczny ani drukowany, ale zostaje w projekcie.
  ustawWidocznosc(id, widoczny) {
    const o = this._poId(id);
    if (!o) return;
    if (this._otwarta === o) this.zamknijGrupe(true);
    if (!widoczny && this.aktywny === o) this.canvas.discardActiveObject();
    o.set({ visible: widoczny });
    this.canvas.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Przenosi element na miejsce nad elementem `nadId` (albo na sam spód, gdy null).
  przeniesWarstwe(id, nadId) {
    const o = this._poId(id);
    if (!o || id === nadId) return;
    if (this._otwarta === o) this.zamknijGrupe(true);
    const c = this.canvas;
    const bylo = this._wczytywanie;
    this._wczytywanie = true; // bez zdarzeń „dodano/usunięto” po drodze
    c.remove(o);
    const cel = nadId ? this._poId(nadId) : null;
    const wszystkie = c.getObjects();
    const indeks = cel ? wszystkie.indexOf(cel) + 1 : wszystkie.filter((x) => x.zWzorca && x.warstwa !== 'nad').length;
    c.insertAt(indeks, o);
    this._wczytywanie = bylo;
    this._uporzadkujWzorce();
    c.requestRenderAll();
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  nazwij(id, nazwa) {
    const o = this._poId(id);
    if (!o) return;
    o.nazwa = nazwa || undefined;
    this._emitujZaznaczenie();
    this.oznaczZmiane();
  }

  // Odległości zaznaczonego elementu do sąsiadów i krawędzi strony (przytrzymany Alt).
  pokazPomiary(wlacz) {
    const obj = this.aktywny;
    if (!wlacz || !obj || obj.isEditing || !this.wydruk) {
      if (this._pomiaryStale) { this._pomiaryStale = false; this._pomiary = []; this.canvas.requestRenderAll(); }
      return;
    }
    const r = this._ramka(obj);
    const { szerokosc_mm: w, wysokosc_mm: h } = this.wydruk;
    const strona = this.strony[this.stronaW(r.x + r.w / 2)];
    this._pomiary = pomiary(r, this._ramkiInnych(obj), { x: strona.x, y: 0, w, h });
    this._pomiaryStale = true;
    this.canvas.requestRenderAll();
  }

  // ---------- Prowadnice: spad, linia cięcia, marginesy ----------

  _poRenderowaniu(ctx) {
    if (this._renderujeEksport || !this.wydruk) return;
    const { szerokosc_mm: wStrony, wysokosc_mm: h, spad_mm: b } = this.wydruk;
    const w = this.szerokoscArkusza;
    const v = this.canvas.viewportTransform;
    const s = v[0];
    const X = (mm) => v[4] + mm * s;
    const Y = (mm) => v[5] + mm * s;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.canvas.getRetinaScaling();
    ctx.scale(dpr, dpr);

    if (this.pokazProwadnice && this.widok.siatka && this.widok.siatka_mm > 0) {
      // Siatka: liczona od rogu każdej strony. Przy małym powiększeniu rysujemy
      // co którąś linię, żeby nie zlała się w szarą plamę.
      const krok = this.widok.siatka_mm;
      const co = Math.max(1, Math.ceil(5 / (krok * s)));
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const { x } of this.strony) {
        for (let k = co; k * krok < wStrony - 0.01; k += co) {
          const px = Math.round(X(x + k * krok)) + 0.5;
          ctx.moveTo(px, Y(0)); ctx.lineTo(px, Y(h));
        }
      }
      for (let k = co; k * krok < h - 0.01; k += co) {
        const py = Math.round(Y(k * krok)) + 0.5;
        ctx.moveTo(X(0), py); ctx.lineTo(X(w), py);
      }
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.16)';
      ctx.stroke();
    }

    if (this.pokazProwadnice) {
      // Spad: przyciemniony pas, który zostanie odcięty.
      if (b > 0) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.10)';
        ctx.beginPath();
        ctx.rect(X(-b), Y(-b), (w + 2 * b) * s, (h + 2 * b) * s);
        ctx.rect(X(0), Y(0), w * s, h * s);
        ctx.fill('evenodd');
      }
      // Linia cięcia (format netto).
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(Math.round(X(0)) + 0.5, Math.round(Y(0)) + 0.5, Math.round(w * s) - 1, Math.round(h * s) - 1);
      // Obszar bezpieczny (marginesy) każdej strony arkusza.
      for (const { x, marg: m } of this.strony) {
        if (m.lewy + m.prawy + m.gora + m.dol <= 0) continue;
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.8)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          Math.round(X(x + m.lewy)) + 0.5, Math.round(Y(m.gora)) + 0.5,
          Math.round((wStrony - m.lewy - m.prawy) * s) - 1, Math.round((h - m.gora - m.dol) * s) - 1,
        );
      }
      // Grzbiet w rozkładówce: gruba linia po stronie zszycia.
      const grzbiet = this.strony[0].marg.grzbiet;
      if (grzbiet) {
        const gx = Math.round(X(grzbiet === 'lewy' ? 0 : wStrony)) + 0.5;
        ctx.strokeStyle = 'rgba(28, 27, 25, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(gx, Y(-b));
        ctx.lineTo(gx, Y(h + b));
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    if (this.pokazProwadnice) this._podswietlPola(ctx, X, Y);
    if (this.pokazProwadnice) this._rysujWatek(ctx, X, Y);
    if (this._trybPunktow()) this._rysujPunkty(ctx, X, Y);
    this._rysujOtwarta(ctx, X, Y);

    // Kadrowanie: część obrazu poza ramką jest przyciemniona.
    if (this._kadr) {
      const { obj, ramka, nw, nh } = this._kadr;
      ctx.fillStyle = 'rgba(28, 27, 25, 0.55)';
      ctx.beginPath();
      ctx.rect(X(obj.left), Y(obj.top), nw * obj.scaleX * s, nh * obj.scaleY * s);
      ctx.rect(X(ramka.left), Y(ramka.top), ramka.getScaledWidth() * s, ramka.getScaledHeight() * s);
      ctx.fill('evenodd');
    }

    // Prowadnice własne (i ta właśnie przeciągana – z położeniem w mm).
    if (this.pokazProwadnice || this._prowadnicaWRuchu) {
      const rysuj = (p, wRuchu) => {
        const strona = this.strony[Math.min(p.strona, this.strony.length - 1)];
        ctx.strokeStyle = wRuchu ? '#0e7490' : 'rgba(8, 145, 178, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        if (p.os === 'x') { const px = Math.round(X(p.poz)) + 0.5; ctx.moveTo(px, Y(-b)); ctx.lineTo(px, Y(h + b)); }
        else { const py = Math.round(Y(p.poz)) + 0.5; ctx.moveTo(X(strona.x), py); ctx.lineTo(X(strona.x + wStrony), py); }
        ctx.stroke();
        if (!wRuchu) return;
        const wartosc = p.os === 'x' ? p.poz - strona.x : p.poz;
        const tekst = `${String(Math.round(wartosc * 10) / 10).replace('.', ',')} mm`;
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const szer = ctx.measureText(tekst).width + 10;
        const tx = p.os === 'x' ? X(p.poz) + 6 : X(strona.x) + 6;
        const ty = p.os === 'x' ? Y(0) + 6 : Y(p.poz) + 6;
        ctx.fillStyle = '#0e7490';
        ctx.beginPath(); ctx.roundRect(tx, ty, szer, 16, 4); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(tekst, tx + 5, ty + 8.5);
      };
      if (this.pokazProwadnice) for (const p of this.prowadnice) if (p !== this._prowadnicaWRuchu) rysuj(p, false);
      if (this._prowadnicaWRuchu) rysuj(this._prowadnicaWRuchu, true);
    }

    // Obiekty z ostrzeżeniem: pomarańczowa ramka.
    if (this.ostrzezenia.length) {
      const ids = new Set(this.ostrzezenia.map((o) => o.id));
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      for (const o of this.canvas.getObjects()) {
        if (!ids.has(o.id)) continue;
        const r = o.getBoundingRect();
        ctx.strokeRect(X(r.left) - 2, Y(r.top) - 2, r.width * s + 4, r.height * s + 4);
      }
    }

    // Linie przyciągania: do prowadnicy przez całe płótno, do innego elementu –
    // na odcinku obejmującym oba elementy.
    if (this._liniePrzyciagania.length) {
      ctx.strokeStyle = '#db2777';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (const l of this._liniePrzyciagania) {
        ctx.beginPath();
        if (l.os === 'x') {
          const px = Math.round(X(l.poz)) + 0.5;
          ctx.moveTo(px, l.od === undefined ? 0 : Y(l.od) - 6); ctx.lineTo(px, l.do === undefined ? this.canvas.getHeight() : Y(l.do) + 6);
        } else {
          const py = Math.round(Y(l.poz)) + 0.5;
          ctx.moveTo(l.od === undefined ? 0 : X(l.od) - 6, py); ctx.lineTo(l.do === undefined ? this.canvas.getWidth() : X(l.do) + 6, py);
        }
        ctx.stroke();
      }
    }

    // Odległości do sąsiadów: odcinek ze strzałkami i liczbą w mm. Równe odstępy
    // mają pełną etykietę, zwykłe – samą liczbę w obwódce.
    for (const m of this._pomiary) {
      const pion = m.os === 'y';
      const a = pion ? [X(m.poprzek), Y(m.od)] : [X(m.od), Y(m.poprzek)];
      const b = pion ? [X(m.poprzek), Y(m.do)] : [X(m.do), Y(m.poprzek)];
      const kolor = m.rowne ? '#7c3aed' : '#db2777';
      ctx.strokeStyle = kolor;
      ctx.fillStyle = kolor;
      ctx.lineWidth = m.rowne ? 1.5 : 1;
      ctx.setLineDash(m.doKrawedzi ? [3, 3] : []);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Element po skosie: cienkie przedłużenie jego krawędzi do wysokości pomiaru.
      if (m.dociagniecie) {
        const d = m.dociagniecie;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        if (pion) { ctx.moveTo(X(d.od), Y(d.poz)); ctx.lineTo(X(d.do), Y(d.poz)); } else { ctx.moveTo(X(d.poz), Y(d.od)); ctx.lineTo(X(d.poz), Y(d.do)); }
        ctx.stroke();
        ctx.restore();
      }
      const dlugosc = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dlugosc > 14) {
        for (const [p, kier] of [[a, 1], [b, -1]]) {
          ctx.beginPath();
          if (pion) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - 3.5, p[1] + 6 * kier); ctx.lineTo(p[0] + 3.5, p[1] + 6 * kier); }
          else { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 6 * kier, p[1] - 3.5); ctx.lineTo(p[0] + 6 * kier, p[1] + 3.5); }
          ctx.closePath();
          ctx.fill();
        }
      }
      const tekst = String(Math.round(m.wartosc * 10) / 10).replace('.', ',');
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const szer = ctx.measureText(tekst).width + 10;
      let sx = (a[0] + b[0]) / 2;
      let sy = (a[1] + b[1]) / 2;
      // Etykieta, która nie mieści się na odcinku, staje obok niego.
      if (pion && dlugosc < 20) sx += szer / 2 + 6;
      if (!pion && dlugosc < szer + 14) sy -= 14;
      ctx.beginPath();
      ctx.roundRect(sx - szer / 2, sy - 8, szer, 16, 4);
      ctx.fillStyle = m.rowne ? kolor : '#ffffff';
      ctx.fill();
      if (!m.rowne) { ctx.lineWidth = 1; ctx.stroke(); }
      ctx.fillStyle = m.rowne ? '#ffffff' : kolor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tekst, sx, sy + 0.5);
    }
    ctx.restore();
  }

  // ---------- Gesty dotykowe (4.7) ----------
  // Jeden palec: Fabric (zaznaczanie, przesuwanie).
  // Dwa palce: przesuwanie widoku i szczypanie (zoom) – przechwytywane, zanim
  // dotrą do Fabric, a rozpoczęte przesuwanie obiektu jest cofane.

  _obslugaGestow() {
    const k = this.kontener;
    let gest = null;
    const srodek = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const odleglosc = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    k.addEventListener('touchstart', (e) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      this._przerwijTransformacje();
      gest = { srodek: srodek(e.touches), odl: odleglosc(e.touches), zoom: this.zoom };
    }, { capture: true, passive: false });

    k.addEventListener('touchmove', (e) => {
      if (!gest || e.touches.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      const sr = srodek(e.touches);
      k.scrollLeft -= sr.x - gest.srodek.x;
      k.scrollTop -= sr.y - gest.srodek.y;
      gest.srodek = sr;
      const nowyZoom = gest.zoom * (odleglosc(e.touches) / gest.odl);
      if (Math.abs(nowyZoom - this.zoom) / this.zoom > 0.02) this.ustawZoom(nowyZoom, sr);
    }, { capture: true, passive: false });

    const koniec = (e) => {
      if (gest && e.touches.length === 0) gest = null;
    };
    k.addEventListener('touchend', koniec, { capture: true });
    k.addEventListener('touchcancel', koniec, { capture: true });

    // „Rączka”: przytrzymana spacja albo środkowy przycisk myszy przesuwa widok.
    let reka = null;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    k.addEventListener('mousedown', (e) => {
      if (!(this.reka || e.button === 1)) return;
      stop(e);
      reka = { x: e.clientX, y: e.clientY };
      k.classList.add('przesuwa');
    }, { capture: true });
    window.addEventListener('mousemove', (e) => {
      if (!reka) return;
      k.scrollLeft -= e.clientX - reka.x;
      k.scrollTop -= e.clientY - reka.y;
      reka = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { reka = null; k.classList.remove('przesuwa'); });

    // Ctrl/⌘ + kółko (lub szczypanie na gładziku): zoom.
    k.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.ustawZoom(this.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY });
    }, { passive: false });
  }

  // Tryb „rączki” (spacja): kliknięcia nie zaznaczają, przeciąganie przesuwa widok.
  ustawReke(wlacz) {
    if (this.reka === wlacz) return;
    this.reka = wlacz;
    this.kontener.classList.toggle('reka', wlacz);
    this.canvas.skipTargetFind = wlacz || this._trybPunktow();
    this.canvas.selection = !this.canvas.skipTargetFind;
  }

  _przerwijTransformacje() {
    const c = this.canvas;
    const t = c._currentTransform;
    if (t && t.target && t.original) {
      const o = t.original;
      t.target.set({
        left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY,
        angle: o.angle, skewX: o.skewX, skewY: o.skewY,
        flipX: o.flipX, flipY: o.flipY,
      });
      t.target.setCoords();
    }
    c._currentTransform = null;
    c._groupSelector = null;
    this._liniePrzyciagania = [];
    c.requestRenderAll();
  }
}

// Skalowanie tekstu narożnikiem zamieniamy na rozmiar czcionki i szerokość,
// żeby w panelu i w wydruku rozmiar w pt był prawdziwy.
function utrwalSkaleTekstu(obj) {
  if (!obj) return;
  if (toZaznaczenie(obj) || obj.type === 'group') return;
  if (obj.type !== 'textbox') return;
  if (obj.scaleX === 1 && obj.scaleY === 1) return;
  // Ramka o stałej wysokości: górny i dolny uchwyt zmieniają wysokość ramki,
  // nie rozmiar pisma.
  if (obj.ramka_h > 0) {
    obj.ramka_h *= obj.scaleY;
    if (Math.abs(obj.scaleX - 1) < 1e-6) {
      obj.set({ scaleY: 1 });
      obj.initDimensions();
      obj.setCoords();
      return;
    }
    if (obj.rozmiar_bazowy) obj.rozmiar_bazowy *= obj.scaleY;
  }
  // Rozmiary nadane fragmentom skalują się razem z całością.
  for (const wiersz of Object.values(obj.styles || {})) {
    for (const znak of Object.values(wiersz || {})) if (znak.fontSize) znak.fontSize *= obj.scaleY;
  }
  obj.set({
    fontSize: obj.fontSize * obj.scaleY,
    width: obj.width * obj.scaleX,
    scaleX: 1,
    scaleY: 1,
  });
  obj.setCoords();
}

const NAZWY_TYPOW = {
  textbox: 'Tekst', 'i-text': 'Tekst', text: 'Tekst', rect: 'Prostokąt',
  ellipse: 'Elipsa', line: 'Linia', image: 'Obraz', group: 'Grupa', polygon: 'Wielokąt', path: 'Rysunek',
};

export function opisObiektu(o) {
  if (o.nazwa) return o.nazwa;
  if (toTabela(o)) return `Tabela ${o.tabela.wiersze.length}×${o.tabela.kolumny.length}`;
  const typ = NAZWY_TYPOW[o.type] || o.type;
  if (o.text) {
    const t = o.text.replace(/\s+/g, ' ').trim();
    return `${typ}: „${t.length > 24 ? `${t.slice(0, 24)}…` : t}”`;
  }
  return typ;
}

export function nazwaTypu(o) {
  if (toTabela(o)) return 'Tabela';
  if (toTabela(o.group)) return 'Komórka tabeli';
  return NAZWY_TYPOW[o.type] || o.type;
}
