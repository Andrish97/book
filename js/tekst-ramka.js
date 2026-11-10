/* global fabric */
// Ramka tekstu o stałej wysokości (plan 4.3: autodopasowanie).
//
// Zwykły tekst w Fabric ma wysokość taką, jak jego treść. Tu tekst może dostać
// stałą wysokość ramki (`ramka_h`, mm), wyrównanie treści w pionie
// (`wyrownanie_pion`: gora | srodek | dol) i automatyczne zmniejszanie czcionki,
// gdy treść się nie mieści (`autodopasowanie`, nie poniżej `min_rozmiar` pt,
// licząc od `rozmiar_bazowy`). Działa tak samo w edytorze i przy składaniu
// stron z danymi – dlatego jest łatką na sam obiekt tekstu.

import './fabric-ustawienia.js';

const PT = 25.4 / 72;
const liczDomyslnie = fabric.Textbox.prototype.initDimensions;

fabric.Textbox.prototype.initDimensions = function initDimensions() {
  if (!this.initialized) return;
  const ramka = this.ramka_h > 0;
  // Ramka połączona z innymi (js/watki.js) nie zmniejsza tekstu – nadmiar płynie dalej.
  if (ramka && this.autodopasowanie && this.rozmiar_bazowy > 0 && !this.watek) {
    const min = Math.min(this.rozmiar_bazowy, (this.min_rozmiar || 6) * PT);
    this.fontSize = this.rozmiar_bazowy;
    liczDomyslnie.call(this);
    for (let proba = 0; proba < 80 && this.height > this.ramka_h + 0.01 && this.fontSize > min; proba += 1) {
      this.fontSize = Math.max(min, this.fontSize * 0.97);
      liczDomyslnie.call(this);
    }
  } else liczDomyslnie.call(this);
  this._wysokoscTresci = this.height;
  if (ramka) this.height = this.ramka_h;
};

// Fragmenty z własnym rozmiarem czcionki zmniejszają się razem z resztą tekstu. W zapisie fragment
// trzyma rozmiar zadany (taki, jaki ma przy rozmiarze bazowym ramki); przy mierzeniu i rysowaniu
// jest mnożony przez to, o ile autodopasowanie zmniejszyło cały tekst. Po powrocie do rozmiaru
// bazowego mnożnik wynosi 1 i fragmenty mają znów swoje rozmiary.
const skalaFragmentow = (o) => (o.ramka_h > 0 && o.autodopasowanie && o.rozmiar_bazowy > 0 && !o.watek && o.fontSize > 0 ? o.fontSize / o.rozmiar_bazowy : 1);

const stylZnaku = fabric.Textbox.prototype._getStyleDeclaration;
fabric.Textbox.prototype._getStyleDeclaration = function _getStyleDeclaration(wiersz, znak) {
  const styl = stylZnaku.call(this, wiersz, znak);
  if (!styl || !(styl.fontSize > 0)) return styl;
  const k = skalaFragmentow(this);
  return Math.abs(k - 1) < 1e-6 ? styl : { ...styl, fontSize: styl.fontSize * k };
};
// Zapis stylu znaku idzie w drugą stronę: rozmiar widoczny na ekranie wraca do rozmiaru zadanego.
const zapiszStylZnaku = fabric.Textbox.prototype._setStyleDeclaration;
fabric.Textbox.prototype._setStyleDeclaration = function _setStyleDeclaration(wiersz, znak, styl) {
  const k = skalaFragmentow(this);
  const doZapisu = styl && styl.fontSize > 0 && Math.abs(k - 1) >= 1e-6 ? { ...styl, fontSize: styl.fontSize / k } : styl;
  return zapiszStylZnaku.call(this, wiersz, znak, doZapisu);
};

// Przesunięcie treści w pionie wewnątrz ramki.
function luzWRamce(o) {
  if (!(o.ramka_h > 0)) return 0;
  const luz = o.height - (o._wysokoscTresci ?? o.height);
  return luz > 0 ? luz * ({ srodek: 0.5, dol: 1 }[o.wyrownanie_pion] || 0) : 0;
}

fabric.Textbox.prototype._getTopOffset = function _getTopOffset() {
  return -this.height / 2 + luzWRamce(this);
};

// Kliknięcie w tekst trafia we właściwy wiersz także wtedy, gdy treść jest odsunięta od górnej
// krawędzi ramki: Fabric 7 liczy położenie kursora od tego samego _getTopOffset.

// ---------- Lista: wypunktowanie i numerowanie akapitów ----------
//
// `lista`: 'punkty' | 'kreski' | 'numery'. Każdy akapit dostaje znak przed
// pierwszym wierszem, a cały tekst jest wcięty, więc dalsze wiersze akapitu
// stoją równo pod pierwszym. Znak jest rysowany, nie wpisany w treść – pola
// {…} i dane z tabeli działają bez zmian. `lista_start` to numer pierwszego
// akapitu (ustawia go przelewanie tekstu w kolejnej ramce).

const ZNAKI_LISTY = { punkty: '•', kreski: '–' };
export const wciecieListy = (o) => (o.lista ? o.fontSize * (o.lista === 'numery' ? 1.9 : 1.2) : 0);

