-- L'unica via per creare monete. Il client non può chiamare altro che questo,
-- e questo non accetta importi: li legge da coin_rules.
create or replace function grant_coins(
  p_actor  person,
  p_reason text,
  p_ref    uuid default null,
  p_units  int  default 0
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule  coin_rules;
  v_used  int;
  v_coins int;
begin
  select * into v_rule from coin_rules where reason = p_reason;
  if not found then
    raise exception 'unknown_coin_reason';
  end if;

  -- Sotto il minimo non è un errore: il contenuto è valido, semplicemente non paga.
  if p_units < v_rule.min_units then
    select coins into v_coins from couple_state where id = 1;
    return v_coins;
  end if;

  if v_rule.daily_cap is not null then
    -- La giornata finisce a mezzanotte a Buffalo (le 6 del mattino in Italia).
    -- La doppia conversione di fuso è necessaria: `at time zone` su un timestamptz
    -- restituisce un timestamp locale senza fuso, e riapplicandolo si torna a timestamptz.
    select count(*) into v_used
    from coin_ledger
    where actor  = p_actor
      and reason = p_reason
      and created_at >= date_trunc('day', now() at time zone 'America/New_York')
                          at time zone 'America/New_York';

    if v_used >= v_rule.daily_cap then
      select coins into v_coins from couple_state where id = 1;
      return v_coins;
    end if;
  end if;

  insert into coin_ledger (actor, amount, reason, ref_id)
  values (p_actor, v_rule.amount, p_reason, p_ref);

  update couple_state
     set coins = coins + v_rule.amount,
         updated_at = now()
   where id = 1
  returning coins into v_coins;

  return v_coins;
end
$$;

revoke all on function grant_coins(person, text, uuid, int) from public, anon;
grant execute on function grant_coins(person, text, uuid, int) to authenticated;
