-- Tipo delle cinque categorie.
create type question_category as enum ('deep','spicy','about_us','hypothetical','fun');

-- Il mazzo statico delle 300 domande. Seminato nel Task 5.
create table questions (
  id       uuid primary key default gen_random_uuid(),
  category question_category not null,
  body     text not null
);

create table question_rounds (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid   not null references questions(id),
  drawn_by      person not null,
  drawn_at      timestamptz not null default now(),
  closed_at     timestamptz null,
  closed_reason text null check (closed_reason in ('answered','skipped')),
  closed_by     person null  -- chi ha skippato; null se closed_reason = 'answered'
);

-- Al massimo un round aperto alla volta, imposto dal database: indice unico
-- parziale su un'espressione costante, verificato empiricamente prima di
-- scrivere questa migrazione (due insert con closed_at is null in
-- concorrenza: il secondo riceve una violazione di questo indice, mai una
-- riga fantasma). Le funzioni traducono la violazione in un errore
-- applicativo invece di fare un controllo separato, che lascerebbe comunque
-- una finestra di corsa fra il controllo e l'insert.
create unique index one_open_round on question_rounds ((true)) where closed_at is null;

create table question_answers (
  round_id    uuid   not null references question_rounds(id),
  author      person not null,
  body        text   not null,
  answered_at timestamptz not null default now(),
  primary key (round_id, author)  -- impedisce una seconda risposta della stessa persona
);

-- Le tabelle nascono senza alcun privilegio per anon/authenticated (default
-- privileges impostati in F0+F1): vanno riaperte esplicitamente.
grant select on questions, question_rounds to authenticated;
-- question_answers NON riceve qui un grant generico: la sua policy sotto è
-- l'unica via di lettura, ed è più stretta di "select per chi ha fatto login".
grant select on question_answers to authenticated;

alter table questions enable row level security;
create policy read_for_authenticated on questions for select to authenticated using (true);

alter table question_rounds enable row level security;
create policy read_for_authenticated on question_rounds for select to authenticated using (true);

-- Punto di sicurezza centrale di questa fase. L'identità Fabrizio/Emily non è
-- un ruolo Postgres verificato: le due persone condividono lo stesso login,
-- quindi il database non può distinguere "la richiesta di Fabrizio" da
-- "la richiesta di Emily". Una regola "mostra la risposta solo al suo
-- autore" è impossibile da scrivere qui. L'unica riservatezza applicabile è
-- "nessuno vede alcuna risposta di un round finché non è chiuso con
-- closed_reason = 'answered'" — inclusa la propria: il client sa "ho già
-- risposto" perché lo ricorda dal valore restituito dalla propria chiamata a
-- answer_question, non rileggendolo da questa tabella.
alter table question_answers enable row level security;
create policy read_after_reveal on question_answers
  for select to authenticated
  using (
    exists (
      select 1 from question_rounds r
      where r.id = question_answers.round_id and r.closed_reason = 'answered'
    )
  );

alter publication supabase_realtime add table question_rounds;
alter publication supabase_realtime add table question_answers;