const P = fabric.Textbox.prototype;
// Właściwości, po których zmianie tekst trzeba zmierzyć i narysować od nowa.
function wplywaNaUklad(k) {
  const T = fabric.Textbox;
  if (!T.textLayoutProperties.includes(k)) T.textLayoutProperties = [...T.textLayoutProperties, k];
  if (!T.cacheProperties.includes(k)) T.cacheProperties = [...T.cacheProperties, k];
}
for (const k of ['lista', 'lista_start']) wplywaNaUklad(k);

const zawin = P._wrapLine;
P._wrapLine = function _wrapLine(nr, szerokosc, dane, zarezerwowane) {
  return zawin.call(this, nr, szerokosc, dane, (zarezerwowane || 0) + wciecieListy(this));
};

const odLewej = P._getLineLeftOffset;
P._getLineLeftOffset = function _getLineLeftOffset(nr) {
  const baza = odLewej.call(this, nr);
  const w = wciecieListy(this);
  if (!w) return baza;
  const koniec = this.isEndOfWrapping(nr);
  const a = this.textAlign;
  if (a === 'right' || (a === 'justify-right' && koniec)) return baza;
  if (a === 'center' || (a === 'justify-center' && koniec)) return baza + w / 2;
  return baza + w;
};

// Justowanie rozciąga wiersz do szerokości pomniejszonej o wcięcie.
const rozciagnij = P.enlargeSpaces;
P.enlargeSpaces = function enlargeSpaces() {
  const w = wciecieListy(this);
  if (!w) { rozciagnij.call(this); return; }
  const szerokosc = this.width;
  this.width = szerokosc - w;
  try { rozciagnij.call(this); } finally { this.width = szerokosc; }
};

const rysujTekst = P._renderText;
P._renderText = function _renderText(ctx) {
  rysujTekst.call(this, ctx);
  if (!this.lista || !this._styleMap) return;
  const lewo = this._getLeftOffset();
  let y = this._getTopOffset();
  let numer = this.lista_start || 1;
  // Pierwszy akapit ramki z ciągiem dalszym (środek akapitu) nie dostaje znaku.
  const ciagDalszy = this.watek && this.watek_nr > 0 && this.lacznik !== undefined && this.lacznik !== '\n';
  ctx.save();
  for (let i = 0; i < this._textLines.length; i += 1) {
    const wysokosc = this.getHeightOfLine(i);
    const m = this._styleMap[i];
    const poczatekAkapitu = m && m.offset === 0 && this._unwrappedTextLines[m.line].join('').trim() !== '';
    if (poczatekAkapitu && !(ciagDalszy && m.line === 0)) {
      const styl = this.getCompleteStyleDeclaration(i, 0);
      ctx.font = this._getFontDeclaration(styl);
      ctx.fillStyle = typeof styl.fill === 'string' ? styl.fill : (typeof this.fill === 'string' ? this.fill : '#000000');
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'right'; // znak kończy się tuż przed tekstem – numery równają do kropki
      const znak = this.lista === 'numery' ? `${numer}.` : (ZNAKI_LISTY[this.lista] || '•');
      const podstawa = y + this.getHeightOfLineImpl(i) * (1 - this._fontSizeFraction);
      ctx.fillText(znak, lewo + this._getLineLeftOffset(i) - styl.fontSize * 0.4, podstawa);
      numer += 1;
    }
    y += wysokosc;
  }
  ctx.restore();
};

// ---------- Wielkość liter jako wygląd ----------
//
// `wielkosc_liter`: 'wielkie' | 'male'. Treść zostaje taka, jak ją wpisano (i taka idzie
// do pól z danymi) – zmienia się tylko to, jak znaki są mierzone i rysowane.
const zmienLitery = (o, s) => (o.wielkosc_liter === 'wielkie' ? s.toLocaleUpperCase('pl') : (o.wielkosc_liter === 'male' ? s.toLocaleLowerCase('pl') : s));
wplywaNaUklad('wielkosc_liter');
const mierzZnak = P._measureChar;
P._measureChar = function _measureChar(znak, styl, poprzedni, stylPoprzedniego) {
  if (!this.wielkosc_liter) return mierzZnak.call(this, znak, styl, poprzedni, stylPoprzedniego);
  return mierzZnak.call(this, zmienLitery(this, znak), styl, poprzedni ? zmienLitery(this, poprzedni) : poprzedni, stylPoprzedniego);
};
const rysujZnak = P._renderChar;
P._renderChar = function _renderChar(metoda, ctx, nrWiersza, nrZnaku, znak, lewo, gora) {
  return rysujZnak.call(this, metoda, ctx, nrWiersza, nrZnaku, this.wielkosc_liter ? zmienLitery(this, znak) : znak, lewo, gora);
};

// Czy treść wystaje poza ramkę (do ostrzeżeń).
export const nieMiesciSie = (o) => o.type === 'textbox' && o.ramka_h > 0 && (o._wysokoscTresci ?? 0) > o.ramka_h + 0.05;
