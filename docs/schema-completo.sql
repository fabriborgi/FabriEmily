-- Schema completo di Fabrizio & Emily, fase F0+F1.
-- Generato unendo le migrazioni in ordine. Incollare per intero nel
-- SQL Editor del progetto Supabase e premere Run, una volta sola.
-- Le migrazioni singole restano in supabase/migrations/ come sorgente.

-- ============================================================
-- 20260817090000_schema.sql
-- ============================================================
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

-- Le prossime due ALTER DEFAULT PRIVILEGES valgono per gli OGGETTI FUTURI (tabelle,
-- sequence, funzioni create da migrazioni successive), non per quelli esistenti:
-- cambiano l'ACL con cui un oggetto nasce, non quella di ciò che è già stato
-- creato. I REVOKE/GRANT più sotto restano necessari in aggiunta, perché
-- agiscono sugli oggetti che QUESTA migrazione ha appena creato (che esistevano
-- già quando gli ALTER DEFAULT PRIVILEGES sono stati eseguiti, e quindi non ne
-- hanno beneficiato). Servono entrambi: uno per il presente, uno per il futuro.

-- Rilievo 1: una funzione security definer creata in schema public nasce con
-- proacl = NULL, cioè eseguibile da PUBLIC (e quindi da anon) per default. Le
-- funzioni security definer dei task 3-7 (grant_coins, create_letter,
-- mark_letter_read, spend_coins) scavalcano RLS e privilegi di tabella per
-- design: se restano invocabili senza sessione, il confine di sicurezza
-- dell'app (password condivisa) non esiste più. Verificato creando davvero una
-- funzione di prova e interrogando has_function_privilege('anon', ...): non
-- fidarsi del catalogo da solo.
--
-- Trappola aggiuntiva, verificata empiricamente su questa istanza (Postgres
-- 17.6, stack Supabase locale): la forma "IN SCHEMA public" qui sotto per le
-- FUNZIONI è un secondo falso positivo. Produce una riga in pg_default_acl con
-- un ACL apparentemente corretto (niente PUBLIC), ma una funzione creata dopo
-- in schema public ottiene comunque proacl = NULL e resta eseguibile da anon:
--   alter default privileges in schema public revoke execute on functions from public;
-- Per le TABELLE e le SEQUENCE (vedi sotto) la forma "IN SCHEMA" funziona come
-- atteso: solo per le FUNZIONI questa istanza non applica la riga specifica
-- dello schema. La forma senza "IN SCHEMA" (a livello di intero database)
-- invece funziona ed è quella che uso qui. Riguarda solo gli oggetti di cui
-- postgres (il ruolo che esegue le migrazioni) diventa proprietario: le
-- funzioni di schemi interni Supabase (auth, storage, ...) appartengono ad
-- altri ruoli e non sono toccate.
alter default privileges revoke execute on functions from public;

-- Rilievo 2: la REVOKE ALL più sotto è uno snapshot sulle tabelle/sequence che
-- esistono ORA. pg_default_acl per tabelle e sequence continua a concedere ad
-- anon/authenticated il pacchetto di default (incluso TRUNCATE, "Dxtm", e USAGE
-- sulle sequence): una tabella creata da una migrazione futura rinascerebbe con
-- quegli stessi privilegi, a meno di ripetere la REVOKE ALL a mano ogni volta.
-- Rendiamo la protezione una regola invece che un'abitudine da ricordare.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Seconda barriera oltre alle RLS: i privilegi di scrittura non esistono affatto.
-- Deve stare PRIMA delle GRANT sottostanti, così le GRANT restano l'ultima parola.
-- Attenzione: l'ACL di default concede comunque TRUNCATE, REFERENCES, TRIGGER e
-- MAINTAIN (il pacchetto "Dxtm") anche quando arwd sono negati. Una REVOKE mirata
-- su insert/update/delete NON tocca quei privilegi: anon e authenticated
-- resterebbero comunque in grado di fare TRUNCATE sulle tabelle (RLS non copre
-- TRUNCATE) e authenticated/anon potrebbero manipolare le sequence con
-- setval/nextval. Serve una REVOKE ALL, sia su tabelle sia su sequence.
-- Nota: questa REVOKE ALL agisce sulle tabelle/sequence GIÀ create sopra in
-- questa migrazione, non su quelle future (vedi gli ALTER DEFAULT PRIVILEGES
-- precedenti per quelle). service_role non è toccato: mantiene w (UPDATE) su
-- coin_ledger_id_seq, privilegio sufficiente per gli insert sul ledger perché
-- nextval accetta USAGE oppure UPDATE.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Il CLI/template locale in uso non espone più automaticamente le tabelle nuove
-- ai ruoli API (vedi "auto_expose_new_tables" in supabase/config.toml, ora false
-- di default): senza queste GRANT esplicite, authenticated e service_role
-- ricevono "permission denied" ancora prima che RLS entri in gioco.
-- service_role bypassa comunque le RLS (rolbypassrls), ma resta soggetto ai
-- privilegi di tabella: gli va concesso l'accesso pieno per operare da backend.
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

-- ============================================================
-- 20260817091000_grant_coins.sql
-- ============================================================
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
  -- Lock su couple_state PRIMA di leggere il ledger: serializza le concessioni
  -- concorrenti con lo stesso actor/reason, così due chiamate vicine al cap
  -- (es. doppio tocco sul pulsante) non possono più leggere entrambe
  -- v_used < daily_cap prima che l'una o l'altra abbia inserito la propria
  -- riga. Stesso meccanismo di spend_coins: ogni concessione aggiorna comunque
  -- questa riga, quindi il lock non introduce contesa nuova, sposta solo il
  -- momento in cui viene preso.
  select coins into v_coins from couple_state where id = 1 for update;

  select * into v_rule from coin_rules where reason = p_reason;
  if not found then
    raise exception 'unknown_coin_reason';
  end if;

  -- Sotto il minimo non è un errore: il contenuto è valido, semplicemente non paga.
  if p_units < v_rule.min_units then
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

-- ============================================================
-- 20260817092000_create_letter.sql
-- ============================================================
-- Inserimento e ricompensa nella stessa transazione: non può esistere una lettera
-- senza che la sua ricompensa sia stata valutata.
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
    p_strokes := null;   -- un vincolo di tabella lo esigerebbe comunque
  else
    raise exception 'invalid_strokes';   -- il ramo disegno arriva nel Task 5
  end if;

  insert into letters (author, kind, body, strokes)
  values (p_author, p_kind, p_body, p_strokes)
  returning * into v_letter;

  perform grant_coins(p_author, v_reason, v_letter.id, v_units);

  return v_letter;
end
$$;

revoke all on function create_letter(person, letter_kind, text, jsonb) from public, anon;
grant execute on function create_letter(person, letter_kind, text, jsonb) to authenticated;

-- ============================================================
-- 20260817093000_create_letter_drawing.sql
-- ============================================================
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

-- ============================================================
-- 20260817094000_mark_letter_read.sql
-- ============================================================
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

-- ============================================================
-- 20260817095000_spend_coins.sql
-- ============================================================
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

