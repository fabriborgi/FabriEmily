-- Validazione del formato dei tratti. Vive nel database e non solo nel client
-- perché il database è l'unico punto che nessuno può aggirare: chi ha la password
-- ha anche la anon key, e potrebbe chiamare la RPC direttamente.
create or replace function assert_valid_strokes(p_strokes jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  v_stroke jsonb;
  v_len    int;
begin
  if p_strokes is null
     or jsonb_typeof(p_strokes) <> 'array'
     or jsonb_array_length(p_strokes) = 0
     or jsonb_array_length(p_strokes) > 200 then
    raise exception 'invalid_strokes';
  end if;

  for v_stroke in select value from jsonb_array_elements(p_strokes) loop
    -- coalesce: se la chiave manca, "->" restituisce SQL NULL e jsonb_typeof(NULL)
    -- è NULL, che in "if" si comporta come falso e lascerebbe passare il tratto.
    if jsonb_typeof(v_stroke) <> 'object'
       or coalesce(jsonb_typeof(v_stroke -> 'c'), '') <> 'number'
       or coalesce(jsonb_typeof(v_stroke -> 'w'), '') <> 'number'
       or coalesce(jsonb_typeof(v_stroke -> 'p'), '') <> 'array' then
      raise exception 'invalid_strokes';
    end if;

    -- Whitelist delle chiavi: il formato è esattamente {c, w, p}, nient'altro.
    -- Un tratto con esattamente 3 chiavi e con c/w/p tutte presenti (già verificato
    -- sopra) non può contenere chiavi diverse da queste tre.
    if (select count(*) from jsonb_object_keys(v_stroke)) <> 3 then
      raise exception 'invalid_strokes';
    end if;

    -- c e w sono indici di array (palette colori, spessori), devono essere interi:
    -- un valore frazionario passerebbe la validazione qui ma produrrebbe
    -- PALETTE[stroke.c] === undefined lato client.
    if (v_stroke ->> 'c')::numeric not between 0 and 11
       or (v_stroke ->> 'w')::numeric not between 0 and 2
       or (v_stroke ->> 'c')::numeric <> trunc((v_stroke ->> 'c')::numeric)
       or (v_stroke ->> 'w')::numeric <> trunc((v_stroke ->> 'w')::numeric) then
      raise exception 'invalid_strokes';
    end if;

    v_len := jsonb_array_length(v_stroke -> 'p');
    if v_len < 2 or v_len > 800 or v_len % 2 <> 0 then
      raise exception 'invalid_strokes';
    end if;

    -- Le coordinate sono punti in uno spazio logico intero 1000x1000: anche qui
    -- i frazionari vanno rifiutati, non solo i fuori intervallo.
    if exists (
      select 1
      from jsonb_array_elements(v_stroke -> 'p') as e(value)
      where jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}')::numeric < 0
         or (e.value #>> '{}')::numeric > 1000
         or (e.value #>> '{}')::numeric <> trunc((e.value #>> '{}')::numeric)
    ) then
      raise exception 'invalid_strokes';
    end if;
  end loop;
end
$$;

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
    p_strokes := null;
  else
    perform assert_valid_strokes(p_strokes);
    v_units  := jsonb_array_length(p_strokes);
    v_reason := 'drawing_sent';
    p_body   := null;
  end if;

  insert into letters (author, kind, body, strokes)
  values (p_author, p_kind, p_body, p_strokes)
  returning * into v_letter;

  perform grant_coins(p_author, v_reason, v_letter.id, v_units);

  return v_letter;
end
$$;

revoke all on function assert_valid_strokes(jsonb) from public, anon, authenticated;
revoke all on function create_letter(person, letter_kind, text, jsonb) from public, anon;
grant execute on function create_letter(person, letter_kind, text, jsonb) to authenticated;
