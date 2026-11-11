#!/usr/bin/env python3
"""Statyczne importy modułów aplikacji: które pliki wczytają się razem z podanymi.

Użycie:  python3 scripts/graf-modulow.py js/aplikacja.js [kolejne…]
Wypisuje liczbę plików i ich łączny rozmiar oraz listę – pomaga pilnować, żeby ekran startowy
nie ciągnął za sobą edytora (dynamiczne import() nie są liczone, bo wczytują się dopiero na żądanie).
"""
import os
import re
import sys


def importy(plik):
    tekst = open(plik, encoding='utf8').read()
    wzor = r"^(?:import|export)\s+(?:[^'\";]*?from\s+)?['\"](\.[^'\"]+)['\"]"
    return [os.path.normpath(os.path.join(os.path.dirname(plik), m.group(1))) for m in re.finditer(wzor, tekst, re.M | re.S)]


def domkniecie(poczatek):
    widziane, stos = set(), list(poczatek)
    while stos:
        p = stos.pop()
        if p in widziane:
            continue
        widziane.add(p)
        stos.extend(importy(p))
    return widziane


if __name__ == '__main__':
    pliki = domkniecie(sys.argv[1:])
    print(f'{len(pliki)} plików, {sum(os.path.getsize(p) for p in pliki) // 1024} kB')
    for p in sorted(pliki, key=os.path.getsize, reverse=True):
        print(f'  {os.path.getsize(p) // 1024:4d} kB  {p}')
