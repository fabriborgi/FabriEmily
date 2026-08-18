-- Generica, non specifica ai temi: pensata per essere riusata anche da F4
-- (skin degli animali), che condividerà item_prices/owned_items. Richiama
-- spend_coins invece di reimplementarne la logica: lock, lettura del costo e
-- traduzione di insufficient_funds/unknown_item restano in un solo posto.
create or replace function purchase_item(p_actor person, p_item_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from owned_items where key = p_item_key) then
    raise exception 'already_owned';
  end if;

  perform spend_coins(p_actor, p_item_key);

  -- La violazione di unicità concorrente (due acquisti simultanei dello
  -- stesso oggetto) diventa already_owned, stesso pattern del
  -- round_already_open di F5: il controllo sopra è la via rapida per il
  -- messaggio giusto, questo vincolo è la vera rete di sicurezza.
  begin
    insert into owned_items (key) values (p_item_key);
  exception when unique_violation then
    raise exception 'already_owned';
  end;
end
$$;

revoke all on function purchase_item(person, text) from public, anon;
grant execute on function purchase_item(person, text) to authenticated;
