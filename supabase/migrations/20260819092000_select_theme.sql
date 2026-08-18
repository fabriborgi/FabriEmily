-- Specifica ai temi. Attivare un tema già posseduto è gratis: comprare
-- (purchase_item) e attivare sono due passi distinti, così si può tornare a
-- un tema vecchio senza ripagarlo. 'default' è sempre permesso: non è mai
-- una riga di item_prices/owned_items, è il tema di base di :root.
create or replace function select_theme(p_theme_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_theme_key <> 'default' and not exists (
    select 1 from owned_items where key = p_theme_key
  ) then
    raise exception 'theme_not_owned';
  end if;

  update couple_state set theme = p_theme_key, updated_at = now() where id = 1;
end
$$;

revoke all on function select_theme(text) from public, anon;
grant execute on function select_theme(text) to authenticated;
