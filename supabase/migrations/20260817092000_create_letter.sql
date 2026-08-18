-- Inserimento e ricompensa nella stessa transazione: non può esistere una lettera
-- senza che la sua ricompensa sia stata valutata.
create or replace function create_letter(
  p_author  person,
  p_kind    letter_kind,
  p_body    text  default null,
  p_strokes jsonb default null
) returns letters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_letter letters;
  v_units  int;
  v_reason text;
begin
  if p_kind = 'text' then
    if p_body is null or char_length(trim(p_body)) = 0 then
      raise exception 'empty_letter';
    end if;
    v_units   := char_length(trim(p_body));
    v_reason  := 'letter_written';
    p_strokes := null;   -- un vincolo di tabella lo esigerebbe comunque
  else
    raise exception 'invalid_strokes';   -- il ramo disegno arriva nel Task 5
  end if;

  insert into letters (author, kind, body, strokes)
  values (p_author, p_kind, p_body, p_strokes)
  returning * into v_letter;

  perform grant_coins(p_author, v_reason, v_letter.id, v_units);

  return v_letter;
end
$$;

revoke all on function create_letter(person, letter_kind, text, jsonb) from public, anon;
grant execute on function create_letter(person, letter_kind, text, jsonb) to authenticated;
