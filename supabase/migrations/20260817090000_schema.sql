-- Identità e tipo di lettera. L'identità non è verificata (password condivisa):
-- è un'etichetta d'autore, non un principal di sicurezza.
create type person      as enum ('fabrizio','emily');
create type letter_kind as enum ('text','drawing');

-- Stato condiviso della coppia: una riga sola, per sempre.
create table couple_state (
  id         int primary key default 1 check (id = 1),
  coins      int not null default 0 check (coins >= 0),
  theme      text not null default 'default',
  updated_at timestamptz not null default now()
);
insert into couple_state (id) values (1);

-- Gli importi stanno in tabella, non in codice: ribilanciare è una UPDATE, non un deploy.
create table coin_rules (
  reason    text primary key,
  amount    int  not null check (amount > 0),
  daily_cap int  null,                 -- null = illimitato; il cap è PER PERSONA
  min_units int  not null default 0,   -- caratteri per le lettere, tratti per i disegni
  label     text not null              -- mostrato nel ledger, in inglese
);

-- Nasce vuota: le chiavi arrivano con F4 (animali) e F6 (shop).
create table item_prices (
  key   text primary key,
  cost  int  not null check (cost > 0),
  label text not null
);

-- La verità storica dei movimenti. couple_state.coins ne è solo la somma cachata.
create table coin_ledger (
  id         bigserial primary key,
  actor      person      not null,
  amount     int         not null,
  reason     text        not null,
  ref_id     uuid        null,
  created_at timestamptz not null default now()
);
create index coin_ledger_actor_reason_day on coin_ledger (actor, reason, created_at desc);

create table letters (
  id         uuid        primary key default gen_random_uuid(),
  author     person      not null,
  kind       letter_kind not null,
  body       text        null,
  strokes    jsonb       null,
  created_at timestamptz not null default now(),
  read_at    timestamptz null,
  constraint letters_payload_matches_kind check (
       (kind = 'text'    and body is not null and strokes is null)
    or (kind = 'drawing' and strokes is not null and body is null)
  ),
  constraint letters_text_not_blank check (
    kind <> 'text' or char_length(trim(body)) > 0
  )
);
create index letters_created_at_desc on letters (created_at desc);
create index letters_unread on letters (created_at) where read_at is null;

-- Il CLI/template locale in uso non espone più automaticamente le tabelle nuove
-- ai ruoli API (vedi "auto_expose_new_tables" in supabase/config.toml, ora false
-- di default): senza queste GRANT esplicite, authenticated e service_role
-- ricevono "permission denied" ancora prima che RLS entri in gioco.
-- service_role bypassa comunque le RLS (rolbypassrls), ma resta soggetto ai
-- privilegi di tabella: gli va concesso l'accesso pieno per operare da backend.

-- Seconda barriera oltre alle RLS: i privilegi di scrittura non esistono affatto.
-- Deve stare PRIMA delle GRANT sottostanti, così le GRANT restano l'ultima parola.
-- Attenzione: l'ACL di default concede comunque TRUNCATE, REFERENCES, TRIGGER e
-- MAINTAIN (il pacchetto "Dxtm") anche quando arwd sono negati. Una REVOKE mirata
-- su insert/update/delete NON tocca quei privilegi: anon e authenticated
-- resterebbero comunque in grado di fare TRUNCATE sulle tabelle (RLS non copre
-- TRUNCATE) e authenticated/anon potrebbero manipolare le sequence con
-- setval/nextval. Serve una REVOKE ALL, sia su tabelle sia su sequence.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on couple_state, coin_rules, item_prices, coin_ledger, letters to authenticated;
grant select, insert, update, delete on couple_state, coin_rules, item_prices, coin_ledger, letters to service_role;

-- Permessi: lettura per chi ha superato il login, scrittura per nessuno.
alter table couple_state enable row level security;
create policy read_for_authenticated on couple_state for select to authenticated using (true);

alter table coin_rules enable row level security;
create policy read_for_authenticated on coin_rules for select to authenticated using (true);

alter table item_prices enable row level security;
create policy read_for_authenticated on item_prices for select to authenticated using (true);

alter table coin_ledger enable row level security;
create policy read_for_authenticated on coin_ledger for select to authenticated using (true);

alter table letters enable row level security;
create policy read_for_authenticated on letters for select to authenticated using (true);

-- Nota: questa REVOKE è un no-op e resta qui solo a scopo documentale. PUBLIC
-- mantiene comunque USAGE sullo schema public (privilegio di default assegnato
-- a PUBLIC alla creazione dello schema), quindi has_schema_privilege('anon',
-- 'public','USAGE') resta true dopo questa riga: anon non viene affatto tagliato
-- fuori dallo schema. Non revocare USAGE da PUBLIC: romperebbe ruoli interni di
-- Supabase che ne dipendono.
revoke usage on schema public from anon;

-- Realtime
alter publication supabase_realtime add table letters;
alter publication supabase_realtime add table couple_state;

-- Valori economici. Le regole delle fasi non ancora costruite restano inutilizzate,
-- ma sono definite adesso per non ribilanciare a pezzi.
insert into coin_rules (reason, amount, daily_cap, min_units, label) values
  ('letter_written',    15, 3,    40, 'letter written'),
  ('drawing_sent',      20, 2,     5, 'drawing sent'),
  ('question_answered',  8, 5,     0, 'question answered'),
  ('game_win',          20, null,  0, 'game won'),
  ('game_draw',         10, null,  0, 'game drawn'),
  ('game_loss',          5, null,  0, 'game played'),
  ('pet_care_action',    2, 30,    0, 'pet cared for'),
  ('plant_watered',      3, 15,    0, 'plant watered'),
  ('daily_open',        10, 1,     0, 'daily visit');
