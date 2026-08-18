-- Schema F6 di Fabrizio & Emily — sezione Shop.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) e F5
-- (docs/schema-f5-domande.sql) sono già stati applicati: questo script
-- presuppone che esistano già il tipo person, la tabella item_prices,
-- couple_state, e la funzione spend_coins.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.

-- ============================================================
-- 20260819090000_owned_items_schema.sql
-- ============================================================
-- Tabella condivisa dalla coppia (come couple_state): non per persona. La
-- chiave primaria stessa impedisce di possedere due volte lo stesso oggetto
-- — a differenza del round aperto di F5, qui il vincolo è su un valore, non
-- su una condizione, quindi basta la primary key.
create table owned_items (
  key          text primary key references item_prices(key),
  purchased_at timestamptz not null default now()
);

grant select on owned_items to authenticated;
alter table owned_items enable row level security;
create policy read_for_authenticated on owned_items for select to authenticated using (true);

alter publication supabase_realtime add table owned_items;

-- ============================================================
-- 20260819091000_purchase_item.sql
-- ============================================================
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

-- ============================================================
-- 20260819092000_select_theme.sql
-- ============================================================
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

-- ============================================================
-- 20260819093000_shop_seed.sql
-- ============================================================
insert into item_prices (key, cost, label) values
  ('theme_night',  100, 'Night theme'),
  ('theme_ocean',  100, 'Ocean theme'),
  ('theme_sunset', 100, 'Sunset theme'),
  ('theme_forest', 100, 'Forest theme');
