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
