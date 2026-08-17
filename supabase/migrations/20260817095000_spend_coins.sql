-- Il costo non arriva mai dal client: si legge da item_prices. Il `for update`
-- serializza gli acquisti concorrenti, ed è ciò che rende impossibile scendere
-- sotto zero se entrambi comprano nello stesso istante.
create or replace function spend_coins(p_actor person, p_item_key text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost  int;
  v_coins int;
begin
  select cost into v_cost from item_prices where key = p_item_key;
  if not found then
    raise exception 'unknown_item';
  end if;

  select coins into v_coins from couple_state where id = 1 for update;

  if v_coins < v_cost then
    raise exception 'insufficient_funds';
  end if;

  update couple_state
     set coins = coins - v_cost,
         updated_at = now()
   where id = 1
  returning coins into v_coins;

  insert into coin_ledger (actor, amount, reason)
  values (p_actor, -v_cost, 'spend:' || p_item_key);

  return v_coins;
end
$$;

revoke all on function spend_coins(person, text) from public, anon;
grant execute on function spend_coins(person, text) to authenticated;
