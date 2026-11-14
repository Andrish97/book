// PDF/X-4: plik PDF przygotowany dla drukarni według normy ISO 15930-7.
//
// Zwykły PDF mówi „ten prostokąt jest czerwony”, ale nie mówi, na jakim papierze i jaką maszyną ma być
// wydrukowany. PDF/X-4 dopisuje do pliku warunki druku (profil barwny CMYK), opisuje kolory RGB profilem
// sRGB i niesie metadane, po których programy drukarni rozpoznają standard. Tu powstają te dodatki:
//  – OutputIntent z osadzonym profilem CMYK (warunki druku),
//  – DefaultRGB = sRGB na każdej stronie (żaden kolor RGB nie jest „nieokreślony”),
//  – metadane XMP z oznaczeniem PDF/X-4, klucz Trapped, identyfikator dokumentu, wersja PDF 1.6.

import { czytajProfil, SilnikCmyk, profilSrgb, WARUNKI_DRUKU } from './profil-icc.js';

// Warunki druku do eksportu: wbudowane (klucz z WARUNKI_DRUKU) albo własny profil drukarni ({ nazwa, bajty }).
// Zwraca { profil, identyfikator, opis, zRejestru, silnik() }.
export async function wczytajWarunki(pdfx, profilWlasny = null) {
  let bajty; let identyfikator; let opis; let zRejestru = false;
  if (pdfx === 'wlasny') {
    if (!profilWlasny?.bajty) throw new Error('Wybierz plik profilu drukarni (.icc).');
    bajty = profilWlasny.bajty;
  } else {
    const w = WARUNKI_DRUKU[pdfx];
    if (!w) throw new Error('Nieznane warunki druku.');
    const odp = await fetch(w.plik);
    if (!odp.ok) throw new Error('Nie udało się wczytać profilu barwnego. Sprawdź połączenie i spróbuj ponownie.');
    bajty = new Uint8Array(await odp.arrayBuffer());
    ({ identyfikator, opis } = w); zRejestru = true;
  }
  let profil;
  try { profil = czytajProfil(bajty); } catch (e) { throw new Error(`Tego pliku nie da się użyć jako profilu drukarni: ${e.message}.`); }
  if (profil.przestrzen !== 'CMYK') throw new Error('Ten profil nie opisuje druku w CMYK. Poproś drukarnię o profil wyjściowy CMYK (np. ISO Coated v2, PSO Coated v3).');
  if (!identyfikator) { identyfikator = 'Custom'; opis = profil.opis || profilWlasny.nazwa || 'Profil drukarni'; }
  let silnik = null;
  return {
    profil, identyfikator, opis, zRejestru,
    // Silnik przeliczania powstaje dopiero, gdy jest potrzebny (kolory albo zdjęcia w CMYK).
    silnik() {
      if (!silnik) {
        try { silnik = new SilnikCmyk(profil); } catch (e) { throw new Error(`Tym profilem nie umiem przeliczać kolorów (${e.message}). Plik PDF/X-4 z tym profilem powstanie, jeśli wyłączysz przeliczanie na CMYK.`); }
      }
      return silnik;
    },
  };
}

export const spakuj = async (bajty) => new Uint8Array(await new Response(new Blob([bajty]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());

const xml = (t) => String(t).replace(/[<>&'"]/g, (z) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[z]));
const losowe = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const uuid = () => { const h = losowe(16); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };

// Dopisuje do gotowego dokumentu wszystko, czego wymaga PDF/X-4. Wołane tuż przed zapisem pliku.
export async function dodajPdfX(PDFLib, pdf, druk, { tytul }) {
  const { PDFName, PDFString, PDFHexString, PDFDict } = PDFLib;
  const ctx = pdf.context;
  // Profil, który daje się spakować, idzie spakowany; pozostałe – tak, jak są.
  const strumien = async (bajty, slownik) => {
    const male = await spakuj(bajty);
    return ctx.register(male.length < bajty.length * 0.95 ? ctx.stream(male, { ...slownik, Filter: 'FlateDecode' }) : ctx.stream(bajty, slownik));
  };
  const profilDruku = await strumien(druk.profil.bajty, { N: 4, Alternate: 'DeviceCMYK' });
  const profilEkranu = await strumien(profilSrgb(), { N: 3, Alternate: 'DeviceRGB' });

  // Warunki druku.
  pdf.catalog.set(PDFName.of('OutputIntents'), ctx.obj([{
    Type: 'OutputIntent', S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of(druk.identyfikator),
    ...(druk.zRejestru ? { RegistryName: PDFString.of('http://www.color.org') } : {}),
    OutputCondition: PDFHexString.fromText(druk.opis),
    Info: PDFHexString.fromText(druk.opis),
    DestOutputProfile: profilDruku,
  }]));

  // Kolory RGB (zdjęcia, a bez przeliczania także tekst i kształty) są na każdej stronie opisane profilem sRGB.
  for (const strona of pdf.getPages()) {
    const { Resources } = strona.node.normalizedEntries();
    let przestrzenie = Resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict);
    if (!przestrzenie) { przestrzenie = ctx.obj({}); Resources.set(PDFName.of('ColorSpace'), przestrzenie); }
    przestrzenie.set(PDFName.of('DefaultRGB'), ctx.obj(['ICCBased', profilEkranu]));
  }

  // Opis dokumentu: te same dane w słowniku informacji i w metadanych XMP.
  const teraz = new Date(); teraz.setMilliseconds(0);
  pdf.setTitle(tytul);
  pdf.setCreationDate(teraz);
  pdf.setModificationDate(teraz);
  const info = pdf.getInfoDict();
  info.set(PDFName.of('Trapped'), PDFName.of('False'));
  info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-4'));
  const data = teraz.toISOString().replace('.000Z', 'Z');
  const dokument = uuid();
  const metadane = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(tytul)}</rdf:li></rdf:Alt></dc:title>
   <xmp:CreatorTool>${xml(pdf.getCreator() || 'Makietka')}</xmp:CreatorTool>
   <xmp:CreateDate>${data}</xmp:CreateDate>
   <xmp:ModifyDate>${data}</xmp:ModifyDate>
   <xmp:MetadataDate>${data}</xmp:MetadataDate>
   <pdf:Producer>${xml(pdf.getProducer() || 'Makietka')}</pdf:Producer>
   <pdf:Trapped>False</pdf:Trapped>
   <xmpMM:DocumentID>uuid:${dokument}</xmpMM:DocumentID>
   <xmpMM:InstanceID>uuid:${uuid()}</xmpMM:InstanceID>
   <xmpMM:VersionID>1</xmpMM:VersionID>
   <xmpMM:RenditionClass>default</xmpMM:RenditionClass>
   <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  pdf.catalog.set(PDFName.of('Metadata'), ctx.register(ctx.stream(new TextEncoder().encode(metadane), { Type: 'Metadata', Subtype: 'XML' })));

  // Identyfikator pliku.
  const id = PDFHexString.of(losowe(16));
  ctx.trailerInfo.ID = ctx.obj([id, id]);
}

// PDF/X-4 opiera się na PDF 1.6, a biblioteka zawsze wpisuje w nagłówek 1.7 (plik nie używa niczego
// nowszego niż 1.6). Poprawka jednego znaku w gotowym pliku – długość i położenia obiektów zostają.
export function naglowekPdfX(bajty) {
  const poczatek = String.fromCharCode(...bajty.subarray(0, 8));
  if (poczatek === '%PDF-1.7') bajty[7] = 0x36;
  return bajty;
}
