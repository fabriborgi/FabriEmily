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
