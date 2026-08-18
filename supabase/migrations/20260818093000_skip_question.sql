-- Chiude il round come 'skipped' se non ci sono ancora risposte. Se una
-- risposta esiste già, è un no-op: chiudere comunque cancellerebbe in
-- silenzio il lavoro di chi ha già risposto onestamente, dato che le
-- risposte di un round 'skipped' non vengono mai rivelate.
create or replace function skip_question(p_round_id uuid, p_person person)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if exists (select 1 from question_answers where round_id = p_round_id) then
    return false;
  end if;

  update question_rounds
     set closed_at = now(), closed_reason = 'skipped', closed_by = p_person
   where id = p_round_id and closed_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end
$$;

revoke all on function skip_question(uuid, person) from public, anon;
grant execute on function skip_question(uuid, person) to authenticated;
