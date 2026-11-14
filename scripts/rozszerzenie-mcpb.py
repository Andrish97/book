#!/usr/bin/env python3
"""Pakuje łącznik Makietki jako rozszerzenie Claude Desktop (MCP Bundle, plik .mcpb).

Użycie:  python3 scripts/rozszerzenie-mcpb.py <plik wynikowy .mcpb>
   np.:  python3 scripts/rozszerzenie-mcpb.py _site/ai/mcp/makietka.mcpb

Rozszerzenie to archiwum ZIP z manifest.json w katalogu głównym (specyfikacja:
https://github.com/modelcontextprotocol/mcpb, MANIFEST.md, wersja 0.3). Claude Desktop na macOS
i Windows ma własny Node.js, więc użytkownik niczego nie instaluje: otwiera plik, wpisuje klucz
dostępu z okna „Dostęp dla AI” i gotowe. Klucz trafia do zmiennej MAKIETKA_KLUCZ serwera.

W środku: server/makietka-mcp.mjs (ten sam serwer co ai/mcp/makietka-mcp.mjs),
format-makietka.md (narzędzie opis_formatu czyta go obok serwera, bez sieci) i ikona.
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
        'name': 'makietka',
        'display_name': 'Makietka',
        'version': wersja,
        'description': 'Czytanie i zmiana jednego projektu Makietki (kalendarze, planery) razem z Tobą – zmiany widać w otwartym edytorze na żywo.',
        'long_description': 'Łącznik daje Claude narzędzia do projektu w Makietce: przegląd, odczyt stron, wzorców i tabel, zmiana elementów, stron, stylów, tabel danych, serii i sekcji, obrazy projektu (wgrywanie z plików i folderów na tym komputerze, z ZIP-ów i z internetu, wstawianie, zmiana nazw, usuwanie, porządkowanie) oraz kontrola przed drukiem. Dostęp obejmuje tylko projekt, dla którego utworzysz klucz w aplikacji (menu ⋯ → Dostęp dla AI…); klucz wygasa sam i możesz go odebrać w każdej chwili.',
        'author': {'name': 'Makietka', 'url': 'https://makietka.app/'},
        'homepage': 'https://makietka.app/',
        'documentation': 'https://makietka.app/ai/api.md',
        'icon': 'icon.png',
        'server': {
            'type': 'node',
            'entry_point': 'server/makietka-mcp.mjs',
            'mcp_config': {
                'command': 'node',
                'args': ['${__dirname}/server/makietka-mcp.mjs'],
                'env': {'MAKIETKA_KLUCZ': '${user_config.klucz}'},
            },
        },
        'tools_generated': True,
        'user_config': {
            'klucz': {
                'type': 'string',
                'title': 'Klucz dostępu Makietki',
                'description': 'Klucz zaczynający się od sdk_ – utworzysz go w edytorze: menu ⋯ → Dostęp dla AI… → Utwórz klucz.',
                'sensitive': True,
                'required': True,
            },
        },
        'compatibility': {'platforms': ['darwin', 'win32'], 'runtimes': {'node': '>=18.0.0'}},
        'keywords': ['makietka', 'kalendarz', 'planer', 'druk', 'pdf'],
        'license': 'MIT',
    }


def main(cel):
    cel = pathlib.Path(cel)
    cel.parent.mkdir(parents=True, exist_ok=True)
    teraz = datetime.datetime.now(datetime.timezone.utc)
    wersja = f'1.{teraz:%Y%m%d}.{teraz.hour * 100 + teraz.minute}'  # semver: bez zer na początku części
    pliki = {
        'server/makietka-mcp.mjs': KORZEN / 'ai' / 'mcp' / 'makietka-mcp.mjs',
        'format-makietka.md': KORZEN / 'ai' / 'format-makietka.md',
        'icon.png': KORZEN / 'img' / 'ikony' / 'ikona-512.png',
    }
    # Dodatkowe moduły serwera (np. wspólne narzędzia) – wszystko z ai/mcp obok pliku głównego.
    for p in sorted((KORZEN / 'ai' / 'mcp').glob('*.mjs')):
        pliki.setdefault(f'server/{p.name}', p)
    with zipfile.ZipFile(cel, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json', json.dumps(manifest(wersja), ensure_ascii=False, indent=2))
        for nazwa, zrodlo in pliki.items():
            z.write(zrodlo, nazwa)
    print(f'{cel}: rozszerzenie Makietka {wersja}, {len(pliki) + 1} plików')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
