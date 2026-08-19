-- Riusa spend_coins (lock su couple_state, controllo saldo,
-- insufficient_funds già tradotto) invece di reimplementare la spesa.
-- La violazione della chiave primaria (doppio sblocco quasi simultaneo)
-- diventa already_unlocked, stesso pattern di already_owned in
-- purchase_item (F6).
create or replace function unlock_pet(
  p_actor         person,
  p_species_key   text,
  p_kind          pet_kind,
  p_initial_stats jsonb
) returns pets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
begin
  perform spend_coins(p_actor, p_species_key);

  begin
    insert into pets (species_key, kind, stats)
    values (p_species_key, p_kind, p_initial_stats)
    returning * into v_pet;
  exception when unique_violation then
    raise exception 'already_unlocked';
  end;

  return v_pet;
end
$$;

revoke all on function unlock_pet(person, text, pet_kind, jsonb) from public, anon;
grant execute on function unlock_pet(person, text, pet_kind, jsonb) to authenticated;
