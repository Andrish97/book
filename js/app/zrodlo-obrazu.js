// Skąd wziąć obraz: z urządzenia albo z obrazów projektu. Pytanie zadaje narzędzie „Obraz” na pasku
// wstawiania i przycisk „Podmień zdjęcie” we właściwościach. Gdy w projekcie nie ma obrazów do wyboru,
// od razu otwiera się wybór pliku.
//
// Wybór pliku z urządzenia musi zacząć się w tym samym kliknięciu (przeglądarki otwierają okno pliku
// tylko w odpowiedzi na działanie użytkownika), dlatego przyciski wołają funkcje od razu, bez czekania.

import { $ } from '../ui.js';
import { stan } from './kontekst.js';
import { obrazyProjektu } from '../obrazy-projektu.js';

const dlg = $('#dlg-zrodlo-obrazu');
let biezace = null;

// tytul: nagłówek okna; zUrzadzenia(): otwiera wybór pliku; zProjektu(): otwiera okno obrazów w trybie wyboru;
// pomin: id obrazu, którego nie liczymy jako „do wyboru” (np. ten, który właśnie podmieniamy).
export function wybierzZrodloObrazu({ tytul, zUrzadzenia, zProjektu, pomin = null }) {
  const inne = obrazyProjektu(stan.projekt).filter(([id]) => id !== pomin);
  if (!inne.length) { zUrzadzenia(); return; }
  biezace = { zUrzadzenia, zProjektu };
  $('#zrodlo-obrazu-tytul').textContent = tytul;
  dlg.returnValue = '';
  dlg.showModal();
}

$('#zrodlo-urzadzenie').addEventListener('click', () => { const b = biezace; biezace = null; dlg.close(); b?.zUrzadzenia(); });
$('#zrodlo-projekt').addEventListener('click', () => { const b = biezace; biezace = null; dlg.close(); b?.zProjektu(); });
dlg.addEventListener('close', () => { biezace = null; });
