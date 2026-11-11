// Okno „Dostęp dla AI”: klucz, którym asystent AI czyta i zmienia ten jeden projekt (ai/api.md).
// Główna droga to adres zdalnego łącznika MCP (Funkcja Edge supabase/functions/mcp) z kluczem w adresie –
// Claude i ChatGPT łączą się z nim ze swoich serwerów, więc AI nie potrzebuje dostępu do bazy z własnej
// piaskownicy. Klucz pokazuje się raz – w bazie zostaje tylko jego skrót. Zmiany AI przychodzą do edytora tak jak
// zmiany z drugiego urządzenia (zapis na żywo i łączenie element po elemencie).

import * as chmura from '../chmura.js';
import { $, powiadom, kiedy, potwierdz } from '../ui.js';
import { SUPABASE_URL } from '../konfiguracja.js';
import { stan } from './kontekst.js';
import { zapiszTeraz, synchronizuj } from './zapis.js';

const ROLE = { edycja: 'czyta i zmienia', odczyt: 'tylko czyta' };

// Adres zdalnego łącznika MCP z kluczem (do dodania jako własny łącznik w Claude / serwer MCP w ChatGPT).
export const adresLacznika = (klucz) => `${SUPABASE_URL}/functions/v1/mcp/${klucz}`;

function instrukcje(klucz) {
  const konfiguracja = {
    mcpServers: {
      seriodruk: {
        command: 'node',
        args: ['/ścieżka/do/seriodruk-mcp.mjs'],
        env: { SERIODRUK_KLUCZ: klucz },
      },
    },
  };
  $('#dostep-ai-claude-desktop').textContent = JSON.stringify(konfiguracja, null, 2);
  $('#dostep-ai-claude-code').textContent = `claude mcp add --transport http seriodruk ${adresLacznika(klucz)}`;
}

async function odswiezListe() {
  const ul = $('#dostep-ai-lista');
  let lista = [];
  try {
    lista = await chmura.dostepyAi(stan.projekt.id);
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  }
  const aktywne = lista.filter((d) => d.aktywny);
  ul.replaceChildren(...aktywne.map((d) => {
    const li = document.createElement('li');
    const opis = document.createElement('div');
    const tytul = document.createElement('strong');
    tytul.textContent = d.opis || 'Klucz bez opisu';
    const szczegoly = document.createElement('span');
    szczegoly.className = 'ciche';
    szczegoly.textContent = `${ROLE[d.rola] || d.rola} · ważny do ${new Date(d.wazny_do).toLocaleDateString('pl-PL')} · ${d.ostatnie_uzycie ? `ostatnio użyty ${kiedy(d.ostatnie_uzycie)}` : 'jeszcze nieużyty'}`;
    opis.append(tytul, szczegoly);
    const odbierz = document.createElement('button');
    odbierz.type = 'button';
    odbierz.className = 'przycisk niebezpieczny';
    odbierz.textContent = 'Odbierz';
    odbierz.addEventListener('click', async () => {
      if (!await potwierdz('Odebrać dostęp?', `Klucz „${d.opis || 'bez opisu'}” przestanie działać od razu.`, 'Odbierz', true)) return;
      try {
        await chmura.odwolajDostepAi(d.id);
        powiadom('Dostęp odebrany.');
      } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
      odswiezListe();
    });
    li.append(opis, odbierz);
    return li;
  }));
  $('#dostep-ai-pusto').hidden = aktywne.length > 0;
}

export async function otworzDostepAi() {
  if (!stan.projekt) return;
  if (!stan.uzytkownik) { powiadom('Dostęp dla AI wymaga zalogowania.', true); return; }
  $('#dostep-ai-gotowy').hidden = true;
  $('#dostep-ai-klucz').value = '';
  $('#dostep-ai-adres').value = '';
  $('#dostep-ai-opis').value = '';
  $('#dlg-dostep-ai').showModal();
  odswiezListe();
}

export async function utworzKluczAi() {
  const przycisk = $('[data-akcja="dostep-ai-utworz"]');
  przycisk.disabled = true;
  try {
    // Klucz prowadzi do projektu na koncie – najpierw zapis, żeby projekt tam był i był aktualny.
    await zapiszTeraz();
    await synchronizuj();
    const wynik = await chmura.utworzDostepAi(stan.projekt.id, {
      opis: $('#dostep-ai-opis').value.trim(),
      rola: $('#dostep-ai-rola').value,
      dni: Number($('#dostep-ai-dni').value) || 7,
    });
    $('#dostep-ai-klucz').value = wynik.klucz;
    $('#dostep-ai-adres').value = adresLacznika(wynik.klucz);
    instrukcje(wynik.klucz);
    $('#dostep-ai-gotowy').hidden = false;
    $('#dostep-ai-adres').select();
    odswiezListe();
  } catch (e) {
    powiadom(chmura.komunikatBledu(e), true);
  } finally {
    przycisk.disabled = false;
  }
}

async function kopiuj(pole, co) {
  try {
    await navigator.clipboard.writeText(pole.value);
    powiadom(`${co[0].toUpperCase()}${co.slice(1)} skopiowany.`);
  } catch {
    pole.select();
    powiadom(`Zaznaczyłem ${co} – skopiuj go skrótem Ctrl+C.`);
  }
}

export const kopiujKluczAi = () => kopiuj($('#dostep-ai-klucz'), 'klucz');
export const kopiujAdresAi = () => kopiuj($('#dostep-ai-adres'), 'adres');

export function zamknijDostepAi() {
  // Klucz (także w adresie i poleceniach) nie zostaje w oknie po zamknięciu.
  for (const id of ['#dostep-ai-klucz', '#dostep-ai-adres']) $(id).value = '';
  for (const id of ['#dostep-ai-claude-code', '#dostep-ai-claude-desktop']) $(id).textContent = '';
  $('#dlg-dostep-ai').close();
}
