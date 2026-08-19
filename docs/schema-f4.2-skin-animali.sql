-- Schema F4.2 di Fabrizio & Emily — skin/colori per animali e piante.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) E F4.1
-- (docs/schema-f4.1-animali-piante.sql) sono già stati applicati: questo
-- script presuppone che esistano già item_prices, owned_items,
-- purchase_item, la tabella pets.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.

-- ============================================================
-- 20260824090000_pets_active_skin.sql
-- ============================================================
-- Colore attivo su questo animale/pianta, o null per il colore naturale.
-- Nessuna FK verso item_prices: la vera regola non è "la chiave esiste"
-- ma "è stata comprata" (owned_items), un controllo che vive nella
-- funzione select_pet_skin, non nello schema — stesso principio già in
-- vigore per select_theme (F6).
alter table pets add column active_skin text null;

-- ============================================================
-- 20260824091000_skins_seed_prices.sql
-- ============================================================
-- Palette globale di 8 colori, riusabile su qualunque animale/pianta
-- posseduto (spec F4.2, sezione 6). Costo uniforme, più economico dei
-- temi di Shop (100) essendo una personalizzazione più piccola.
insert into item_prices (key, cost, label) values
  ('skin_gold', 50, 'Gold'),
  ('skin_ocean', 50, 'Ocean blue'),
  ('skin_sunset', 50, 'Sunset orange'),
  ('skin_forest', 50, 'Forest green'),
  ('skin_rose', 50, 'Rose pink'),
  ('skin_mint', 50, 'Mint'),
  ('skin_violet', 50, 'Violet'),
  ('skin_charcoal', 50, 'Charcoal');

-- ============================================================
-- 20260824092000_select_pet_skin.sql
-- ============================================================
-- Attivare una skin posseduta è gratis, sempre — comprare (purchase_item)
-- e attivare restano due passi distinti, stesso principio di
-- select_theme (F6). p_skin_key null riporta l'animale al colore
-- naturale.
create or replace function select_pet_skin(
  p_species_key text,
  p_skin_key    text
) returns pets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
begin
  if not exists (select 1 from pets where species_key = p_species_key) then
    raise exception 'pet_not_found';
  end if;

  if p_skin_key is not null and not exists (
    select 1 from owned_items where key = p_skin_key
  ) then
    raise exception 'skin_not_owned';
  end if;

  update pets
     set active_skin = p_skin_key
   where species_key = p_species_key
  returning * into v_pet;

  return v_pet;
end
$$;

revoke all on function select_pet_skin(text, text) from public, anon;
grant execute on function select_pet_skin(text, text) to authenticated;
