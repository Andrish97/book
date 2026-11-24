// Kształty, które mogą być ramką obrazu (#123) – bez Fabric (#418: używa tego też kontrola przed drukiem).
export const TYPY = new Set(['rect', 'ellipse', 'circle', 'polygon', 'triangle', 'path']);

// Czy kształt może być ramką obrazu: zamknięty kształt (ścieżka z pióra tylko zamknięta).
export function moznaWstawicObraz(o) {
  if (!o || !TYPY.has(o.type) || o.tabela) return false;
  if (o.type === 'path') return (o.path || []).some((k) => k[0] === 'Z' || k[0] === 'z');
  return true;
}
