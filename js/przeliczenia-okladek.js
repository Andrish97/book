// Rejestr dodatkowych przeliczeń wykonywanych po przeliczeniu okładek (np. sekcje specjalne, #177).
// Osobny moduł bez importów: okladka.js i sekcje-specjalne.js importują się pośrednio nawzajem
// (okladka → serie → projekt → sekcje-specjalne → okladka), więc rejestr w okladka.js bywał jeszcze
// niezainicjowany, gdy sekcje-specjalne.js się do niego dopisywał („Cannot access before initialization”).
export const poPrzeliczeniu = new Set();
