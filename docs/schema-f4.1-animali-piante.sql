-- Schema F4.1 di Fabrizio & Emily — motore di cura di Animali e piante.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) è già stato
-- applicato: questo script presuppone che esistano già item_prices,
-- coin_rules (con pet_care_action/plant_watered già seminati),
-- spend_coins, grant_coins.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.

-- ============================================================
-- 20260823090000_pets_schema.sql
-- ============================================================
-- Una riga per specie SBLOCCATA, condivisa dalla coppia (come couple_state).
-- L'esistenza della riga stessa è il segnale di possesso — niente
-- owned_items per gli animali: qui serve uno stato vivo (statistiche, nome),
-- non solo un flag di possesso.
create type pet_kind as enum ('animal', 'plant');

create table pets (
  species_key text primary key references item_prices(key),
  kind         pet_kind not null,
  nickname     text null,
  stats        jsonb not null,
  -- animali: {"hunger":100,"cleanliness":100,"affection":100}
  -- piante:  {"water":100,"light":100}
  -- Forma decisa dal client: il server non conosce i nomi delle statistiche,
  -- stesso principio di game_matches.state in F2.
  updated_at   timestamptz not null default now(),
  -- Ultima scrittura di stats. Il client proietta il decadimento in avanti
  -- da qui usando i tassi per specie del catalogo frontend — nessun cron.
  unlocked_at  timestamptz not null default now()
);

grant select on pets to authenticated;
alter table pets enable row level security;
create policy read_for_authenticated on pets for select to authenticated using (true);

alter publication supabase_realtime add table pets;

-- ============================================================
-- 20260823091000_pets_seed_prices.sql
-- ============================================================
-- Costi per categoria (spec F4.1, sezione 6): domestico/fattoria 35,
-- esotico 70, fantastico 140, piante 25. Le chiavi sono definitive: sono
-- anche i nomi dei file immagine attesi in public/pets/<key>.png.
insert into item_prices (key, cost, label) values
  ('pet_dog', 35, 'Dog'),
  ('pet_cat', 35, 'Cat'),
  ('pet_rabbit', 35, 'Rabbit'),
  ('pet_hamster', 35, 'Hamster'),
  ('pet_guinea_pig', 35, 'Guinea pig'),
  ('pet_parrot', 35, 'Parrot'),
  ('pet_goldfish', 35, 'Goldfish'),
  ('pet_turtle', 35, 'Turtle'),
  ('pet_pony', 35, 'Pony'),
  ('pet_goat', 35, 'Goat'),
  ('pet_sheep', 35, 'Sheep'),
  ('pet_cow', 35, 'Cow'),
  ('pet_pig', 35, 'Pig'),
  ('pet_capybara', 35, 'Capybara'),
  ('pet_koala', 70, 'Koala'),
  ('pet_panda', 70, 'Panda'),
  ('pet_penguin', 70, 'Penguin'),
  ('pet_fox', 70, 'Fox'),
  ('pet_owl', 70, 'Owl'),
  ('pet_sloth', 70, 'Sloth'),
  ('pet_otter', 70, 'Otter'),
  ('pet_hedgehog', 70, 'Hedgehog'),
  ('pet_chameleon', 70, 'Chameleon'),
  ('pet_flamingo', 70, 'Flamingo'),
  ('pet_unicorn', 140, 'Unicorn'),
  ('pet_dragon', 140, 'Dragon'),
  ('pet_phoenix', 140, 'Phoenix'),
  ('pet_griffin', 140, 'Griffin cub'),
  ('pet_kitsune', 140, 'Nine-tailed fox'),
  ('pet_kraken', 140, 'Baby kraken'),
  ('pet_cloud_sprite', 140, 'Cloud sprite'),
  ('pet_moon_rabbit', 140, 'Moon rabbit'),
  ('plant_fern', 25, 'Fern'),
  ('plant_succulent', 25, 'Succulent'),
  ('plant_cactus', 25, 'Cactus'),
  ('plant_bonsai', 25, 'Bonsai'),
  ('plant_orchid', 25, 'Orchid'),
  ('plant_sunflower', 25, 'Sunflower'),
  ('plant_tulip', 25, 'Tulip'),
  ('plant_bamboo', 25, 'Bamboo'),
  ('plant_ivy', 25, 'Ivy'),
  ('plant_aloe', 25, 'Aloe vera'),
  ('plant_lavender', 25, 'Lavender'),
  ('plant_venus_flytrap', 25, 'Venus flytrap'),
  ('plant_money_tree', 25, 'Money tree'),
  ('plant_peace_lily', 25, 'Peace lily'),
  ('plant_moss_terrarium', 25, 'Moss terrarium');

-- ============================================================
-- 20260823092000_unlock_pet.sql
-- ============================================================
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

-- ============================================================
-- 20260823093000_care_for_pet.sql
-- ============================================================
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

-- ============================================================
-- 20260823094000_rename_pet.sql
-- ============================================================
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
