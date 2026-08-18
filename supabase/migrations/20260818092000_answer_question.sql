-- Inserisce la risposta, accredita le monete nella stessa transazione
-- (stesso principio di create_letter: non può esistere una risposta senza
-- che la sua ricompensa sia stata valutata), e chiude il round alla seconda
-- risposta.
--
-- Il "for update" sul round PRIMA di inserire qualunque cosa è ciò che
-- rende sicura la chiusura sotto due risposte simultanee: senza, due
-- transazioni che rispondono nello stesso istante potrebbero entrambe
-- vedersi come "l'unica risposta" e nessuna chiuderebbe il round.
create or replace function answer_question(
  p_round_id uuid,
  p_person   person,
  p_body     text
) returns question_answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer question_answers;
  v_count  int;
  v_locked uuid;
begin
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'empty_answer';
  end if;

  select id into v_locked
  from question_rounds
  where id = p_round_id and closed_at is null
  for update;

  if v_locked is null then
    raise exception 'round_already_closed';
  end if;

  begin
    insert into question_answers (round_id, author, body)
    values (p_round_id, p_person, trim(p_body))
    returning * into v_answer;
  exception when unique_violation then
    raise exception 'already_answered';
  end;

  perform grant_coins(p_person, 'question_answered', p_round_id, 0);

  select count(*) into v_count from question_answers where round_id = p_round_id;
  if v_count = 2 then
    update question_rounds set closed_at = now(), closed_reason = 'answered'
    where id = p_round_id;
  end if;

  return v_answer;
end
$$;

revoke all on function answer_question(uuid, person, text) from public, anon;
grant execute on function answer_question(uuid, person, text) to authenticated;
