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
