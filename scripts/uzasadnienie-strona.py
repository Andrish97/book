#!/usr/bin/env python3
"""Buduje stronę „Uzasadnienie Makietki” z pliku docs/UZASADNIENIE.md.

Plik Markdown jest jedynym źródłem treści: strona powstaje z niego w całości, więc nie da się,
żeby mówiły co innego. Wygląd strony leży w docs/uzasadnienie-szablon.html, a przypisanie zrzutów
ekranu do wpisów – w docs/uzasadnienie-zrzuty.json (kod wpisu → pliki z img/instrukcja/).

Użycie:  python3 scripts/uzasadnienie-strona.py <plik wynikowy .html>
Na wyjściu wypisuje listę użytych zrzutów (ścieżka na stronie → plik w repozytorium).

Układ pliku Markdown, na którym skrypt polega:
  ## W skrócie            trzy listy: **Mocne.**, **Słabe.**, **Czego nie ma.**
  ## X. Tytuł działu      opcjonalny akapit opisu, potem wpisy
  ### KOD. Tytuł OCENA    ocena: ✅ | ✅ / ⚠️ | ⚠️ | ❌
  **Etykieta.** akapit    Co jest, Jak to działa, Dlaczego tak, Twoje decyzje, Sprawdzone, Słabe
  - punkt                 lista pod akapitem należy do niego
  ## H. Co proponuję dalej  lista numerowana i akapity
"""
import html
import json
import re
import sys
from pathlib import Path

KORZEN = Path(__file__).resolve().parent.parent
OCENY = {'✅': ('ok', 'Dobrze'), '✅ / ⚠️': ('czesc', 'Z zastrzeżeniami'), '⚠️': ('czesc', 'Z zastrzeżeniami'), '❌': ('brak', 'Brak')}
ETYKIETY = {'Słabe': 'Słabe strony'}


def w_linii(tekst):
    """Markdown w obrębie akapitu → HTML: kod, pogrubienie, kursywa, odsyłacze."""
    kody = []

    def schowaj(m):
        kody.append(m.group(1))
        return f'\x00{len(kody) - 1}\x00'

    t = re.sub(r'`([^`]+)`', schowaj, tekst)
    t = html.escape(t, quote=False)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: m.group(1) if not m.group(2).startswith('http') else f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![*\w])\*([^*\s][^*]*)\*(?![*\w])', r'<em>\1</em>', t)
    return re.sub(r'\x00(\d+)\x00', lambda m: f'<code>{html.escape(kody[int(m.group(1))], quote=False)}</code>', t)


def lista(linie):
    """Linie '- …' (z wcięciem dla punktów zagnieżdżonych) → <ul>."""
    wynik, glebiej = ['<ul>'], False
    for l in linie:
        zagniezdzony = l.startswith('  ')
        tresc = w_linii(l.strip()[2:])
        if zagniezdzony and not glebiej:
            wynik[-1] = wynik[-1][:-len('</li>')] + '<ul>'
            glebiej = True
        elif not zagniezdzony and glebiej:
            wynik.append('</ul></li>')
            glebiej = False
        wynik.append(f'<li>{tresc}</li>')
    if glebiej:
        wynik.append('</ul></li>')
    wynik.append('</ul>')
    return ''.join(wynik)


def bloki(linie):
    """Dzieli linie na akapity i listy: [('akapit', tekst) | ('lista', [linie]) | ('numery', [linie])]."""
    wynik, akapit = [], []

    def zamknij():
        if akapit:
            wynik.append(('akapit', ' '.join(akapit)))
            akapit.clear()

    for l in linie:
        if l.strip().startswith('<!--') or l.strip() == '---':
            continue
        if not l.strip():
            zamknij()
        elif re.match(r'\s*- ', l):
            zamknij()
            if wynik and wynik[-1][0] == 'lista':
                wynik[-1][1].append(l)
            else:
                wynik.append(('lista', [l]))
        elif re.match(r'\d+\. ', l):
            zamknij()
            if wynik and wynik[-1][0] == 'numery':
                wynik[-1][1].append(l)
            else:
                wynik.append(('numery', [l]))
        else:
            akapit.append(l.strip())
    zamknij()
    return wynik


def wpis_html(kod, tytul, ocena, linie, zrzuty, uzyte):
    stan, napis = OCENY[ocena]
    czesci = []
    for rodzaj, tresc in bloki(linie):
        if rodzaj == 'akapit':
            m = re.match(r'\*\*([^*]+?)\.\*\*\s*(.*)', tresc)
            if m:
                czesci.append([m.group(1), w_linii(m.group(2))])
            elif czesci:
                czesci[-1][1] += f'<br><br>{w_linii(tresc)}'
            else:
                czesci.append(['Co jest', w_linii(tresc)])
        elif rodzaj == 'lista' and czesci:
            czesci[-1][1] += lista(tresc)
    if not czesci:
        raise SystemExit(f'Wpis {kod} nie ma treści.')
    wiersze = []
    for etykieta, tresc in czesci:
        klasa = ' class="slabe"' if etykieta == 'Słabe' else ''
        wiersze.append(f'          <div{klasa}><dt>{ETYKIETY.get(etykieta, etykieta)}</dt><dd>{tresc}</dd></div>')
    figury = []
    for z in zrzuty.get(kod, []):
        uzyte[f'zrzuty/{z["plik"]}'] = f'img/instrukcja/{z["plik"]}'
        styl = ' style="max-width: 20rem"' if z.get('waski') else ''
        figury.append(f'        <figure{styl}><button type="button" data-lupa><img src="zrzuty/{z["plik"]}" alt="{html.escape(z["opis"])}"></button><figcaption>{z["podpis"]}</figcaption></figure>')
    ident = 'w-' + re.sub(r'[^a-z0-9]', '-', kod.lower())
    return '\n'.join([
        f'      <article class="wpis" id="{ident}" data-stan="{stan}">',
        f'        <header><span class="kod">{kod}</span><h3>{w_linii(tytul)}</h3><span class="stan {stan}">{napis}</span></header>',
        '        <dl class="czesci">', *wiersze, '        </dl>', *figury, '      </article>',
    ])


