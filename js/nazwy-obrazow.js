// Jak nazwa z tabeli danych wskazuje obraz projektu. Jedna reguła dla składania stron (js/zlozenie.js),
// sprawdzania przed drukiem (js/kontrola.js) i okna „Obrazy projektu” (js/obrazy-projektu.js).
//
//  – pełna nazwa z rozszerzeniem (bez względu na wielkość liter): „las.jpg” i „las.png” to dwa różne obrazy;
//  – nazwa bez rozszerzenia („las”) trafia w obraz tylko wtedy, gdy pasuje dokładnie jeden plik; przy kilku
//    („las.jpg” i „las.png”) jest niejednoznaczna – strona pokazuje znak braku obrazu, a kontrola przed
//    drukiem prosi o dopisanie rozszerzenia.
// Ta sama reguła jest w rdzeniu łącznika AI (supabase/functions/_shared/seriodruk-mcp-rdzen.mjs).

export const pelnaNazwa = (n) => String(n ?? '').trim().toLowerCase();
export const bezRozszerzenia = (n) => pelnaNazwa(n).replace(/\.[a-z0-9]{2,5}$/, '');

// Zwraca { id } (jeden pasujący obraz), { niejednoznaczne: [id] } albo null (nic nie pasuje).
// pomin: zbiór identyfikatorów, które nie są obrazami (czcionki).
export function obrazZNazwy(zasoby, wartosc, pomin = null) {
  const szukana = pelnaNazwa(wartosc);
  if (!szukana) return null;
  const wpisy = Object.entries(zasoby || {}).filter(([id, z]) => z && !pomin?.has(id));
  const dokladne = wpisy.filter(([, z]) => pelnaNazwa(z.nazwa) === szukana);
  if (dokladne.length) return { id: dokladne[0][0] };
  const rdzen = wpisy.filter(([, z]) => bezRozszerzenia(z.nazwa) === szukana);
  if (rdzen.length === 1) return { id: rdzen[0][0] };
  if (rdzen.length > 1) return { niejednoznaczne: rdzen.map(([id]) => id) };
  return null;
}
