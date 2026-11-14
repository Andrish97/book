-- Migracja: usunięcie kont testowych, które zostały po przerwanych próbach na żywo (decyzja #108).
-- Konta testowe mają zawsze adres seriodruk-test-…@example.com albo test-…@example.com (scripts/proba-na-zywo.cjs,
-- sprawdzanie maili) – prawdziwe konto takiego adresu mieć nie może (domena example.com nie przyjmuje poczty).
-- Projekty, strony, klucze i linki znikają kaskadowo (owner_id → auth.users on delete cascade).
delete from auth.users
 where email like 'seriodruk-test-%@example.com'
    or email like 'makietka-test-%@example.com';
