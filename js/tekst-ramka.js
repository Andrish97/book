/* global fabric */
// Ramka tekstu o stałej wysokości (plan 4.3: autodopasowanie).
//
// Zwykły tekst w Fabric ma wysokość taką, jak jego treść. Tu tekst może dostać
// stałą wysokość ramki (`ramka_h`, mm), wyrównanie treści w pionie
// (`wyrownanie_pion`: gora | srodek | dol) i automatyczne zmniejszanie czcionki,
// gdy treść się nie mieści (`autodopasowanie`, nie poniżej `min_rozmiar` pt,
// licząc od `rozmiar_bazowy`). Działa tak samo w edytorze i przy składaniu
// stron z danymi – dlatego jest łatką na sam obiekt tekstu.

const PT = 25.4 / 72;
const liczDomyslnie = fabric.Textbox.prototype.initDimensions;

fabric.Textbox.prototype.initDimensions = function initDimensions() {
  if (this.__skipDimension) return;
  const ramka = this.ramka_h > 0;
  if (ramka && this.autodopasowanie && this.rozmiar_bazowy > 0) {
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

// Przesunięcie treści w pionie wewnątrz ramki.
function luzWRamce(o) {
  if (!(o.ramka_h > 0)) return 0;
  const luz = o.height - (o._wysokoscTresci ?? o.height);
  return luz > 0 ? luz * ({ srodek: 0.5, dol: 1 }[o.wyrownanie_pion] || 0) : 0;
}

fabric.Textbox.prototype._getTopOffset = function _getTopOffset() {
  return -this.height / 2 + luzWRamce(this);
};

// Kliknięcie w tekst: kursor trafia we właściwy wiersz także wtedy, gdy treść
// jest odsunięta od górnej krawędzi ramki.
const kursorZWskaznika = fabric.Textbox.prototype.getSelectionStartFromPointer;
fabric.Textbox.prototype.getSelectionStartFromPointer = function getSelectionStartFromPointer(e) {
  const luz = luzWRamce(this);
  if (!luz) return kursorZWskaznika.call(this, e);
  const lokalny = this.getLocalPointer;
  this.getLocalPointer = (...argumenty) => {
    const p = lokalny.apply(this, argumenty);
    p.y -= luz * this.scaleY;
    return p;
  };
  try { return kursorZWskaznika.call(this, e); } finally { delete this.getLocalPointer; }
};

// Czy treść wystaje poza ramkę (do ostrzeżeń).
export const nieMiesciSie = (o) => o.type === 'textbox' && o.ramka_h > 0 && (o._wysokoscTresci ?? 0) > o.ramka_h + 0.05;
