"""Porównanie zrzutów przed i po zmianie wyglądu (silnik stylów, krok 5 – #290).

Użycie:
    python3 -I scripts/zrzuty-porownaj.py <katalog-przed> <katalog-po> [--prog=0.1] [--roznice=<katalog>]

Katalogi to wynik scripts/zrzuty-przeglad.cjs (<urządzenie>/<motyw>/<widok>.png). Dla każdej pary obrazów liczy
odsetek pikseli różniących się o więcej niż 8 (na 255) w którymś kanale. Wypisuje widoki zmienione powyżej progu
(w procentach, domyślnie 0,1%), brakujące i nowe; z --roznice zapisuje obrazy różnic (zmienione piksele na
czerwono na wyblakłym tle). Kod wyjścia 1, gdy coś się zmieniło – do sprawdzania „bez zmiany wyglądu”.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def wczytaj(p):
    return np.asarray(Image.open(p).convert('RGB'), dtype=np.int16)


def main():
    arg = [a for a in sys.argv[1:] if not a.startswith('--')]
    opcje = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if len(arg) != 2:
        print(__doc__)
        return 2
    przed, po = Path(arg[0]), Path(arg[1])
    prog = float(opcje.get('prog', '0.1'))
    roznice = Path(opcje['roznice']) if 'roznice' in opcje else None
    a = {p.relative_to(przed) for p in przed.rglob('*.png') if 'arkusze' not in p.parts}
    b = {p.relative_to(po) for p in po.rglob('*.png') if 'arkusze' not in p.parts}
    zmiany = []
    for rel in sorted(a & b):
        x, y = wczytaj(przed / rel), wczytaj(po / rel)
        if x.shape != y.shape:
            zmiany.append((100.0, rel, f'inny rozmiar {x.shape[1]}×{x.shape[0]} → {y.shape[1]}×{y.shape[0]}'))
            continue
        maska = (np.abs(x - y) > 8).any(axis=2)
        odsetek = 100.0 * maska.mean()
        if odsetek > prog:
            zmiany.append((odsetek, rel, ''))
            if roznice:
                obraz = (y * 0.25 + 191).astype(np.uint8)
                obraz[maska] = [220, 30, 30]
                cel = roznice / rel
                cel.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(obraz).save(cel)
    for rel in sorted(a - b):
        zmiany.append((100.0, rel, 'brak w „po”'))
    for rel in sorted(b - a):
        zmiany.append((100.0, rel, 'nowy w „po”'))
    porownane = len(a & b)
    if not zmiany:
        print(f'Bez zmian: {porownane} zrzutów (próg {prog}%).')
        return 0
    print(f'Zmienione: {len(zmiany)} z {porownane} (próg {prog}%):')
    for odsetek, rel, uwaga in sorted(zmiany, key=lambda z: -z[0]):
        print(f'  {odsetek:6.2f}%  {rel}{"  – " + uwaga if uwaga else ""}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
