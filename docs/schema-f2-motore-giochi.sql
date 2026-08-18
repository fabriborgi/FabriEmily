-- Schema F2 di Fabrizio & Emily — motore realtime dei giochi.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) sono già stati
-- applicati: questo script presuppone che esistano già il tipo person e la
-- funzione grant_coins.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.
-- A differenza di F5/F6, questa fase non ha semi di contenuto: queste tre
-- migrazioni, nessun seme di contenuto.

-- ============================================================
-- 20260820090000_game_matches_schema.sql
-- ============================================================
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

-- ============================================================
-- 20260820091000_create_match.sql
-- ============================================================
-- Apre una nuova partita con lo stato iniziale passato dal client e chi la
-- avvia già al turno. La protezione contro due aperture concorrenti dello
-- stesso gioco è l'indice unico su game_matches (Task 1): non c'è bisogno di
-- un controllo separato, la violazione stessa è il segnale.
create or replace function create_match(
  p_game_type      game_type,
  p_person         person,
  p_initial_state  jsonb
) returns game_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match game_matches;
begin
  begin
    insert into game_matches (game_type, state, started_by, current_turn)
    values (p_game_type, p_initial_state, p_person, p_person)
    returning * into v_match;
  exception when unique_violation then
    raise exception 'match_already_open';
  end;

  return v_match;
end
$$;

revoke all on function create_match(game_type, person, jsonb) from public, anon;
grant execute on function create_match(game_type, person, jsonb) to authenticated;

-- ============================================================
-- 20260820092000_make_move.sql
-- ============================================================
-- Applica una mossa, gira il turno, e chiude la partita se il client
-- dichiara un risultato. Il client calcola le regole del gioco (mossa
-- legale, vittoria, pareggio) — qui si applicano solo turni, chiusura e
-- monete, mai la correttezza delle regole di un gioco specifico.
--
-- Il "for update" PRIMA di leggere qualunque cosa è ciò che rende sicura la
-- funzione sotto due richieste quasi simultanee della stessa persona (un
-- doppio tocco che elude la guardia sincrona del client): senza, entrambe le
-- transazioni potrebbero leggere lo stesso current_turn e passare il
-- controllo, applicando due mosse di fila. Stesso principio del lock in
-- answer_question/spend_coins.
--
-- Nota: nel CASE sotto i due rami letterali ('emily'/'fabrizio') vanno
-- castati esplicitamente a person. Con due letterali non tipizzati (nessuno
-- dei due proviene da una colonna/parametro tipizzato), Postgres risolve il
-- CASE a text anziché a unknown, e text non ha un cast implicito verso un
-- enum: la UPDATE fallirebbe con "column current_turn is of type person but
-- expression is of type text" (stesso quirk di risoluzione tipi già visto
-- nella fixture di test del Task 1).
create or replace function make_move(
  p_match_id uuid,
  p_person   person,
  p_state    jsonb,
  p_result   text   default null,
  p_winner   person default null
) returns game_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match game_matches;
begin
  select * into v_match
  from game_matches
  where id = p_match_id and closed_at is null
  for update;

  if v_match.id is null then
    raise exception 'match_already_closed';
  end if;

  if v_match.current_turn <> p_person then
    raise exception 'not_your_turn';
  end if;

  if p_result is not null and p_result not in ('win', 'draw') then
    raise exception 'invalid_result';
  end if;

  if p_result = 'win' and p_winner is null then
    raise exception 'invalid_result';
  end if;

  update game_matches
     set state        = p_state,
         current_turn = case when p_person = 'fabrizio' then 'emily'::person else 'fabrizio'::person end,
         closed_at    = case when p_result is not null then now() else null end,
         winner       = case when p_result = 'win' then p_winner else null end
   where id = p_match_id
  returning * into v_match;

  if p_result = 'win' then
    perform grant_coins(p_winner, 'game_win', p_match_id, 0);
    perform grant_coins(
      case when p_winner = 'fabrizio' then 'emily'::person else 'fabrizio'::person end,
      'game_loss', p_match_id, 0
    );
  elsif p_result = 'draw' then
    perform grant_coins('fabrizio', 'game_draw', p_match_id, 0);
    perform grant_coins('emily', 'game_draw', p_match_id, 0);
  end if;

  return v_match;
end
$$;

revoke all on function make_move(uuid, person, jsonb, text, person) from public, anon;
grant execute on function make_move(uuid, person, jsonb, text, person) to authenticated;
