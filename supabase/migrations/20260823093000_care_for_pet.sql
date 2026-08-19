-- La reason delle monete si deriva dal kind già in tabella, mai da un
-- parametro del client: chi chiama non sceglie mai la reason. Nessun
-- ricalcolo del decadimento né clamp sui valori di p_stats — decisione
-- esplicita (spec F4.1, sezione 4): i due giocatori sono la stessa coppia,
-- non avversari, stesso principio già in vigore per Trivia/i giochi.
create or replace function care_for_pet(
  p_actor       person,
  p_species_key text,
  p_stats       jsonb
) returns pets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet    pets;
  v_reason text;
begin
  select * into v_pet from pets where species_key = p_species_key;
  if v_pet.species_key is null then
    raise exception 'pet_not_found';
  end if;

  v_reason := case v_pet.kind when 'animal' then 'pet_care_action' else 'plant_watered' end;

  update pets
     set stats      = p_stats,
         updated_at = now()
   where species_key = p_species_key
  returning * into v_pet;

  perform grant_coins(p_actor, v_reason);

  return v_pet;
end
$$;

revoke all on function care_for_pet(person, text, jsonb) from public, anon;
grant execute on function care_for_pet(person, text, jsonb) to authenticated;
