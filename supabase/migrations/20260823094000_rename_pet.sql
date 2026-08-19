-- Nessun tracciamento per persona: il nome è condiviso, modificabile da
-- entrambi in ogni momento (non solo alla prima adozione).
create or replace function rename_pet(
  p_species_key text,
  p_name        text
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

  if p_name is null or char_length(trim(p_name)) = 0 or char_length(trim(p_name)) > 40 then
    raise exception 'invalid_pet_name';
  end if;

  update pets
     set nickname = trim(p_name)
   where species_key = p_species_key
  returning * into v_pet;

  return v_pet;
end
$$;

revoke all on function rename_pet(text, text) from public, anon;
grant execute on function rename_pet(text, text) to authenticated;
