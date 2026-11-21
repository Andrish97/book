// Opcje eksportu PDF ze zlecenia AI (narzędzie eksport_pdf łącznika) – wspólne dla aplikacji (js/app/eksport-ai.js)
// i eksportu na serwerze (rysuj.html, #337).

// Ustawienia ze zlecenia (narzędzie eksport_pdf w łączniku) → opcje eksportu jak z okna „Eksport do PDF”.
export function opcjePdf(projekt, u = {}) {
  const tryb = u.rodzaj === 'obraz' ? 'obraz' : 'wektor';
  const ekran = u.przeznaczenie === 'ekran';
  const uklad = ['broszura', 'skladki', 'dwie', 'cztery'].includes(u.uklad) ? u.uklad : 'zwykly';
  const pdfx = ['fogra39', 'fogra47'].includes(u.pdfx) ? u.pdfx : '';
  const znajdz = (x) => { const sz = String(x ?? '').trim().toLowerCase(); return sz ? projekt.sekcje.find((s) => s.id === x || String(s.nazwa || '').trim().toLowerCase() === sz) : null; };
  const sekcja = znajdz(u.sekcja);
  if (u.zakres === 'sekcja' && !sekcja) throw new Error(`Projekt nie ma sekcji „${u.sekcja ?? ''}”.`);
  // #312: kilka sekcji naraz (lista id albo nazw) i strony jak w Wordzie („1-5, 8, 11-”).
  const sekcje = (Array.isArray(u.sekcje) ? u.sekcje : []).map((x) => { const s = znajdz(x); if (!s) throw new Error(`Projekt nie ma sekcji „${x}”.`); return s.id; });
  if (u.zakres === 'sekcje' && !sekcje.length) throw new Error('Podaj sekcje (lista id albo nazw).');
  return {
    zakres: ['sekcja', 'sekcje', 'strony'].includes(u.zakres) ? u.zakres : 'wszystko',
    sekcja: sekcja?.id,
    sekcje,
    strony: typeof u.strony === 'string' ? u.strony : undefined,
    od: Number(u.od) || 1,
    do: Number(u.do) || Infinity,
    tryb,
    krzywe: false,
    cmyk: tryb === 'wektor' && Boolean(u.cmyk),
    pdfx,
    profilWlasny: null,
    zdjeciaCmyk: false,
    dpi: [150, 300, 600].includes(Number(u.dpi)) ? Number(u.dpi) : 300,
    spad: !ekran,
    znaki: ekran ? false : 'sekcje',
    podzial: 'jeden',
    ileStron: 50,
    dolaczCzcionki: false,
    uszlachetnienia: 'plyty',
    uklad,
    formatArkusza: ['A4', 'A3'].includes(u.formatArkusza) ? u.formatArkusza : 'auto',
    skladka: [4, 8, 16, 32].includes(Number(u.skladka)) ? Number(u.skladka) : 16,
    pelzanie: 0,
    nawigacja: ekran && !pdfx && uklad === 'zwykly',
  };
}
