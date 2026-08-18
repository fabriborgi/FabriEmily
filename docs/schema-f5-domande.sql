-- Schema F5 di Fabrizio & Emily — sezione Domande.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) è già stato applicato:
-- questo script presuppone che esistano già i tipi person, la tabella
-- coin_ledger, couple_state, e la funzione grant_coins.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.

-- ============================================================
-- 20260818090000_questions_schema.sql
-- ============================================================
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

-- ============================================================
-- 20260818091000_draw_question.sql
-- ============================================================
-- Pesca una domanda e apre un round. La scelta fra "mai risposta" e "la più
-- vecchia se la categoria è esaurita" avviene qui; la protezione contro due
-- pescate concorrenti è l'indice unico su question_rounds (Task 1): non c'è
-- bisogno di un controllo separato, la violazione stessa è il segnale.
create or replace function draw_question(
  p_person   person,
  p_category question_category default null
) returns question_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_round       question_rounds;
begin
  -- Prima scelta: una domanda mai chiusa come 'answered'. Le domande
  -- skippate restano candidate qui: uno skip non rivela nulla del contenuto,
  -- quindi non c'è motivo di escluderle dal pool delle "mai fatte davvero".
  select q.id into v_question_id
  from questions q
  where (p_category is null or q.category = p_category)
    and not exists (
      select 1 from question_rounds r
      where r.question_id = q.id and r.closed_reason = 'answered'
    )
  order by random()
  limit 1;

  -- Categoria esaurita: ripesca quella "dimenticata da più tempo", cioè
  -- quella la cui ultima chiusura 'answered' è la più vecchia.
  if v_question_id is null then
    select q.id into v_question_id
    from questions q
    join (
      select question_id, max(closed_at) as last_answered
      from question_rounds
      where closed_reason = 'answered'
      group by question_id
    ) last on last.question_id = q.id
    where (p_category is null or q.category = p_category)
    order by last.last_answered asc
    limit 1;
  end if;

  if v_question_id is null then
    -- Non dovrebbe mai succedere con 300 domande seminate: fallisce in modo
    -- esplicito invece di restituire un round senza domanda valida.
    raise exception 'no_questions_available';
  end if;

  begin
    insert into question_rounds (question_id, drawn_by)
    values (v_question_id, p_person)
    returning * into v_round;
  exception when unique_violation then
    raise exception 'round_already_open';
  end;

  return v_round;
end
$$;

revoke all on function draw_question(person, question_category) from public, anon;
grant execute on function draw_question(person, question_category) to authenticated;

-- ============================================================
-- 20260818092000_answer_question.sql
-- ============================================================
-- Inserisce la risposta, accredita le monete nella stessa transazione
-- (stesso principio di create_letter: non può esistere una risposta senza
-- che la sua ricompensa sia stata valutata), e chiude il round alla seconda
-- risposta.
--
-- Il "for update" sul round PRIMA di inserire qualunque cosa è ciò che
-- rende sicura la chiusura sotto due risposte simultanee: senza, due
-- transazioni che rispondono nello stesso istante potrebbero entrambe
-- vedersi come "l'unica risposta" e nessuna chiuderebbe il round.
create or replace function answer_question(
  p_round_id uuid,
  p_person   person,
  p_body     text
) returns question_answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer question_answers;
  v_count  int;
  v_locked uuid;
begin
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'empty_answer';
  end if;

  select id into v_locked
  from question_rounds
  where id = p_round_id and closed_at is null
  for update;

  if v_locked is null then
    raise exception 'round_already_closed';
  end if;

  begin
    insert into question_answers (round_id, author, body)
    values (p_round_id, p_person, trim(p_body))
    returning * into v_answer;
  exception when unique_violation then
    raise exception 'already_answered';
  end;

  perform grant_coins(p_person, 'question_answered', p_round_id, 0);

  select count(*) into v_count from question_answers where round_id = p_round_id;
  if v_count = 2 then
    update question_rounds set closed_at = now(), closed_reason = 'answered'
    where id = p_round_id;
  end if;

  return v_answer;
