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
