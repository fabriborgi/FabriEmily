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
