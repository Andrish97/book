#!/usr/bin/env python3
"""Arkusze zbiorcze ze zrzutów przeglądu (scripts/zrzuty-przeglad.cjs).

Użycie: python3 scripts/arkusze-zrzutow.py <katalog zrzutów> <katalog arkuszy>
Dla każdego urządzenia i motywu: kilka zrzutów obok siebie, pomniejszonych do wspólnej wysokości, z podpisem.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

zrodlo, cel = Path(sys.argv[1]), Path(sys.argv[2])
cel.mkdir(parents=True, exist_ok=True)
try:
    czcionka = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except OSError:
    czcionka = ImageFont.load_default()

for urzadzenie in sorted(p for p in zrodlo.iterdir() if p.is_dir() and p.name != 'arkusze'):
    motywy = [m for m in sorted(urzadzenie.iterdir()) if m.is_dir()] or [urzadzenie]
    for motyw in motywy:
        pliki = sorted(motyw.glob('*.png'))
        if not pliki:
            continue
        pierwszy = Image.open(pliki[0])
        pionowy = pierwszy.height > pierwszy.width
        wys = 900 if pionowy else 560
        naraz = 6 if pionowy else 4
        kolumny = 6 if pionowy else 2
        for nr in range(0, len(pliki), naraz):
            grupa = pliki[nr:nr + naraz]
            obrazy = []
            for p in grupa:
                im = Image.open(p).convert('RGB')
                im = im.resize((round(im.width * wys / im.height), wys))
                obrazy.append((p.stem, im))
            szer = max(im.width for _, im in obrazy)
            wiersze = (len(obrazy) + kolumny - 1) // kolumny
            ark = Image.new('RGB', (kolumny * (szer + 16) + 16, wiersze * (wys + 44) + 16), (60, 60, 60))
            d = ImageDraw.Draw(ark)
            for i, (nazwa, im) in enumerate(obrazy):
                x = 16 + (i % kolumny) * (szer + 16)
                y = 16 + (i // kolumny) * (wys + 44)
                d.text((x, y), nazwa, fill=(255, 255, 255), font=czcionka)
                ark.paste(im, (x, y + 28))
            nazwa = f'{urzadzenie.name}-{motyw.name if motyw != urzadzenie else "x"}-{nr // naraz + 1:02d}.png'
            ark.save(cel / nazwa, optimize=True)
print('arkusze:', cel)
