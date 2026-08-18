-- Idempotente per costruzione: la clausola read_at is null rende la seconda
-- chiamata un no-op, e author <> p_reader impedisce di leggersi da soli.
create or replace function mark_letter_read(p_id uuid, p_reader person)
returns void
language sql
security definer
set search_path = public
as $$
  update letters
     set read_at = now()
   where id = p_id
     and author <> p_reader
     and read_at is null;
$$;

revoke all on function mark_letter_read(uuid, person) from public, anon;
grant execute on function mark_letter_read(uuid, person) to authenticated;