def buduj(md):
    zrzuty = json.loads((KORZEN / 'docs' / 'uzasadnienie-zrzuty.json').read_text(encoding='utf8'))
    uzyte = {}
    linie = md.split('\n')
    # Działy: od nagłówka '## ' do następnego.
    dzialy, biezacy = [], None
    wstep = []
    for l in linie[1:]:
        if l.startswith('## '):
            biezacy = [l[3:].strip(), []]
            dzialy.append(biezacy)
        elif biezacy:
            biezacy[1].append(l)
        else:
            wstep.append(l)
    akapity = [t for r, t in bloki(wstep) if r == 'akapit']
    stan = re.search(r'Stan na ([^(.]+)', akapity[0]) if akapity else None
    spis, tresc = ['        <li><a href="#skrot"><span class="lit">·</span>W skrócie</a></li>'], []
    for tytul, cialo in dzialy:
        if tytul == 'W skrócie':
            kolumny, nazwa = [], None
            for rodzaj, t in bloki(cialo):
                if rodzaj == 'akapit':
                    nazwa = re.sub(r'[*.]', '', t).strip()
                elif rodzaj == 'lista' and nazwa:
                    klasa = {'Mocne': 'ok', 'Słabe': 'czesc', 'Czego nie ma': 'brak'}.get(nazwa, 'czesc')
                    naglowek = {'Mocne': 'Co jest mocne', 'Słabe': 'Co jest słabe'}.get(nazwa, nazwa)
                    kolumny.append(f'      <div>\n        <h2><span class="stan {klasa}">{naglowek}</span></h2>\n        {lista(t)}\n      </div>')
            tresc.append('    <section class="skrot" id="skrot" aria-label="W skrócie">\n' + '\n'.join(kolumny) + '\n    </section>')
            continue
        m = re.match(r'(\w+)\.\s+(.*)', tytul)
        litera, nazwa = m.group(1), m.group(2)
        ident = f'dzial-{litera.lower()}'
        spis.append(f'        <li><a href="#{ident}"><span class="lit">{litera}</span>{html.escape(nazwa)}</a></li>')
        naglowek = f'      <header><span class="lit">{litera}</span><h2 class="tytul-dzialu">{html.escape(nazwa)}</h2></header>'
        if not any(l.startswith('### ') for l in cialo):
            # Dział bez wpisów (plan na dalej): lista numerowana i akapity.
            czesci = []
            for rodzaj, t in bloki(cialo):
                if rodzaj == 'numery':
                    punkty = ''.join(f'\n        <li><span>{w_linii(re.sub(r"^\d+\. ", "", p))}</span></li>' for p in t)
                    czesci.append(f'      <ol>{punkty}\n      </ol>')
                elif rodzaj == 'akapit':
                    czesci.append(f'      <p class="stopka">{w_linii(t)}</p>')
                elif rodzaj == 'lista':
                    czesci.append(f'      {lista(t)}')
            tresc.append(f'    <section class="dzial dalej" id="{ident}">\n{naglowek}\n' + '\n'.join(czesci) + '\n    </section>')
            continue
        opis, wpisy, biezacy_wpis = [], [], None
        for l in cialo:
            if l.startswith('### '):
                n = re.match(r'### (\S+?)\.\s+(.*?)\s*((?:✅ / ⚠️|✅|⚠️|❌))?\s*$', l)
                if not n or not n.group(3):
                    raise SystemExit(f'Nagłówek wpisu bez kodu albo oceny: {l}')
                biezacy_wpis = [n.group(1), n.group(2), n.group(3), []]
                wpisy.append(biezacy_wpis)
            elif biezacy_wpis:
                biezacy_wpis[3].append(l)
            else:
                opis.append(l)
        opis_html = ''.join(f'\n      <p class="opis">{w_linii(t)}</p>' for r, t in bloki(opis) if r == 'akapit')
        artykuly = '\n\n'.join(wpis_html(k, t, o, c, zrzuty, uzyte) for k, t, o, c in wpisy)
        tresc.append(f'    <section class="dzial" id="{ident}">\n{naglowek}{opis_html}\n\n{artykuly}\n    </section>')
    szablon = (KORZEN / 'docs' / 'uzasadnienie-szablon.html').read_text(encoding='utf8')
    strona = (szablon
              .replace('{{STAN}}', f'Uzasadnienie, stan na {html.escape(stan.group(1).strip())}' if stan else 'Uzasadnienie')
              .replace('{{WSTEP}}', ' '.join(w_linii(a) for a in akapity if not a.startswith('Ocena:')))
              .replace('{{SPIS}}', '\n'.join(spis))
              .replace('{{TRESC}}', '\n\n'.join(tresc)))
    return strona, uzyte


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    strona, uzyte = buduj((KORZEN / 'docs' / 'UZASADNIENIE.md').read_text(encoding='utf8'))
    Path(sys.argv[1]).write_text(strona, encoding='utf8')
    brak = [z for z in uzyte.values() if not (KORZEN / z).exists()]
    if brak:
        raise SystemExit(f'Brak plików zrzutów: {brak}')
    print(json.dumps(uzyte, ensure_ascii=False))
