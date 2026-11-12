#!/usr/bin/env python3
"""Pakuje łącznik Seriodruku jako rozszerzenie Claude Desktop (MCP Bundle, plik .mcpb).

Użycie:  python3 scripts/rozszerzenie-mcpb.py <plik wynikowy .mcpb>
   np.:  python3 scripts/rozszerzenie-mcpb.py _site/ai/mcp/seriodruk.mcpb

Rozszerzenie to archiwum ZIP z manifest.json w katalogu głównym (specyfikacja:
https://github.com/modelcontextprotocol/mcpb, MANIFEST.md, wersja 0.3). Claude Desktop na macOS
i Windows ma własny Node.js, więc użytkownik niczego nie instaluje: otwiera plik, wpisuje klucz
dostępu z okna „Dostęp dla AI” i gotowe. Klucz trafia do zmiennej SERIODRUK_KLUCZ serwera.

W środku: server/seriodruk-mcp.mjs (ten sam serwer co ai/mcp/seriodruk-mcp.mjs),
format-seriodruk.md (narzędzie opis_formatu czyta go obok serwera, bez sieci) i ikona.
"""
import datetime
import json
import pathlib
import sys
import zipfile

KORZEN = pathlib.Path(__file__).resolve().parent.parent


def manifest(wersja):
    return {
        'manifest_version': '0.3',
        'name': 'seriodruk',
        'display_name': 'Seriodruk',
        'version': wersja,
        'description': 'Czytanie i zmiana jednego projektu Seriodruku (kalendarze, planery) razem z Tobą – zmiany widać w otwartym edytorze na żywo.',
        'long_description': 'Łącznik daje Claude narzędzia do projektu w Seriodruku: przegląd, odczyt stron, wzorców i tabel, zmiana elementów, stron, stylów, tabel danych, serii i sekcji, obrazy projektu (wgrywanie z plików i folderów na tym komputerze, z ZIP-ów i z internetu, wstawianie, zmiana nazw, usuwanie, porządkowanie) oraz kontrola przed drukiem. Dostęp obejmuje tylko projekt, dla którego utworzysz klucz w aplikacji (menu ⋯ → Dostęp dla AI…); klucz wygasa sam i możesz go odebrać w każdej chwili.',
        'author': {'name': 'Seriodruk', 'url': 'https://andrish97.github.io/book/'},
        'homepage': 'https://andrish97.github.io/book/',
        'documentation': 'https://andrish97.github.io/book/ai/api.md',
        'icon': 'icon.png',
        'server': {
            'type': 'node',
            'entry_point': 'server/seriodruk-mcp.mjs',
            'mcp_config': {
                'command': 'node',
                'args': ['${__dirname}/server/seriodruk-mcp.mjs'],
                'env': {'SERIODRUK_KLUCZ': '${user_config.klucz}'},
            },
        },
        'tools_generated': True,
        'user_config': {
            'klucz': {
                'type': 'string',
                'title': 'Klucz dostępu Seriodruku',
                'description': 'Klucz zaczynający się od sdk_ – utworzysz go w edytorze: menu ⋯ → Dostęp dla AI… → Utwórz klucz.',
                'sensitive': True,
                'required': True,
            },
        },
        'compatibility': {'platforms': ['darwin', 'win32'], 'runtimes': {'node': '>=18.0.0'}},
        'keywords': ['seriodruk', 'kalendarz', 'planer', 'druk', 'pdf'],
        'license': 'MIT',
    }


def main(cel):
    cel = pathlib.Path(cel)
    cel.parent.mkdir(parents=True, exist_ok=True)
    teraz = datetime.datetime.now(datetime.timezone.utc)
    wersja = f'1.{teraz:%Y%m%d}.{teraz.hour * 100 + teraz.minute}'  # semver: bez zer na początku części
    pliki = {
        'server/seriodruk-mcp.mjs': KORZEN / 'ai' / 'mcp' / 'seriodruk-mcp.mjs',
        'format-seriodruk.md': KORZEN / 'ai' / 'format-seriodruk.md',
        'icon.png': KORZEN / 'img' / 'ikony' / 'ikona-512.png',
    }
    # Dodatkowe moduły serwera (np. wspólne narzędzia) – wszystko z ai/mcp obok pliku głównego.
    for p in sorted((KORZEN / 'ai' / 'mcp').glob('*.mjs')):
        pliki.setdefault(f'server/{p.name}', p)
    with zipfile.ZipFile(cel, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json', json.dumps(manifest(wersja), ensure_ascii=False, indent=2))
        for nazwa, zrodlo in pliki.items():
            z.write(zrodlo, nazwa)
    print(f'{cel}: rozszerzenie Seriodruk {wersja}, {len(pliki) + 1} plików')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