end
$$;

revoke all on function answer_question(uuid, person, text) from public, anon;
grant execute on function answer_question(uuid, person, text) to authenticated;

-- ============================================================
-- 20260818093000_skip_question.sql
-- ============================================================
-- Chiude il round come 'skipped' se non ci sono ancora risposte. Se una
-- risposta esiste già, è un no-op: chiudere comunque cancellerebbe in
-- silenzio il lavoro di chi ha già risposto onestamente, dato che le
-- risposte di un round 'skipped' non vengono mai rivelate.
create or replace function skip_question(p_round_id uuid, p_person person)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if exists (select 1 from question_answers where round_id = p_round_id) then
    return false;
  end if;

  update question_rounds
     set closed_at = now(), closed_reason = 'skipped', closed_by = p_person
   where id = p_round_id and closed_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end
$$;

revoke all on function skip_question(uuid, person) from public, anon;
grant execute on function skip_question(uuid, person) to authenticated;

-- ============================================================
-- 20260818094000_questions_seed.sql
-- ============================================================
-- Le 300 domande, calibrate in fase di brainstorming (tono diretto ma non
-- esplicito per 'spicy') e verificate senza duplicati prima di scrivere il piano.
insert into questions (category, body) values
  ('deep', 'What''s a fear you''ve never told me about?'),
  ('deep', 'What''s a memory from your childhood that still shapes who you are?'),
  ('deep', 'What do you think is the biggest misconception people have about you?'),
  ('deep', 'When do you feel most like yourself?'),
  ('deep', 'What''s something you''re still healing from?'),
  ('deep', 'What do you think happens after we die?'),
  ('deep', 'What''s a belief you held for years and later changed your mind about?'),
  ('deep', 'What does "home" mean to you, beyond a place?'),
  ('deep', 'What''s the hardest thing you''ve ever had to forgive?'),
  ('deep', 'What do you want to be remembered for?'),
  ('deep', 'What''s a question you''re afraid to ask yourself?'),
  ('deep', 'What does success actually mean to you, deep down?'),
  ('deep', 'What''s something you''ve never told anyone?'),
  ('deep', 'What part of yourself are you still trying to understand?'),
  ('deep', 'What''s a moment that changed the direction of your life?'),
  ('deep', 'Do you think people can really change? Why or why not?'),
  ('deep', 'What''s something you''re proud of that no one ever notices?'),
  ('deep', 'What''s a fear about the future that you carry quietly?'),
  ('deep', 'What do you think is your purpose?'),
  ('deep', 'What''s something you needed to hear as a kid that no one said?'),
  ('deep', 'What does love mean to you now, versus when you were younger?'),
  ('deep', 'What''s a wound you''re still carrying from someone who hurt you?'),
  ('deep', 'What do you think makes a life well-lived?'),
  ('deep', 'What''s something about yourself you''ve only recently accepted?'),
  ('deep', 'What role does faith or spirituality play in your life, if any?'),
  ('deep', 'What''s a regret you''ve made peace with?'),
  ('deep', 'What''s a regret you haven''t made peace with?'),
  ('deep', 'What do you think is the difference between being alone and being lonely?'),
  ('deep', 'What''s something you''re afraid people will find out about you?'),
  ('deep', 'What do you think you inherited from your parents that you didn''t choose?'),
  ('deep', 'What''s a truth about yourself that took you years to admit?'),
  ('deep', 'What does it mean to you to be truly known by someone?'),
  ('deep', 'What''s something you sacrificed that you don''t talk about?'),
  ('deep', 'What do you think is your greatest strength, and also your greatest weakness?'),
  ('deep', 'What''s a question about life you don''t think you''ll ever fully answer?'),
  ('deep', 'What kind of pain has made you stronger?'),
  ('deep', 'What''s something you wish you understood sooner?'),
  ('deep', 'What do you think people misunderstand about grief?'),
  ('deep', 'What''s a value you''d never compromise on, no matter what?'),
  ('deep', 'What''s something you''re grateful for that took you a long time to see clearly?'),
  ('deep', 'What does it mean to you to grow old?'),
  ('deep', 'What''s a moment you felt truly seen by someone?'),
  ('deep', 'What''s something about your family you''re still trying to make sense of?'),
  ('deep', 'What do you think it means to live authentically?'),
  ('deep', 'What''s a fear you''ve overcome that used to control you?'),
  ('deep', 'What''s something you believe about yourself that you wish weren''t true?'),
  ('deep', 'What do you think makes forgiveness possible?'),
  ('deep', 'What''s a version of yourself you''re trying to leave behind?'),
  ('deep', 'What''s a version of yourself you''re trying to become?'),
  ('deep', 'What do you think is the point of suffering, if there is one?'),
  ('deep', 'What''s something you learned from watching someone you love struggle?'),
  ('deep', 'What does it mean to you to be brave?'),
  ('deep', 'What''s a silence in your life you wish you could break?'),
  ('deep', 'What do you think you''ll regret not doing, if you never do it?'),
  ('deep', 'What''s something you need to let go of?'),
  ('deep', 'What do you think it means to really trust someone?'),
  ('deep', 'What''s a part of your story you rarely share?'),
  ('deep', 'What does peace feel like to you?'),
  ('deep', 'What''s something about mortality that changed how you live?'),
  ('deep', 'What do you hope I understand about you that I might not yet?'),
  ('spicy', 'What''s a fantasy of yours I don''t know about yet?'),
  ('spicy', 'Where''s the most unexpected place you''ve imagined being intimate with me?'),
  ('spicy', 'What''s something in bed you wish I''d initiate more often?'),
  ('spicy', 'What outfit — or lack of one — drives you crazy?'),
  ('spicy', 'What''s the boldest thing you''ve thought about doing with me but never said out loud?'),
  ('spicy', 'What''s something I do without realizing that turns you on?'),
  ('spicy', 'What''s the first thing you noticed about me physically that you were attracted to?'),
  ('spicy', 'What''s a place we''ve never been that you''d love to be intimate with me?'),
  ('spicy', 'What''s something you''d want to try together that we haven''t yet?'),
  ('spicy', 'What''s a memory of us together that still gets you thinking?'),
  ('spicy', 'What''s your favorite way for me to touch you?'),
  ('spicy', 'What''s something about my body you can''t stop thinking about?'),
  ('spicy', 'What''s a fantasy you''ve had about me that you''ve never shared?'),
  ('spicy', 'What''s the sexiest thing I could say to you right now?'),
  ('spicy', 'What''s something you love about the way I look at you?'),
  ('spicy', 'What''s a moment between us that you replay when we''re apart?'),
  ('spicy', 'What''s something you''d want me to do the moment we''re finally together again?'),
  ('spicy', 'What''s the most attracted to me you''ve ever felt?'),
  ('spicy', 'What''s a slow, quiet moment with me that turned you on unexpectedly?'),
  ('spicy', 'What''s something you find irresistible about how I move or talk?'),
  ('spicy', 'What''s a way you''d want to surprise me physically?'),
  ('spicy', 'What''s the boldest text you''ve ever wanted to send me but didn''t?'),
  ('spicy', 'What''s something you love about being desired by me?'),
  ('spicy', 'What''s a scenario you''ve imagined us in that you''ve never described?'),
  ('spicy', 'What''s your favorite way to be teased by me?'),
  ('spicy', 'What''s something about the distance between us that makes you crave me more?'),
  ('spicy', 'What''s a compliment about your body you''d want to hear from me?'),
  ('spicy', 'What''s the first thing you''d want when we''re finally in the same room again?'),
  ('spicy', 'What''s something about our chemistry that surprised you?'),
  ('spicy', 'What''s a way I make you feel wanted?'),
  ('spicy', 'What''s your idea of the perfect romantic and intimate night together?'),
  ('spicy', 'What''s something you love about how I make you feel desired?'),
  ('spicy', 'What''s a piece of clothing of mine you''d want to steal — and why?'),
  ('spicy', 'What''s something you''d whisper to me if no one else could hear?'),
  ('spicy', 'What''s a fantasy involving somewhere we''ve traveled or want to travel?'),
  ('spicy', 'What''s the most turned on you''ve been by something completely ordinary I did?'),
  ('spicy', 'What''s a way you''d want to be pursued by me?'),
  ('spicy', 'What''s something about anticipation that makes being apart from me exciting?'),
  ('spicy', 'What''s a physical trait of mine you find yourself staring at?'),
  ('spicy', 'What''s something you''d love for me to do the next time we say goodbye?'),
  ('spicy', 'What''s a way our video calls could get a little more interesting?'),
  ('spicy', 'What''s something you find confident and attractive about the way I carry myself?'),
  ('spicy', 'What''s a role or power dynamic between us you''ve thought about?'),
  ('spicy', 'What''s something you''d want to explore together that feels a little taboo?'),
  ('spicy', 'What''s the sexiest thing about our relationship that has nothing to do with looks?'),
  ('spicy', 'What''s a moment you felt most wanted by me?'),
  ('spicy', 'What''s something you''d want me to wear just for you?'),
  ('spicy', 'What''s a way you''d want to be surprised by me in the bedroom?'),
  ('spicy', 'What''s something about your own body you feel most confident about with me?'),
  ('spicy', 'What''s a fantasy you''d only ever tell me?'),
  ('spicy', 'What''s something about the way I kiss you that you love?'),
  ('spicy', 'What''s a way distance has made you more adventurous in your imagination?'),
  ('spicy', 'What''s something you''d want to do together the very first night we reunite?'),
  ('spicy', 'What''s a way you''d want me to take control?'),
  ('spicy', 'What''s something about vulnerability with me that turns you on?'),
  ('spicy', 'What''s a place in our home — or a future home — you''ve imagined us together?'),
  ('spicy', 'What''s something you find sexy about how I talk about you to others?'),
  ('spicy', 'What''s a way you''d want to seduce me if you had one shot?'),
  ('spicy', 'What''s something about trust that makes intimacy with me feel safer?'),
  ('spicy', 'What''s the one thing you want me to know about desiring you, right now?'),
  ('about_us', 'When do you feel most loved by me?'),
  ('about_us', 'What''s something I do that makes you feel safe?'),
  ('about_us', 'What''s your favorite memory of us so far?'),
  ('about_us', 'When did you know you were falling for me?'),
  ('about_us', 'What''s something about our relationship that surprised you?'),
  ('about_us', 'What do you think makes us work well together?'),
  ('about_us', 'What''s a small thing I do that you never get tired of?'),
  ('about_us', 'What''s something you''ve learned about love from being with me?'),
  ('about_us', 'What do you think is our biggest strength as a couple?'),
  ('about_us', 'What''s something we should do more of together?'),
  ('about_us', 'What''s a moment you felt closest to me?'),
  ('about_us', 'What do you think I don''t say enough?'),
  ('about_us', 'What''s something about me that made you laugh recently?'),
  ('about_us', 'What''s a challenge we''ve overcome that made us stronger?'),
  ('about_us', 'What do you imagine our life looking like in ten years?'),
  ('about_us', 'What''s something you appreciate about how I handle hard days?'),
  ('about_us', 'What''s a habit of mine you secretly love?'),
  ('about_us', 'What''s something you wish we talked about more?'),
  ('about_us', 'What do you think I bring out in you?'),
  ('about_us', 'What''s a moment you felt proud to be with me?'),
  ('about_us', 'What''s something I''ve said that stuck with you?'),
  ('about_us', 'What do you think has changed the most about us since we started?'),
  ('about_us', 'What''s a way I''ve supported you that meant more than I probably realized?'),
  ('about_us', 'What''s something about our long-distance relationship that''s made us stronger?'),
  ('about_us', 'What do you miss most about me when we''re apart?'),
  ('about_us', 'What''s a tradition you''d like us to start?'),
  ('about_us', 'What''s something you''ve never told me you noticed about me?'),
  ('about_us', 'What do you think makes our communication work?'),
  ('about_us', 'What''s a way I show love that''s different from how you expected?'),
  ('about_us', 'What''s something you look forward to when we''re finally in the same place?'),
  ('about_us', 'What''s a compliment you''ve wanted to give me but haven''t?'),
  ('about_us', 'What do you think I need to hear more often?'),
  ('about_us', 'What''s a memory of us you replay when you miss me?'),
  ('about_us', 'What''s something about the way I love you that feels unique?'),
  ('about_us', 'What do you think we''ve taught each other?'),
  ('about_us', 'What''s a fear about us you''ve never voiced?'),
  ('about_us', 'What''s something you''re excited to build with me?'),
  ('about_us', 'What do you think makes us different from other couples?'),
  ('about_us', 'What''s a way I''ve grown since being with you?'),
  ('about_us', 'What''s something small I do that means more than I know?'),
  ('about_us', 'What do you think our love looks like to other people?'),
  ('about_us', 'What''s a moment you felt truly understood by me?'),
  ('about_us', 'What''s something about my family or friends that''s grown on you?'),
  ('about_us', 'What do you think is the glue that holds us together?'),
  ('about_us', 'What''s a way you''d like us to grow together?'),
  ('about_us', 'What''s something about waiting for each other that''s taught you patience?'),
  ('about_us', 'What do you think I do differently than anyone else you''ve loved?'),
  ('about_us', 'What''s a promise you want us to keep making to each other?'),
  ('about_us', 'What''s something about our relationship you never want to change?'),
  ('about_us', 'What do you think we handle better now than when we started?'),
  ('about_us', 'What''s a moment you felt grateful to have chosen me?'),
  ('about_us', 'What''s something you''ve forgiven me for that you''ve never mentioned?'),
  ('about_us', 'What do you think makes you feel most secure with me?'),
  ('about_us', 'What''s a way I make the distance feel smaller?'),
  ('about_us', 'What''s something about "us" that still gives you butterflies?'),
  ('about_us', 'What do you think is the bravest thing about our relationship?'),
  ('about_us', 'What''s a dream you have for our future that you haven''t said out loud?'),
  ('about_us', 'What''s something you''d want me to know if you couldn''t tell me tomorrow?'),
  ('about_us', 'What do you think it means that we''ve chosen each other, over and over?'),
  ('about_us', 'What''s the thing about us you''re most looking forward to?'),
  ('hypothetical', 'If we could teleport anywhere right now for one day, where would we go?'),
  ('hypothetical', 'If you could swap lives with me for 24 hours, what''s the first thing you''d do?'),
  ('hypothetical', 'If we won the lottery tomorrow, what''s the first thing we''d do together?'),
  ('hypothetical', 'If you could have dinner with any three people, dead or alive, who would you pick?'),
  ('hypothetical', 'If we had to move to a different country tomorrow, where would you choose?'),
  ('hypothetical', 'If you could instantly master one skill, what would it be?'),
  ('hypothetical', 'If our relationship were a movie, what genre would it be?'),
  ('hypothetical', 'If you could relive one day of our relationship, which one would it be?'),
  ('hypothetical', 'If we could adopt any animal, real or fictional, what would it be?'),
  ('hypothetical', 'If you had to describe me as a weather pattern, what would I be?'),
  ('hypothetical', 'If we opened a business together, what would it be?'),
  ('hypothetical', 'If you could time travel to any point in our relationship, where would you go?'),
  ('hypothetical', 'If aliens landed tomorrow, what''s the first thing you''d want to show them about Earth?'),
  ('hypothetical', 'If you could only eat one meal for the rest of your life, what would it be?'),
  ('hypothetical', 'If we had to survive a zombie apocalypse together, what would our roles be?'),
  ('hypothetical', 'If you could give your younger self one piece of advice, what would it be?'),
  ('hypothetical', 'If our love story were a song, what would the title be?'),
  ('hypothetical', 'If you could live in any decade, which would you choose?'),
  ('hypothetical', 'If we could build our dream house anywhere, where would it be?'),
  ('hypothetical', 'If you had unlimited money for one day, what would you buy first?'),
  ('hypothetical', 'If you could be any fictional character for a week, who would you be?'),
  ('hypothetical', 'If we had a theme song that played every time we walked into a room, what would it be?'),
  ('hypothetical', 'If you could only communicate through movie quotes for a week, could you manage?'),
  ('hypothetical', 'If we started a band together, what would we call it?'),
  ('hypothetical', 'If you could trade places with any animal for a day, which would you pick?'),
  ('hypothetical', 'If we could time-skip to any future moment together, what would you choose?'),
  ('hypothetical', 'If you had to pick a superpower for me, what would it be?'),
  ('hypothetical', 'If we could only speak in questions for a day, how long would we last?'),
  ('hypothetical', 'If you were stranded on an island and could bring one person and three items, what would you bring?'),
  ('hypothetical', 'If our relationship had a mascot, what would it be?'),
  ('hypothetical', 'If you could redo our first date, what would you change?'),
  ('hypothetical', 'If we had to pick a new last name together, what would it be?'),
  ('hypothetical', 'If you could freeze time for one hour, what would you do with it?'),
  ('hypothetical', 'If we could visit any fictional world together, which would you pick?'),
  ('hypothetical', 'If you were a chef for a night, what would you cook for me?'),
  ('hypothetical', 'If our life were a video game, what would the current level be?'),
  ('hypothetical', 'If you had to give up one sense, which would you choose and why?'),
  ('hypothetical', 'If you could ask a future version of us one question, what would it be?'),
  ('hypothetical', 'If we swapped wardrobes for a day, what would you wear first?'),
  ('hypothetical', 'If you could invent one holiday just for us, what would it celebrate?'),
  ('hypothetical', 'If we had to solve a mystery together, what kind of detectives would we be?'),
  ('hypothetical', 'If you could hear one song for the very first time again, what would it be?'),
  ('hypothetical', 'If we could raise one mythical creature, what would it be?'),
  ('hypothetical', 'If you could pick our next adventure with no limits, what would it be?'),
  ('hypothetical', 'If we could only text each other in emojis for a week, would we survive?'),
  ('hypothetical', 'If you had to describe our relationship using a recipe, what would the ingredients be?'),
  ('hypothetical', 'If we found a time capsule from our future selves, what do you think would be inside?'),
  ('hypothetical', 'If you could learn any language overnight, which would you pick?'),
  ('hypothetical', 'If we had a couple''s talent show act, what would we perform?'),
  ('hypothetical', 'If you could design a theme park ride based on us, what would it feel like?'),
  ('hypothetical', 'If we could live inside any TV show for a season, which would you choose?'),
  ('hypothetical', 'If you had to pick a nickname for me based on today, what would it be?'),
  ('hypothetical', 'If we could throw the most extravagant party with no budget, what would it look like?'),
  ('hypothetical', 'If you could only watch one movie together for the rest of your life, what would it be?'),
  ('hypothetical', 'If we had to communicate for a week through interpretive dance, how would that go?'),
  ('hypothetical', 'If you could gift me any experience, what would it be?'),
  ('hypothetical', 'If we became famous overnight, what would we be famous for?'),
  ('hypothetical', 'If you could plan the most spontaneous trip for us right now, where would we go?'),
  ('hypothetical', 'If our relationship had a motto, what would it say?'),
  ('hypothetical', 'If you could ask me to do one silly thing right now, what would it be?'),
  ('fun', 'What''s your go-to order when you can''t decide what to eat?'),
  ('fun', 'What''s a song that instantly puts you in a good mood?'),
  ('fun', 'What''s your comfort movie you could watch a hundred times?'),
  ('fun', 'What''s the weirdest food combination you actually enjoy?'),
  ('fun', 'What''s your favorite way to waste an afternoon?'),
  ('fun', 'What''s a snack you could never say no to?'),
  ('fun', 'What''s the last thing that made you laugh out loud?'),
  ('fun', 'What''s your go-to karaoke song?'),
  ('fun', 'What''s a smell that instantly makes you happy?'),
  ('fun', 'What''s your favorite season and why?'),
  ('fun', 'What''s a show you''ve rewatched more times than you''d admit?'),
  ('fun', 'What''s your ideal lazy Sunday?'),
  ('fun', 'What''s a food you refuse to eat, no matter what?'),
  ('fun', 'What''s your favorite thing to do when it rains?'),
  ('fun', 'What''s the best gift you''ve ever received?'),
  ('fun', 'What''s an app you can''t live without?'),
  ('fun', 'What''s your go-to comfort food when you''re sad?'),
  ('fun', 'What''s the last song stuck in your head?'),
  ('fun', 'What''s your favorite thing about mornings?'),
  ('fun', 'What''s your favorite thing about nights?'),
  ('fun', 'What''s a hobby you''d love to pick up if you had time?'),
  ('fun', 'What''s the funniest thing that''s happened to you this year?'),
  ('fun', 'What''s your ideal way to spend a birthday?'),
  ('fun', 'What''s your favorite kind of dessert?'),
  ('fun', 'What''s a childhood snack you still love?'),
  ('fun', 'What''s your go-to drink order?'),
  ('fun', 'What''s your favorite thing to do on vacation?'),
  ('fun', 'What''s a game you''re weirdly competitive about?'),
  ('fun', 'What''s your favorite way to relax after a long day?'),
  ('fun', 'What''s a movie that always makes you cry, happy or sad?'),
  ('fun', 'What''s your dream road trip playlist made of?'),
  ('fun', 'What''s the best meal you''ve ever had?'),
  ('fun', 'What''s a trend you''re kind of embarrassed you were into?'),
  ('fun', 'What''s your favorite holiday and why?'),
  ('fun', 'What''s a small thing that instantly boosts your mood?'),
  ('fun', 'What''s your ideal pizza topping combo?'),
  ('fun', 'What''s the most spontaneous thing you''ve ever done?'),
  ('fun', 'What''s your favorite way to celebrate good news?'),
  ('fun', 'What''s a book or show you''d recommend to everyone?'),
  ('fun', 'What''s your go-to excuse to eat dessert first?'),
  ('fun', 'What''s the silliest thing you believed as a kid?'),
  ('fun', 'What''s your favorite kind of weather?'),
  ('fun', 'What''s a skill you''re weirdly proud of?'),
  ('fun', 'What''s your favorite way to spend a rainy afternoon indoors?'),
  ('fun', 'What''s the best concert or show you''ve been to?'),
  ('fun', 'What''s your go-to dance move, be honest?'),
  ('fun', 'What''s your favorite thing to bake or cook?'),
  ('fun', 'What''s a candy you always steal from the Halloween bowl?'),
  ('fun', 'What''s your favorite ice cream flavor?'),
  ('fun', 'What''s the most useless talent you have?'),
  ('fun', 'What''s your favorite way to procrastinate?'),
  ('fun', 'What''s your go-to breakfast on a good morning?'),
  ('fun', 'What''s a cartoon or animated movie you still love?'),
  ('fun', 'What''s your favorite thing about your daily routine?'),
  ('fun', 'What''s a nostalgic toy or game from your childhood?'),
  ('fun', 'What''s your ideal soundtrack for cooking dinner?'),
  ('fun', 'What''s the best nap you''ve ever had?'),
  ('fun', 'What''s a food you could eat every single day?'),
  ('fun', 'What''s your favorite thing to do with a free afternoon and no plans?'),
  ('fun', 'What''s the last thing you googled that made you laugh?');

