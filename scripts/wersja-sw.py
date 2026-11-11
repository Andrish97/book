#!/usr/bin/env python3
"""Przy wdrożeniu: wpisuje do sw.js numer wersji i listę plików kodu aplikacji.

Użycie:  python3 scripts/wersja-sw.py <katalog strony> <wersja>
   np.:  python3 scripts/wersja-sw.py _site "$GITHUB_SHA"

Service worker (sw.js) podaje kod aplikacji z pamięci przeglądarki. Każde wdrożenie ma własną pamięć
(nazwa z numerem wersji) i przy instalacji pobiera w całości pliki z tej listy – dlatego w pamięci nie
mieszają się pliki dwóch wersji, a zmieniony sw.js mówi przeglądarce, że jest nowa wersja.
Na liście są: index.html, manifest i wszystkie pliki .js i .css z js/ i css/ (bez czcionek i profili –
te idą do osobnej pamięci przy pierwszym użyciu).
"""
import json
import pathlib
import re
import sys


def main(katalog, wersja):
    korzen = pathlib.Path(katalog)
    sw = korzen / 'sw.js'
    # Rzadko używane biblioteki (PDF, Excel, ZIP) nie są pobierane przy każdym wdrożeniu – service worker
    # zapamiętuje je przy pierwszym użyciu (toRzadkaBiblioteka w sw.js).
    rzadkie = re.compile(r'/js/zewnetrzne/(pdf-lib|fontkit|jszip|xlsx)-[\d.]+[^/]*\.js$')
    pliki = sorted(
        './' + p.relative_to(korzen).as_posix()
        for p in list((korzen / 'js').rglob('*.js')) + list((korzen / 'css').glob('*.css'))
        if not rzadkie.search('/' + p.relative_to(korzen).as_posix())
    )
    tekst = sw.read_text(encoding='utf8')
    wersja = re.sub(r'[^0-9A-Za-z._-]', '', wersja)[:40] or 'brak'
    nowy, n1 = re.subn(r"^const WERSJA = 'rozwoj';$", f"const WERSJA = '{wersja}';", tekst, flags=re.M)
    nowy, n2 = re.subn(r"^const PLIKI = \[\];$", 'const PLIKI = ' + json.dumps(pliki, ensure_ascii=False) + ';', nowy, flags=re.M)
    if n1 != 1 or n2 != 1:
        raise SystemExit('sw.js nie ma oczekiwanych linii WERSJA i PLIKI – sprawdź skrypt.')
    sw.write_text(nowy, encoding='utf8')
    print(f'sw.js: wersja {wersja}, {len(pliki)} plików kodu')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
