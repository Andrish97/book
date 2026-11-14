// Połączenie z Supabase (sekcja 9 planu).
// Wpisz tu adres projektu i klucz "publishable" (lub starszy "anon public") z: Supabase → Project Settings → API.
// Klucz anon jest publiczny z założenia – dostęp do danych chronią reguły RLS
// z migracji w supabase/migrations/. Nigdy nie wpisuj tu klucza service_role.
// Gdy pola są puste, aplikacja działa tylko lokalnie (IndexedDB + pliki JSON).

import { ADRES_API } from './marka.js';

// Adres bazy: przekaźnik api.makietka.app albo wprost Supabase – przełącznik PRZEZ_WORKER w js/marka.js.
export const SUPABASE_URL = ADRES_API;
export const SUPABASE_ANON_KEY = 'sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq';
