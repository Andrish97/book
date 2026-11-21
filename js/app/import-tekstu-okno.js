// Wstaw tekst z pliku (#216): Word (.docx), LibreOffice (.odt), Markdown i zwykły tekst → jedna ramka na bieżącej
// stronie, w marginesach, z „Dokładaj strony” – tekst sam rozkłada się na tyle stron, ile trzeba. Nagłówki
// zostają nagłówkami (większe, pogrubione), rozdziały (nagłówek 1) – od nowej strony; pogrubienia, kursywy
// i podkreślenia fragmentów zostają.

import { $, powiadom } from '../ui.js';
import { biblioteka } from '../biblioteki.js';
import { czytajPlikTekstu, tekstDoRamki } from '../import-tekstu.js';
import { ptNaMm } from '../projekt.js';
import { stan, edytor } from './kontekst.js';
import { dokladajStrony } from './lista-stron.js';
import { t } from '../jezyk.js';

const JSZIP_URL = 'js/zewnetrzne/jszip-3.10.1.min.js';

export async function wstawTekstZPliku(plik) {
  if (!plik || !stan.projekt || stan.tryb !== 'strona') { powiadom(t('importTekstuOkno.tekstZPlikuWstawisz'), true); return null; }
  try {
    const JSZip = await biblioteka(JSZIP_URL, 'JSZip', 'modułu ZIP');
    const wynik = await czytajPlikTekstu(plik, JSZip);
    const { text, styles, akapitow, rozdzialow } = tekstDoRamki(wynik, { rozmiar: ptNaMm(11) });
    if (!text.trim()) { powiadom(t('importTekstuOkno.wPlikuNieMa'), true); return null; }
    const ramka = edytor.dodajDlugiTekst(text, styles, { rozmiarPt: 11 });
    edytor.zatwierdz?.();
    const pom = wynik.pominiete;
    const pominiete = [pom.obrazy && t('importTekstuOkno.tekst', { obrazy: pom.obrazy }), pom.przypisy && t('importTekstuOkno.tekst2', { przypisy: pom.przypisy })].filter(Boolean);
    powiadom(t('importTekstuOkno.wstawionoStronyDochodzaSame', { akapitow, x: rozdzialow ? t('importTekstuOkno.odNowejStrony', { rozdzialow }) : '', x2: pominiete.length ? t('importTekstuOkno.bezWstawJeOsobno', { join: pominiete.join(', ') }) : '' }));
    setTimeout(() => dokladajStrony(), 50);
    return ramka;
  } catch (e) {
    powiadom(t('importTekstuOkno.nieUdaloSieWczytac', { message: e.message }), true);
    return null;
  }
}

$('#plik-tekst')?.addEventListener('change', async (e) => {
  const [plik] = e.target.files;
  e.target.value = '';
  if (plik) await wstawTekstZPliku(plik);
});
