-- Il costo non arriva mai dal client: si legge da item_prices, altrimenti il
-- browser potrebbe comprare a costo zero.
--
-- Il `for update` serializza gli acquisti concorrenti. Attenzione a cosa fa
-- davvero: NON e' lui a impedire il saldo negativo, quello lo impedisce gia'
-- il vincolo check (coins >= 0) sulla tabella, che e' sincrono e non lascia
-- committare una riga negativa in nessun caso. Il lock serve a far leggere il
-- saldo aggiornato invece di uno stantio, cosi' che due acquisti simultanei
-- producano un `insufficient_funds` pulito - saldo intatto, nessuna riga di
-- ledger - invece di una violazione di vincolo generica che il chiamante non
-- saprebbe tradurre in un messaggio sensato.
-- Verificato in review con due sessioni concorrenti: senza il lock entrambe
-- superano il controllo applicativo e a fallire e' il check; con il lock la
-- seconda rilegge il saldo fresco e solleva insufficient_funds.
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
