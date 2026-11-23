// Cofnięcie zmian AI (plan H3, migracja 20261122160000_cofnij_zmiany_ai.sql): projekt wraca do stanu sprzed
// ostatniej serii zmian zrobionych przez AI (łącznik albo czat w Makietce). Zmiany zrobione później (także własne)
// też się cofają – okno o tym mówi. Po cofnięciu wersja z konta zastępuje tę na urządzeniu.

import * as chmura from '../chmura.js';
import { powiadom, potwierdz } from '../ui.js';
import { stan } from './kontekst.js';
import { zapiszTeraz, synchronizuj, zastapWersjaZKonta } from './zapis.js';
import { t, jezykDat } from '../jezyk.js';

const godzina = (d) => new Date(d).toLocaleString(jezykDat(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function oknoCofnijZmianyAi() {
  const p = stan.projekt;
  if (!p) return;
  if (!stan.uzytkownik) { powiadom(t('cofnijAi.zaloguj'), true); return; }
  await zapiszTeraz();
  await synchronizuj({ wymus: false }).catch(() => {});
  const sb = await chmura.supabase();
  const { data: seria, error } = await sb.rpc('zmiany_ai_projektu', { p_projekt: p.id });
  if (error) { powiadom(chmura.komunikatBledu(error), true); return; }
  if (!seria) { powiadom(t('cofnijAi.brak')); return; }
  const tresc = t('cofnijAi.pytanie', { od: godzina(seria.od), do: godzina(seria.do), zapisow: seria.zapisow })
    + (seria.pozniej ? `\n\n${t('cofnijAi.pozniej', { ile: seria.pozniej })}` : '');
  if (!await potwierdz(t('cofnijAi.tytul'), tresc, t('cofnijAi.cofnij'), Boolean(seria.pozniej), t('cofnijAi.anuluj'))) return;
  const { data: w, error: e2 } = await sb.rpc('cofnij_zmiany_ai', { p_projekt: p.id });
  if (e2 || w?.blad) { powiadom(w?.blad || chmura.komunikatBledu(e2), true); return; }
  await zastapWersjaZKonta(p, t('cofnijAi.gotowe', { od: godzina(seria.od) }));
}
