// Lista dozwolonych czcionek (sekcja 11 planu): tylko licencje pozwalające
// na użycie komercyjne i osadzanie w PDF. Wszystkie poniższe są na licencji
// SIL Open Font License 1.1 i mają polskie znaki (latin-ext).
// Przed dodaniem nowej czcionki sprawdź jej licencję na fonts.google.com.

export const CZCIONKI = [
  { nazwa: 'Inter', licencja: 'OFL 1.1', rodzaj: 'bezszeryfowa' },
  { nazwa: 'Open Sans', licencja: 'OFL 1.1', rodzaj: 'bezszeryfowa' },
  { nazwa: 'Montserrat', licencja: 'OFL 1.1', rodzaj: 'bezszeryfowa' },
  { nazwa: 'Lora', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Merriweather', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Playfair Display', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Source Serif 4', licencja: 'OFL 1.1', rodzaj: 'szeryfowa' },
  { nazwa: 'Caveat', licencja: 'OFL 1.1', rodzaj: 'odręczna' },
];

export const DOMYSLNA = 'Inter';

// Czeka, aż przeglądarka pobierze wszystkie warianty używane na płótnie.
// Bez tego Fabric zmierzyłby tekst czcionką zastępczą.
export async function zaladujCzcionki() {
  if (!document.fonts) return;
  const warianty = [];
  for (const c of CZCIONKI) {
    for (const styl of ['', 'italic ']) {
      for (const waga of ['400', '700']) {
        warianty.push(document.fonts.load(`${styl}${waga} 16px "${c.nazwa}"`, 'AaĄąŻż'));
      }
    }
  }
  await Promise.allSettled(warianty);
}
