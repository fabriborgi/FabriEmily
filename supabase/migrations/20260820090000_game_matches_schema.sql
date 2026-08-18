-- F3 aggiunge altri valori con ALTER TYPE game_type ADD VALUE.
create type game_type as enum ('tic_tac_toe');

create table game_matches (
  id           uuid primary key default gen_random_uuid(),
  game_type    game_type not null,
  state        jsonb not null,
  started_by   person not null,
  current_turn person not null,
  winner       person null,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz null
);

-- Una partita aperta alla volta PER GIOCO: indice unico parziale sulla
-- colonna game_type stessa — più diretto del trucco "((true))" di F5, qui
-- esiste una chiave naturale su cui partizionare il vincolo.
create unique index one_open_match_per_game on game_matches (game_type) where closed_at is null;

grant select on game_matches to authenticated;
alter table game_matches enable row level security;
create policy read_for_authenticated on game_matches for select to authenticated using (true);

alter publication supabase_realtime add table game_matches;
