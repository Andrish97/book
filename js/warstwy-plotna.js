// Pamięć warstw płótna na czas pisania w ramce i przeciągania elementu.
//
// Fabric przy każdej klatce rysuje od nowa wszystkie elementy strony. Na stronie z kilkuset elementami
// (kalendarz, dziennik) to kilkadziesiąt milisekund na klatkę – pisanie i przeciąganie się wtedy tnie.
// Gdy zmienia się tylko jeden element (pisany tekst, przeciągany obiekt), resztę wystarczy narysować raz:
// elementy pod nim do jednego obrazu, elementy nad nim do drugiego. Każda kolejna klatka to dwa gotowe
// obrazy i między nimi elementy, które się zmieniają.
//
// Bezpieczeństwo: obrazy są ważne tylko tak długo, jak nic poza zmienianymi elementami się nie zmieniło.
// Co klatkę sprawdzamy listę elementów (te same, w tej samej kolejności), ich położenie, rozmiar, obrót,
// krycie, widoczność i znacznik „dirty” Fabric (zmiana wyglądu) oraz widok płótna (powiększenie,
// przesunięcie, rozmiar). Każda różnica – rysowanie od nowa, jak bez tej pamięci.

const MIN_ELEMENTOW = 40; // przy mniejszej liczbie elementów pełne rysowanie jest i tak szybkie

function podpis(o) {
  return `${o.left},${o.top},${o.width},${o.height},${o.scaleX},${o.scaleY},${o.angle},${o.skewX},${o.skewY},${o.flipX},${o.flipY},${o.opacity},${o.visible}`;
}

// dynamiczne(): elementy, które właśnie się zmieniają (puste – zwykłe rysowanie).
export function wlaczPamiecWarstw(c, dynamiczne) {
  const oryginal = c._renderObjects.bind(c);
  let pamiec = null;

  const zwolnij = () => {
    if (!pamiec) return;
    for (const p of [pamiec.pod, pamiec.nad]) { if (p) { p.width = 0; p.height = 0; } }
    pamiec = null;
  };

  const narysuj = (lista, szer, wys, r, v) => {
    if (!lista.length) return null;
    const p = document.createElement('canvas');
    p.width = szer;
    p.height = wys;
    const ctx = p.getContext('2d');
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    for (const o of lista) o.render(ctx);
    return p;
  };

  c._renderObjects = function renderObjects(ctx, objects) {
    let dyn = null;
    if (ctx === c.contextContainer && objects.length >= MIN_ELEMENTOW) {
      try { dyn = dynamiczne(); } catch { dyn = null; }
    }
    let od = -1;
    let doo = -1;
    if (dyn?.length) {
      const zbior = new Set(dyn);
      objects.forEach((o, i) => { if (zbior.has(o)) { if (od < 0) od = i; doo = i; } });
    }
    if (od < 0) { zwolnij(); oryginal(ctx, objects); return; }

    const v = c.viewportTransform;
    const r = c.getRetinaScaling();
    const szer = c.lowerCanvasEl.width;
    const wys = c.lowerCanvasEl.height;
    const klucz = `${v.join(',')}|${r}|${szer}|${wys}|${od}|${doo}|${objects.length}`;
    const pod = objects.slice(0, od);
    const nad = objects.slice(doo + 1);
    const stale = [...pod, ...nad];
    const podpisy = stale.map(podpis);
    // „dirty” nie liczy się tylko u elementu poza widokiem, który był taki już przy zapamiętaniu: Fabric go nie
    // rysuje i nie zdejmuje mu znacznika – a na obrazie i tak go nie ma.
    const wazna = pamiec && pamiec.klucz === klucz
      && pamiec.stale.length === stale.length
      && stale.every((o, i) => o === pamiec.stale[i] && (!o.dirty || (pamiec.brudne[i] && !o.isOnScreen())) && podpisy[i] === pamiec.podpisy[i]);
    if (!wazna) {
      zwolnij();
      const obrazPod = narysuj(pod, szer, wys, r, v);
      const obrazNad = narysuj(nad, szer, wys, r, v);
      pamiec = { klucz, stale, podpisy, brudne: stale.map((o) => Boolean(o.dirty)), pod: obrazPod, nad: obrazNad };
    }
    const rysujObraz = (obraz) => {
      if (!obraz) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(obraz, 0, 0);
      ctx.restore();
    };
    rysujObraz(pamiec.pod);
    for (let i = od; i <= doo; i += 1) objects[i]?.render(ctx);
    rysujObraz(pamiec.nad);
  };

  return { zwolnij };
}
