// Próbna funkcja: sprawdza, czy integracja Supabase z GitHubem wdraża Funkcje Edge z repozytorium.
// Odpowiada krótkim tekstem i niczego nie czyta z bazy.
Deno.serve(() => new Response(JSON.stringify({ seriodruk: 'działa', funkcja: 'zdrowie' }), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
}));
