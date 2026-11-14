#!/usr/bin/env node
// Para kluczy VAPID do powiadomień push (decyzja #113) – bez żadnych zależności, tylko node:crypto.
//
// Uruchom u siebie, raz:   node scripts/vapid.cjs
// i wpisz trzy wypisane wartości w Supabase → Edge Functions → Secrets (nazwy jak w Familiadzie):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// Klucza prywatnego nie wklejaj nigdzie indziej i nie zapisuj w repozytorium. Aplikacja pobiera klucz publiczny
// z Funkcji Edge powiadomienia, więc w kodzie nic nie trzeba zmieniać. Nowa para = urządzenia muszą włączyć
// powiadomienia ponownie (stare subskrypcje przestają działać).

const crypto = require('node:crypto');

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function generuj() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  // getPrivateKey() potrafi obciąć zera wiodące (31 B) – dopełniamy do 32 B.
  const prywatny = Buffer.alloc(32);
  const surowy = ecdh.getPrivateKey();
  surowy.copy(prywatny, 32 - surowy.length);
  return { publiczny: b64url(ecdh.getPublicKey()), prywatny: b64url(prywatny) };
}

if (require.main === module) {
  const { publiczny, prywatny } = generuj();
  process.stdout.write([
    'Supabase → Edge Functions → Secrets:',
    '',
    `VAPID_PUBLIC_KEY=${publiczny}`,
    `VAPID_PRIVATE_KEY=${prywatny}`,
    'VAPID_SUBJECT=mailto:kontakt@makietka.app',
    '',
  ].join('\n'));
}

module.exports = { generuj };
