// Linijki w milimetrach nad płótnem i z jego lewej strony. Zero leży w rogu
// strony bieżącej. Przeciągnięcie z linijki na stronę tworzy prowadnicę:
// z górnej – poziomą, z lewej – pionową.

const GRUBOSC = 20;
const KROKI = [1, 2, 5, 10, 20, 50, 100, 200, 500];

export class Linijki {
  constructor(edytor, obszar) {
    this.edytor = edytor;
    this.obszar = obszar;
    this.widoczne = false;
    this.x = this._plotno('linijka linijka-x', 'y');
    this.y = this._plotno('linijka linijka-y', 'x');
    this.rog = document.createElement('div');
    this.rog.className = 'linijka linijka-rog';
    obszar.append(this.x, this.y, this.rog);

    const odswiez = () => this.rysuj();
    edytor.addEventListener('geometria', odswiez);
    edytor.addEventListener('zoom', odswiez);
    edytor.kontener.addEventListener('scroll', odswiez, { passive: true });
    new ResizeObserver(odswiez).observe(obszar);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', odswiez);
    new MutationObserver(odswiez).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motyw'] });
  }

  // os – oś prowadnicy, którą wyciąga się z tej linijki.
  _plotno(klasa, os) {
    const c = document.createElement('canvas');
    c.className = klasa;
    c.title = os === 'y' ? 'Przeciągnij w dół, aby dodać poziomą prowadnicę' : 'Przeciągnij w prawo, aby dodać pionową prowadnicę';
    c.addEventListener('pointerdown', (e) => {
      if (!this.edytor.wydruk) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const prowadnica = this.edytor.wyciagnijProwadnice(os);
      const ruch = (ev) => prowadnica.ruch(ev.clientX, ev.clientY, ev.ctrlKey || ev.metaKey);
      const koniec = () => {
        c.removeEventListener('pointermove', ruch);
        prowadnica.koniec();
      };
      c.addEventListener('pointermove', ruch);
      c.addEventListener('pointerup', koniec, { once: true });
      c.addEventListener('pointercancel', koniec, { once: true });
    });
    return c;
  }

  ustaw(widoczne) {
    this.widoczne = widoczne;
    this.obszar.classList.toggle('z-linijkami', widoczne);
    this.rysuj();
  }

  rysuj() {
    const e = this.edytor;
    if (!this.widoczne || !e.wydruk || !this.x.offsetParent) return;
    const styl = getComputedStyle(this.obszar);
    const kolory = { tlo: styl.getPropertyValue('--powierzchnia-2').trim(), kreska: styl.getPropertyValue('--linia-mocna').trim(), tekst: styl.getPropertyValue('--cichy').trim() };
    const ramkaObszaru = this.obszar.getBoundingClientRect();
    const ramkaPlotna = e.canvas.upperCanvasEl.getBoundingClientRect();
    const v = e.canvas.viewportTransform;
    const skala = v[0];
    const strona = e.strony[e.aktywna] || { x: 0 };
    // Piksel (w obszarze roboczym), w którym leży zero linijki.
    const zeroX = ramkaPlotna.left - ramkaObszaru.left + v[4] + strona.x * skala;
    const zeroY = ramkaPlotna.top - ramkaObszaru.top + v[5];
    const glowny = KROKI.find((k) => k * skala >= 48) || KROKI.at(-1);
    const drobny = [10, 5, 2].map((n) => glowny / n).find((k) => k * skala >= 4 && Number.isInteger(k * 2)) || glowny;

    const rysujOs = (plotno, dlugosc, zero, pozioma) => {
      const dpr = window.devicePixelRatio || 1;
      const [w, h] = pozioma ? [dlugosc, GRUBOSC] : [GRUBOSC, dlugosc];
      plotno.width = Math.round(w * dpr); plotno.height = Math.round(h * dpr);
      plotno.style.width = `${w}px`; plotno.style.height = `${h}px`;
      const ctx = plotno.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = kolory.tlo;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = kolory.kreska;
      ctx.fillStyle = kolory.tekst;
      ctx.lineWidth = 1;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      const pierwszy = Math.floor((-zero / skala) / drobny) * drobny;
      ctx.beginPath();
      for (let mm = pierwszy; zero + mm * skala < dlugosc; mm += drobny) {
        const p = Math.round(zero + mm * skala) + 0.5;
        if (p < GRUBOSC) continue;
        const naGlownym = Math.abs(mm / glowny - Math.round(mm / glowny)) < 1e-6;
        const dl = naGlownym ? GRUBOSC : (Math.abs(mm / (glowny / 2) - Math.round(mm / (glowny / 2))) < 1e-6 ? 9 : 5);
        if (pozioma) { ctx.moveTo(p, GRUBOSC); ctx.lineTo(p, GRUBOSC - dl); } else { ctx.moveTo(GRUBOSC, p); ctx.lineTo(GRUBOSC - dl, p); }
        if (naGlownym) {
          const napis = String(Math.round(mm));
          if (pozioma) ctx.fillText(napis, p + 3, 2);
          else { ctx.save(); ctx.translate(2, p + 3); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'right'; ctx.fillText(napis, 0, 0); ctx.restore(); }
        }
      }
      ctx.stroke();
      ctx.beginPath();
      if (pozioma) { ctx.moveTo(0, GRUBOSC - 0.5); ctx.lineTo(w, GRUBOSC - 0.5); } else { ctx.moveTo(GRUBOSC - 0.5, 0); ctx.lineTo(GRUBOSC - 0.5, h); }
      ctx.stroke();
    };
    rysujOs(this.x, this.obszar.clientWidth, zeroX, true);
    rysujOs(this.y, this.obszar.clientHeight, zeroY, false);
  }
}
