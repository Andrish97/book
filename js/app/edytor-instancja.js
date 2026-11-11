// Tworzy edytor (płótno strony). Ten moduł jest pierwszym importem js/app/edytor-start.js, więc edytor
// istnieje, zanim wykonają się moduły, które korzystają z niego od razu przy wczytaniu (panel, linijki…).
// Biblioteka płótna (Fabric) musi być już wczytana – dba o to js/app/doczytaj.js.

import { Edytor } from '../edytor.js';
import { $ } from '../ui.js';
import { ustawEdytor } from './kontekst.js';

ustawEdytor(new Edytor($('#plotno'), $('#kontener-plotna')));
