-- Pesca una domanda e apre un round. La scelta fra "mai risposta" e "la più
-- vecchia se la categoria è esaurita" avviene qui; la protezione contro due
-- pescate concorrenti è l'indice unico su question_rounds (Task 1): non c'è
-- bisogno di un controllo separato, la violazione stessa è il segnale.
create or replace function draw_question(
  p_person   person,
  p_category question_category default null
) returns question_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_round       question_rounds;
begin
  -- Prima scelta: una domanda mai chiusa come 'answered'. Le domande
  -- skippate restano candidate qui: uno skip non rivela nulla del contenuto,
  -- quindi non c'è motivo di escluderle dal pool delle "mai fatte davvero".
  select q.id into v_question_id
  from questions q
  where (p_category is null or q.category = p_category)
    and not exists (
      select 1 from question_rounds r
      where r.question_id = q.id and r.closed_reason = 'answered'
    )
  order by random()
  limit 1;

  -- Categoria esaurita: ripesca quella "dimenticata da più tempo", cioè
  -- quella la cui ultima chiusura 'answered' è la più vecchia.
  if v_question_id is null then
    select q.id into v_question_id
    from questions q
    join (
      select question_id, max(closed_at) as last_answered
      from question_rounds
      where closed_reason = 'answered'
      group by question_id
    ) last on last.question_id = q.id
    where (p_category is null or q.category = p_category)
    order by last.last_answered asc
    limit 1;
  end if;

  if v_question_id is null then
    -- Non dovrebbe mai succedere con 300 domande seminate: fallisce in modo
    -- esplicito invece di restituire un round senza domanda valida.
    raise exception 'no_questions_available';
  end if;

  begin
    insert into question_rounds (question_id, drawn_by)
    values (v_question_id, p_person)
    returning * into v_round;
  exception when unique_violation then
    raise exception 'round_already_open';
  end;

  return v_round;
end
$$;

revoke all on function draw_question(person, question_category) from public, anon;
grant execute on function draw_question(person, question_category) to authenticated;
