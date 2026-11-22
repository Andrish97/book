// Atrapa kopii awaryjnych i cofania zmian AI (supabase/migrations/20261116190000_kopie_awaryjne.sql,
// 20261122160000_cofnij_zmiany_ai.sql) – te same zasady w JS: każdy zapis zostawia stan sprzed zapisu z „kto”;
// seria AI = ostatnie zapisy AI z przerwami do 15 minut; cofnięcie wraca do stanu sprzed najstarszego zapisu serii.
// W bazie kopie stron są osobne; tu kopia trzyma wszystkie strony projektu naraz – efekt cofnięcia jest ten sam.

const kopia = (x) => JSON.parse(JSON.stringify(x));
const PRZERWA = 15 * 60 * 1000;

function atrapaKopii(stan) {
  stan.kopie = stan.kopie || [];
  let licznik = stan.kopie.length;

  // Stan projektu sprzed zapisu; kto: 'AI' albo 'urządzenie'.
  function zapamietaj(p, kto) {
    if (!p?.dane) return;
    const strony = {};
    for (const [k, v] of stan.strony) if (k.startsWith(`${p.id}/`)) strony[k.slice(p.id.length + 1)] = kopia(v);
    licznik += 1;
    stan.kopie.push({ id: licznik, projekt_id: p.id, kto, utworzono: Date.now(), nazwa: p.nazwa, dane: kopia(p.dane), strony });
  }

  function seria(projekt) {
    const ai = stan.kopie.filter((k) => k.projekt_id === projekt && k.kto === 'AI').sort((a, b) => b.id - a.id);
    if (!ai.length) return null;
    let najstarsza = ai[0];
    let ile = 1;
    for (const k of ai.slice(1)) {
      if (najstarsza.utworzono - k.utworzono > PRZERWA) break;
      najstarsza = k;
      ile += 1;
    }
    return {
      od: new Date(najstarsza.utworzono).toISOString(), do: new Date(ai[0].utworzono).toISOString(), zapisow: ile,
      pozniej: stan.kopie.filter((k) => k.projekt_id === projekt && k.id > ai[0].id && k.kto === 'urządzenie').length,
      kopia: najstarsza.id,
    };
  }

  function cofnij(projekt) {
    const s = seria(projekt);
    if (!s) return { blad: 'W ostatnich 14 dniach AI nie zmieniało tego projektu – nie ma czego cofnąć.' };
    const k = stan.kopie.find((x) => x.id === s.kopia);
    const p = stan.projekty.find((x) => x.id === projekt);
    for (const klucz of [...stan.strony.keys()]) if (klucz.startsWith(`${projekt}/`)) stan.strony.delete(klucz);
    for (const [id, dane] of Object.entries(k.strony)) stan.strony.set(`${projekt}/${id}`, kopia(dane));
    const teraz = new Date().toISOString();
    Object.assign(p, { dane: kopia(k.dane), nazwa: k.nazwa, zmieniono: teraz, wersja: p.wersja + 1 });
    for (const x of stan.kopie) if (x.projekt_id === projekt && x.kto === 'AI' && x.id >= k.id) x.kto = 'AI (cofnięte)';
    stan.oglos?.(p);
    return { ok: true, od: s.od, do: s.do, zapisow: s.zapisow, pozniej: s.pozniej, strony: Object.keys(k.strony).length, wersja: p.wersja };
  }

  const bezKopii = (s) => { if (!s) return null; const { kopia: _, ...reszta } = s; return reszta; };
  return { zapamietaj, seria, cofnij, bezKopii };
}

module.exports = { atrapaKopii };
