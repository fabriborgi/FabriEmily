# F2 — Motore realtime dei giochi · Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le due persone giocano a Tris in modo asincrono — chi inizia una partita muove per primo, l'altro risponde quando può, il turno gira finché qualcuno vince o pareggia, le monete si accreditano da sole. Il motore (`game_matches`, `create_match`, `make_move`) è generico e pronto per accogliere altri giochi in F3 senza essere toccato.

**Architecture:** Una tabella (`game_matches`) e due funzioni Postgres `security definer` (`create_match`, `make_move`) che sono l'unica via di scrittura, esattamente come in F0+F1/F5/F6. Il client calcola le regole del gioco (mosse legali, vittoria, pareggio) e dichiara il risultato al server, che si fida del contenuto ma applica rigidamente turni e monete — stesso principio già usato per il contenuto di lettere e domande. Il frontend separa nettamente `features/games/` (motore generico) da `features/games/ticTacToe/` (le regole del Tris), cosicché F3 possa aggiungere un gioco nuovo senza toccare il motore.

**Tech Stack:** Stesso di F0+F1/F5/F6 — Next.js App Router, TypeScript strict, `@supabase/supabase-js`, Vitest (unit in jsdom, integrazione contro Supabase locale).

**Spec di riferimento:** [`docs/superpowers/specs/2026-08-18-f2-motore-giochi-design.md`](../specs/2026-08-18-f2-motore-giochi-design.md)

**Branch:** nuovo branch da `main` (che contiene già F0+F1, F5 e F6 in produzione), in un worktree isolato

## Global Constraints

- Lingua dell'interfaccia: inglese. Commenti e documentazione in italiano.
- Mobile-first, viewport di riferimento 390 × 844 px. Ogni target di tocco almeno 44 × 44 px.
- Nessuna scrittura diretta dal client: solo `.select()` e `.rpc()`.
- Nessun colore letterale nei componenti: solo variabili CSS già definite in `app/globals.css` (i temi di F6 devono continuare a valere anche qui).
- TypeScript strict: nessun `any` implicito, nessun `@ts-ignore`.
- Ogni funzione Postgres nasce **senza** privilegio di esecuzione per nessuno: ogni funzione richiede il proprio `grant execute ... to authenticated` esplicito.
- Dopo ogni migrazione che aggiunge tabelle o funzioni, rigenerare `lib/types.ts` con `npm run db:types` e includerlo nel commit.
- Commit dopo ogni task, messaggio in italiano, prefisso convenzionale (`feat:`, `test:`, `fix:`).
- Le monete usano le regole `game_win`/`game_draw`/`game_loss` già seminate in F0+F1 (`coin_rules`: 20/10/5 monete, nessun tetto giornaliero) — nessun nuovo valore economico da inserire.
- I parametri RPC opzionali con default nel database (`p_result`, `p_winner`) vanno passati come `undefined`, mai `null` — lezione da F5: i tipi generati li tipano come proprietà opzionale (`?`), non nullable.

## Mappa dei file

**Database (Task 1–3):**

| File | Responsabilità |
|---|---|
| `supabase/migrations/20260820090000_game_matches_schema.sql` | Enum `game_type`, tabella `game_matches`, indice unico parziale, RLS, grant, pubblicazione realtime |
| `supabase/migrations/20260820091000_create_match.sql` | Funzione `create_match` |
| `supabase/migrations/20260820092000_make_move.sql` | Funzione `make_move`, con lock contro mosse quasi simultanee |
| `supabase/tests/helpers.ts` | Modificato: `resetData()` pulisce anche `game_matches` |
| `supabase/tests/game_matches_schema.test.ts` | Vincoli, RLS, privilegi, pubblicazione realtime |
| `supabase/tests/create_match.test.ts` | Assegnazione del turno, `match_already_open`, concorrenza |
| `supabase/tests/make_move.test.ts` | Turno, chiusura su vittoria/pareggio, monete, lock contro mosse quasi simultanee |

**Frontend — livello dati (Task 4):**

| File | Responsabilità |
|---|---|
| `features/games/types.ts` | `GameType`, `Match` — fonte unica, consumata da tutto il resto |
| `features/games/queries.ts` | Query dirette + wrapper delle due RPC + `fetchHistoryTally` |
| `features/games/useActiveMatch.ts` | Hook realtime sulla partita aperta di un gioco |
| `features/games/useGameHistory.ts` | Hook realtime sul conteggio vittorie/pareggi |
| `supabase/tests/games_queries.test.ts` | Integrazione: nomi dei parametri, turno, chiusura, conteggio |
| `lib/rpc.ts` | Modificato: nuovi codici di errore tradotti |

**Frontend — regole del Tris (Task 5):**

| File | Responsabilità |
|---|---|
| `features/games/ticTacToe/board.ts` | Logica pura: mosse legali, rilevamento vittoria/pareggio |
| `features/games/ticTacToe/board.test.ts` | Unit |

**Frontend — schermata di gioco (Task 6):**

| File | Responsabilità |
|---|---|
| `features/games/games.module.css` | Stili condivisi di motore e Tris |
| `features/games/MatchStatus.tsx` | "Your turn" / "Waiting for ..." — generico, riusabile da ogni gioco |
| `features/games/MatchStatus.test.tsx` | Unit |
| `features/games/ticTacToe/TicTacToeBoard.tsx` | La griglia, l'avvio partita, il tally, l'invio delle mosse |
| `features/games/ticTacToe/TicTacToeBoard.test.tsx` | Unit |
| `app/games/tic-tac-toe/page.tsx` | La schermata di gioco |
| `app/games/tic-tac-toe/page.test.tsx` | Unit |

**Frontend — elenco giochi (Task 7):**

| File | Responsabilità |
|---|---|
| `app/games/page.tsx` | Sostituisce il segnaposto: Tic-tac-toe giocabile, gli altri "coming soon" |
| `app/games/page.test.tsx` | Unit |

---

### Task 1: Schema, RLS e Realtime

**Files:**
- Create: `supabase/migrations/20260820090000_game_matches_schema.sql`
- Create: `supabase/tests/game_matches_schema.test.ts`
- Modify: `supabase/tests/helpers.ts`

**Interfaces:**
- Consumes: tabelle e funzioni di F0+F1 (`person` enum), pattern di RLS/default-privileges già impostato.
- Produces: tipo `game_type`, tabella `game_matches`. `resetData()` estesa.

- [ ] **Step 1: Estendi `resetData()` per includere la nuova tabella**

In `supabase/tests/helpers.ts`, sostituisci il corpo di `resetData`:

```ts
export async function resetData(): Promise<void> {
  await sql(`
    delete from game_matches;
    delete from question_answers;
    delete from question_rounds;
    delete from owned_items;
    truncate coin_ledger restart identity;
    delete from letters;
    update couple_state set coins = 0, theme = 'default' where id = 1;
  `);
}
```

- [ ] **Step 2: Scrivi i test che devono fallire**

`supabase/tests/game_matches_schema.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, anonClient, resetData } from './helpers';

beforeEach(resetData);

const insertMatch = async (closed = false) => {
  const rows = await sql<{ id: string }>(
    `insert into game_matches (game_type, state, started_by, current_turn, closed_at, winner)
     values ('tic_tac_toe', '{"cells":[null,null,null,null,null,null,null,null,null]}', 'fabrizio', 'fabrizio',
             case when $1 then now() else null end,
             case when $1 then 'fabrizio' else null end)
     returning id`,
    [closed],
  );
  return rows[0].id;
};

describe('schema game_matches — vincoli e permessi', () => {
  it('impedisce una seconda partita aperta dello stesso gioco', async () => {
    await insertMatch();
    await expect(insertMatch()).rejects.toThrow(/one_open_match_per_game/);
  });

  it('permette molte partite chiuse dello stesso gioco', async () => {
    await insertMatch(true);
    await expect(insertMatch(true)).resolves.toBeDefined();
  });

  it('un client autenticato legge le partite', async () => {
    await insertMatch();
    const client = await signedInClient();
    const { data, error } = await client.from('game_matches').select('id');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('un client anonimo NON legge le partite', async () => {
    await insertMatch();
    const { data, error } = await anonClient().from('game_matches').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error ?? { message: '' }).toBeTruthy();
  });

  it('un client autenticato NON scrive direttamente', async () => {
    const client = await signedInClient();
    const { error } = await client.from('game_matches').insert({
      game_type: 'tic_tac_toe',
      state: {},
      started_by: 'fabrizio',
      current_turn: 'fabrizio',
    });
    expect(error).not.toBeNull();
  });

  it('game_matches è pubblicata su Realtime', async () => {
    const rows = await sql<{ tablename: string }>(`
      select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'game_matches'
    `);
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Esegui e verifica che falliscano**

Run: `npm run test:int -- game_matches_schema`
Expected: FAIL — `relation "game_matches" does not exist`.

- [ ] **Step 4: Scrivi la migrazione**

```sql
-- F3 aggiunge altri valori con ALTER TYPE game_type ADD VALUE.
create type game_type as enum ('tic_tac_toe');

create table game_matches (
  id           uuid primary key default gen_random_uuid(),
  game_type    game_type not null,
  state        jsonb not null,
  started_by   person not null,
  current_turn person not null,
  winner       person null,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz null
);

-- Una partita aperta alla volta PER GIOCO: indice unico parziale sulla
-- colonna game_type stessa — più diretto del trucco "((true))" di F5, qui
-- esiste una chiave naturale su cui partizionare il vincolo.
create unique index one_open_match_per_game on game_matches (game_type) where closed_at is null;

grant select on game_matches to authenticated;
alter table game_matches enable row level security;
create policy read_for_authenticated on game_matches for select to authenticated using (true);

alter publication supabase_realtime add table game_matches;
```

- [ ] **Step 5: Applica e verifica che i test passino**

Run: `npm run db:reset && npm run test:int -- game_matches_schema`
Expected: 6 test PASS.

- [ ] **Step 6: Rigenera i tipi**

Run: `npm run db:types`

- [ ] **Step 7: Verifica che il resto della suite sia ancora verde**

Run: `npm run test:int`
Expected: tutti i test PASS. Nessuna regressione dovuta a `resetData()` modificata.

- [ ] **Step 8: Commit**

```bash
git add supabase lib/types.ts
git commit -m "feat: schema del motore giochi, una partita aperta per gioco"
```

### Task 2: `create_match`

**Files:**
- Create: `supabase/migrations/20260820091000_create_match.sql`
- Create: `supabase/tests/create_match.test.ts`

**Interfaces:**
- Consumes: tabella `game_matches` (Task 1).
- Produces: `create_match(p_game_type game_type, p_person person, p_initial_state jsonb) returns game_matches`. Chiamata dal client nel Task 4.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/create_match.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';

beforeEach(resetData);

const EMPTY = { cells: [null, null, null, null, null, null, null, null, null] };

const create = async (person: string, gameType = 'tic_tac_toe') =>
  (
    await sql<{ id: string; current_turn: string; started_by: string }>(
      `select * from create_match($1::game_type, $2::person, $3)`,
      [gameType, person, JSON.stringify(EMPTY)],
    )
  )[0];

describe('create_match', () => {
  it('apre una partita con current_turn su chi la avvia', async () => {
    const match = await create('fabrizio');
    expect(match.started_by).toBe('fabrizio');
    expect(match.current_turn).toBe('fabrizio');
  });

  it('rifiuta una seconda partita aperta dello stesso gioco', async () => {
    await create('fabrizio');
    await expect(create('emily')).rejects.toThrow(/match_already_open/);
  });

  it('permette di aprirne una nuova dopo che la precedente si è chiusa', async () => {
    const first = await create('fabrizio');
    await sql(`update game_matches set closed_at = now() where id = $1`, [first.id]);
    await expect(create('emily')).resolves.toBeDefined();
  });

  it('due aperture concorrenti dello stesso gioco: una sola riesce', async () => {
    const clientA = await signedInClient();
    const clientB = await signedInClient();
    await clientA.from('game_matches').select('id').limit(1);
    await clientB.from('game_matches').select('id').limit(1);

    const [a, b] = await Promise.all([
      clientA.rpc('create_match', {
        p_game_type: 'tic_tac_toe',
        p_person: 'fabrizio',
        p_initial_state: EMPTY,
      }),
      clientB.rpc('create_match', {
        p_game_type: 'tic_tac_toe',
        p_person: 'emily',
        p_initial_state: EMPTY,
      }),
    ]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/match_already_open/);

    const openMatches = await sql('select 1 from game_matches where closed_at is null');
    expect(openMatches).toHaveLength(1);
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.create_match(game_type, person, jsonb)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.create_match(game_type, person, jsonb)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npm run test:int -- create_match`
Expected: FAIL — `function create_match(game_type, person, jsonb) does not exist`.

- [ ] **Step 3: Scrivi la migrazione**

```sql
-- Apre una nuova partita con lo stato iniziale passato dal client e chi la
-- avvia già al turno. La protezione contro due aperture concorrenti dello
-- stesso gioco è l'indice unico su game_matches (Task 1): non c'è bisogno di
-- un controllo separato, la violazione stessa è il segnale.
create or replace function create_match(
  p_game_type      game_type,
  p_person         person,
  p_initial_state  jsonb
) returns game_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match game_matches;
begin
  begin
    insert into game_matches (game_type, state, started_by, current_turn)
    values (p_game_type, p_initial_state, p_person, p_person)
    returning * into v_match;
  exception when unique_violation then
    raise exception 'match_already_open';
  end;

  return v_match;
end
$$;

revoke all on function create_match(game_type, person, jsonb) from public, anon;
grant execute on function create_match(game_type, person, jsonb) to authenticated;
```

- [ ] **Step 4: Applica e verifica**

Run: `npm run db:reset && npm run test:int -- create_match`
Expected: 5 test PASS.

Il test di concorrenza va eseguito più volte di seguito per escludere intermittenza:

Run: `for i in 1 2 3 4 5; do npm run test:int -- create_match || break; done`
Expected: 5/5 esecuzioni verdi.

- [ ] **Step 5: Rigenera i tipi**

Run: `npm run db:types`

- [ ] **Step 6: Commit**

```bash
git add supabase lib/types.ts
git commit -m "feat: create_match, una partita aperta per gioco con concorrenza sicura"
```

### Task 3: `make_move`

**Files:**
- Create: `supabase/migrations/20260820092000_make_move.sql`
- Create: `supabase/tests/make_move.test.ts`

**Interfaces:**
- Consumes: `create_match` (Task 2), `grant_coins` (F0+F1), tabella `game_matches` (Task 1).
- Produces: `make_move(p_match_id uuid, p_person person, p_state jsonb, p_result text default null, p_winner person default null) returns game_matches`. Chiamata dal client nel Task 4.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/make_move.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';

beforeEach(resetData);

const EMPTY = { cells: [null, null, null, null, null, null, null, null, null] };

const openMatch = async (starter = 'fabrizio') =>
  (
    await sql<{ id: string }>(`select * from create_match('tic_tac_toe'::game_type, $1::person, $2)`, [
      starter,
      JSON.stringify(EMPTY),
    ])
  )[0].id;

const move = async (
  matchId: string,
  person: string,
  state: unknown,
  result: string | null = null,
  winner: string | null = null,
) =>
  (
    await sql<{ current_turn: string; closed_at: string | null; winner: string | null }>(
      `select * from make_move($1::uuid, $2::person, $3, $4, $5::person)`,
      [matchId, person, JSON.stringify(state), result, winner],
    )
  )[0];

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

describe('make_move', () => {
  it('rifiuta una mossa fuori turno', async () => {
    const matchId = await openMatch('fabrizio');
    await expect(move(matchId, 'emily', { cells: [...EMPTY.cells] })).rejects.toThrow(/not_your_turn/);
  });

  it('rifiuta una mossa su una partita chiusa', async () => {
    const matchId = await openMatch('fabrizio');
    await sql(`update game_matches set closed_at = now() where id = $1`, [matchId]);
    await expect(move(matchId, 'fabrizio', { cells: [...EMPTY.cells] })).rejects.toThrow(
      /match_already_closed/,
    );
  });

  it('una mossa senza risultato gira il turno e lascia la partita aperta', async () => {
    const matchId = await openMatch('fabrizio');
    const state = { cells: ['fabrizio', null, null, null, null, null, null, null, null] };
    const result = await move(matchId, 'fabrizio', state);
    expect(result.current_turn).toBe('emily');
    expect(result.closed_at).toBeNull();
  });

  it('un risultato "win" chiude la partita e accredita 20 monete al vincitore e 5 al perdente', async () => {
    const matchId = await openMatch('fabrizio');
    const winning = { cells: ['fabrizio', 'fabrizio', 'fabrizio', null, null, null, null, null, null] };
    const result = await move(matchId, 'fabrizio', winning, 'win', 'fabrizio');
    expect(result.closed_at).not.toBeNull();
    expect(result.winner).toBe('fabrizio');
    expect(await coins()).toBe(25);
  });

  it('un risultato "draw" chiude la partita senza vincitore e accredita 10 monete a entrambi', async () => {
    const matchId = await openMatch('fabrizio');
    const drawn = {
      cells: ['fabrizio', 'emily', 'fabrizio', 'fabrizio', 'emily', 'emily', 'emily', 'fabrizio', 'fabrizio'],
    };
    const result = await move(matchId, 'fabrizio', drawn, 'draw');
    expect(result.closed_at).not.toBeNull();
    expect(result.winner).toBeNull();
    expect(await coins()).toBe(20);
  });

  it('un id inesistente è trattato come partita chiusa', async () => {
    await expect(
      move('00000000-0000-0000-0000-000000000000', 'fabrizio', EMPTY),
    ).rejects.toThrow(/match_already_closed/);
  });

  it('due mosse quasi simultanee della stessa persona: una sola passa', async () => {
    // Senza il lock, due richieste ravvicinate della stessa persona (un
    // doppio tocco che elude la guardia sincrona del client) potrebbero
    // entrambe leggere current_turn come proprio e passare il controllo,
    // applicando due mosse di fila per la stessa persona. Il lock serializza:
    // la seconda rilegge il turno già girato e riceve not_your_turn.
    const matchId = await openMatch('fabrizio');
    const clientA = await signedInClient();
    const clientB = await signedInClient();
    await clientA.from('game_matches').select('id').limit(1);
    await clientB.from('game_matches').select('id').limit(1);

    const [a, b] = await Promise.all([
      clientA.rpc('make_move', {
        p_match_id: matchId,
        p_person: 'fabrizio',
        p_state: { cells: ['fabrizio', null, null, null, null, null, null, null, null] },
      }),
      clientB.rpc('make_move', {
        p_match_id: matchId,
        p_person: 'fabrizio',
        p_state: { cells: [null, 'fabrizio', null, null, null, null, null, null, null] },
      }),
    ]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/not_your_turn/);
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.make_move(uuid, person, jsonb, text, person)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.make_move(uuid, person, jsonb, text, person)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npm run test:int -- make_move`
Expected: FAIL — `function make_move(uuid, person, jsonb, text, person) does not exist`.

- [ ] **Step 3: Scrivi la migrazione**

```sql
-- Applica una mossa, gira il turno, e chiude la partita se il client
-- dichiara un risultato. Il client calcola le regole del gioco (mossa
-- legale, vittoria, pareggio) — qui si applicano solo turni, chiusura e
-- monete, mai la correttezza delle regole di un gioco specifico.
--
-- Il "for update" PRIMA di leggere qualunque cosa è ciò che rende sicura la
-- funzione sotto due richieste quasi simultanee della stessa persona (un
-- doppio tocco che elude la guardia sincrona del client): senza, entrambe le
-- transazioni potrebbero leggere lo stesso current_turn e passare il
-- controllo, applicando due mosse di fila. Stesso principio del lock in
-- answer_question/spend_coins.
create or replace function make_move(
  p_match_id uuid,
  p_person   person,
  p_state    jsonb,
  p_result   text   default null,
  p_winner   person default null
) returns game_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match game_matches;
begin
  select * into v_match
  from game_matches
  where id = p_match_id and closed_at is null
  for update;

  if v_match.id is null then
    raise exception 'match_already_closed';
  end if;

  if v_match.current_turn <> p_person then
    raise exception 'not_your_turn';
  end if;

  update game_matches
     set state        = p_state,
         current_turn = case when p_person = 'fabrizio' then 'emily' else 'fabrizio' end,
         closed_at    = case when p_result is not null then now() else null end,
         winner       = case when p_result = 'win' then p_winner else null end
   where id = p_match_id
  returning * into v_match;

  if p_result = 'win' then
    perform grant_coins(p_winner, 'game_win', p_match_id, 0);
    perform grant_coins(
      case when p_winner = 'fabrizio' then 'emily' else 'fabrizio' end,
      'game_loss', p_match_id, 0
    );
  elsif p_result = 'draw' then
    perform grant_coins('fabrizio', 'game_draw', p_match_id, 0);
    perform grant_coins('emily', 'game_draw', p_match_id, 0);
  end if;

  return v_match;
end
$$;

revoke all on function make_move(uuid, person, jsonb, text, person) from public, anon;
grant execute on function make_move(uuid, person, jsonb, text, person) to authenticated;
```

- [ ] **Step 4: Applica e verifica**

Run: `npm run db:reset && npm run test:int -- make_move`
Expected: 8 test PASS.

Il test di concorrenza va eseguito più volte per escludere intermittenza:

Run: `for i in 1 2 3 4 5; do npm run test:int -- make_move || break; done`
Expected: 5/5 esecuzioni verdi.

- [ ] **Step 5: Verifica l'intera suite di integrazione fin qui**

Run: `npm run test:int`
Expected: tutti i test PASS.

- [ ] **Step 6: Rigenera i tipi**

Run: `npm run db:types`

- [ ] **Step 7: Commit**

```bash
git add supabase lib/types.ts
git commit -m "feat: make_move con lock contro mosse quasi simultanee"
```

### Task 4: Livello dati del frontend

**Files:**
- Create: `features/games/types.ts`
- Create: `features/games/queries.ts`
- Create: `features/games/useActiveMatch.ts`
- Create: `features/games/useGameHistory.ts`
- Create: `supabase/tests/games_queries.test.ts`
- Modify: `lib/rpc.ts`

**Interfaces:**
- Consumes: `create_match`/`make_move` (Task 2–3), tabella `game_matches` (Task 1).
- Produces: `GameType`, `Match`, `GameTally` (tipi). `fetchActiveMatch(gameType, client?)`, `fetchHistoryTally(gameType, client?)`, `createMatch(gameType, person, initialState, client?)`, `makeMove(matchId, person, state, result, winner, client?)`. `useActiveMatch(gameType, options?)`, `useGameHistory(gameType, options?)`. Consumati dal Task 6.

- [ ] **Step 1: Aggiungi i nuovi codici di errore a `lib/rpc.ts`**

Nell'array `MESSAGES` di `lib/rpc.ts`, aggiungi tre righe (l'ordine non conta, il resto del file non cambia):

```ts
  ['match_already_open', "There's already a game waiting for a move."],
  ['not_your_turn', "It's not your turn yet."],
  ['match_already_closed', 'That game already ended. Refreshing…'],
```

- [ ] **Step 2: Scrivi `features/games/types.ts`**

```ts
import type { Person } from '@/features/auth/identity';

export type GameType = 'tic_tac_toe';

export type Match = {
  id: string;
  game_type: GameType;
  state: unknown; // ogni gioco lo restringe al proprio formato (vedi board.ts per il Tris)
  started_by: Person;
  current_turn: Person;
  winner: Person | null;
  created_at: string;
  closed_at: string | null;
};

export type GameTally = { fabrizio: number; emily: number; draws: number };
```

- [ ] **Step 3: Scrivi `features/games/queries.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database } from '@/lib/types';
import type { Person } from '@/features/auth/identity';
import type { GameType, Match, GameTally } from './types';

type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

const COLUMNS = 'id, game_type, state, started_by, current_turn, winner, created_at, closed_at';

/** La partita aperta di quel gioco, se esiste. */
export async function fetchActiveMatch(gameType: GameType, client?: Client): Promise<Match | null> {
  const { data, error } = await db(client)
    .from('game_matches')
    .select(COLUMNS)
    .eq('game_type', gameType)
    .is('closed_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Match | null;
}

/** Vittorie/pareggi di quel gioco, contati sulle partite chiuse — nessuna tabella di riepilogo da tenere sincronizzata. */
export async function fetchHistoryTally(gameType: GameType, client?: Client): Promise<GameTally> {
  const { data, error } = await db(client)
    .from('game_matches')
    .select('winner')
    .eq('game_type', gameType)
    .not('closed_at', 'is', null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ winner: Person | null }>;
  return {
    fabrizio: rows.filter((r) => r.winner === 'fabrizio').length,
    emily: rows.filter((r) => r.winner === 'emily').length,
    draws: rows.filter((r) => r.winner === null).length,
  };
}

export async function createMatch(
  gameType: GameType,
  person: Person,
  initialState: unknown,
  client?: Client,
) {
  return call<Match>(
    db(client)
      .rpc('create_match', { p_game_type: gameType, p_person: person, p_initial_state: initialState })
      .single(),
  );
}

export async function makeMove(
  matchId: string,
  person: Person,
  state: unknown,
  result: 'win' | 'draw' | null,
  winner: Person | null,
  client?: Client,
) {
  // p_result/p_winner sono parametri opzionali con default nel database: i
  // tipi generati li tipano come `?` (assente o valore valido), non
  // nullable — stessa lezione di F5, `null` esplicito viola il tipo.
  return call<Match>(
    db(client)
      .rpc('make_move', {
        p_match_id: matchId,
        p_person: person,
        p_state: state,
        p_result: result ?? undefined,
        p_winner: winner ?? undefined,
      })
      .single(),
  );
}
```

- [ ] **Step 4: Scrivi `features/games/useActiveMatch.ts`**

```ts
'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchActiveMatch } from './queries';
import type { GameType, Match } from './types';

export function useActiveMatch(gameType: GameType, options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<Match | null>({
    tables: ['game_matches'],
    client: options.client,
    fetcher: () => fetchActiveMatch(gameType, options.client),
  });
}
```

- [ ] **Step 5: Scrivi `features/games/useGameHistory.ts`**

```ts
'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchHistoryTally } from './queries';
import type { GameType, GameTally } from './types';

export function useGameHistory(gameType: GameType, options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<GameTally>({
    tables: ['game_matches'],
    client: options.client,
    fetcher: () => fetchHistoryTally(gameType, options.client),
  });
}
```

- [ ] **Step 6: Scrivi il test di integrazione contro il database reale**

`supabase/tests/games_queries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { signedInClient, resetData } from './helpers';
import { fetchActiveMatch, fetchHistoryTally, createMatch, makeMove } from '@/features/games/queries';

const EMPTY = { cells: [null, null, null, null, null, null, null, null, null] };

beforeEach(resetData);

describe('queries dei giochi contro il database reale', () => {
  it('senza partita attiva, fetchActiveMatch ritorna null', async () => {
    const client = await signedInClient();
    expect(await fetchActiveMatch('tic_tac_toe', client)).toBeNull();
  });

  it('createMatch apre una partita con current_turn su chi la avvia', async () => {
    const client = await signedInClient();
    const { data, error } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    expect(error).toBeNull();
    expect(data?.current_turn).toBe('fabrizio');
    const active = await fetchActiveMatch('tic_tac_toe', client);
    expect(active?.id).toBe(data?.id);
  });

  it("makeMove gira il turno senza chiudere la partita se non c'è un risultato", async () => {
    const client = await signedInClient();
    const { data: match } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    const { data: moved, error } = await makeMove(
      match!.id,
      'fabrizio',
      { cells: ['fabrizio', null, null, null, null, null, null, null, null] },
      null,
      null,
      client,
    );
    expect(error).toBeNull();
    expect(moved?.current_turn).toBe('emily');
    expect(moved?.closed_at).toBeNull();
  });

  it("makeMove traduce l'errore di una mossa fuori turno", async () => {
    const client = await signedInClient();
    const { data: match } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    const { data, error } = await makeMove(
      match!.id,
      'emily',
      { cells: [null, 'emily', null, null, null, null, null, null, null] },
      null,
      null,
      client,
    );
    expect(data).toBeNull();
    expect(error).toBe("It's not your turn yet.");
  });

  it('fetchHistoryTally conta vittorie e pareggi dopo la chiusura', async () => {
    const client = await signedInClient();
    const { data: match } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    await makeMove(
      match!.id,
      'fabrizio',
      { cells: ['fabrizio', 'fabrizio', 'fabrizio', null, null, null, null, null, null] },
      'win',
      'fabrizio',
      client,
    );
    const tally = await fetchHistoryTally('tic_tac_toe', client);
    expect(tally).toEqual({ fabrizio: 1, emily: 0, draws: 0 });
  });
});
```

- [ ] **Step 7: Esegui e verifica**

Run: `npm run test:int -- games_queries`
Expected: 5 test PASS.

- [ ] **Step 8: Verifica l'intera suite (unit + integrazione)**

Run: `npm run test && npm run test:int`
Expected: tutti i test PASS.

- [ ] **Step 9: Commit**

```bash
git add features/games/types.ts features/games/queries.ts features/games/useActiveMatch.ts features/games/useGameHistory.ts supabase/tests/games_queries.test.ts lib/rpc.ts
git commit -m "feat: livello dati del motore giochi, query e hook realtime"
```

### Task 5: Le regole del Tris

**Files:**
- Create: `features/games/ticTacToe/board.ts`
- Create: `features/games/ticTacToe/board.test.ts`

**Interfaces:**
- Consumes: `Person` (F0+F1).
- Produces: `BoardState` (tipo), `EMPTY_BOARD`, `isLegalMove(state, index)`, `applyMove(state, index, mark)`, `winnerOf(state)`, `isDraw(state)`. Consumati dal Task 6.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/games/ticTacToe/board.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EMPTY_BOARD, isLegalMove, applyMove, winnerOf, isDraw, type BoardState } from './board';

type Mark = 'fabrizio' | 'emily' | null;
const cells = (...marks: Mark[]): BoardState => ({ cells: marks });

describe('board del Tris', () => {
  it('una cella vuota è una mossa legale', () => {
    expect(isLegalMove(EMPTY_BOARD, 4)).toBe(true);
  });

  it('una cella occupata non è una mossa legale', () => {
    const state = applyMove(EMPTY_BOARD, 0, 'fabrizio');
    expect(isLegalMove(state, 0)).toBe(false);
  });

  it('un indice fuori dai limiti non è una mossa legale', () => {
    expect(isLegalMove(EMPTY_BOARD, 9)).toBe(false);
    expect(isLegalMove(EMPTY_BOARD, -1)).toBe(false);
  });

  it('applyMove non muta lo stato originale', () => {
    const next = applyMove(EMPTY_BOARD, 0, 'fabrizio');
    expect(EMPTY_BOARD.cells[0]).toBeNull();
    expect(next.cells[0]).toBe('fabrizio');
  });

  it('riconosce la vittoria su tutte le otto combinazioni possibili', () => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const line of lines) {
      const marks: Mark[] = Array(9).fill(null);
      for (const i of line) marks[i] = 'emily';
      expect(winnerOf(cells(...marks))).toBe('emily');
    }
  });

  it('nessun vincitore su una griglia vuota', () => {
    expect(winnerOf(EMPTY_BOARD)).toBeNull();
  });

  it('nessun vincitore su una griglia parziale senza allineamenti', () => {
    expect(
      winnerOf(cells('fabrizio', 'emily', 'fabrizio', 'emily', 'fabrizio', 'emily', null, null, null)),
    ).toBeNull();
  });

  it('riconosce il pareggio: griglia piena senza vincitore', () => {
    const full = cells(
      'fabrizio', 'emily', 'fabrizio',
      'emily', 'emily', 'fabrizio',
      'emily', 'fabrizio', 'emily',
    );
    expect(winnerOf(full)).toBeNull();
    expect(isDraw(full)).toBe(true);
  });

  it('non è un pareggio se la griglia non è piena', () => {
    expect(isDraw(EMPTY_BOARD)).toBe(false);
  });

  it("non è un pareggio se c'è un vincitore, anche a griglia piena", () => {
    const full = cells(
      'emily', 'emily', 'emily',
      'fabrizio', 'fabrizio', 'emily',
      'fabrizio', 'emily', 'fabrizio',
    );
    expect(winnerOf(full)).toBe('emily');
    expect(isDraw(full)).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npm run test -- board`
Expected: FAIL — il modulo `./board` non esiste.

- [ ] **Step 3: Scrivi `features/games/ticTacToe/board.ts`**

```ts
import type { Person } from '@/features/auth/identity';

export type Cell = Person | null;
export type BoardState = { cells: Cell[] }; // lunghezza 9, indice 0 in alto a sinistra

export const EMPTY_BOARD: BoardState = { cells: Array(9).fill(null) };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function isLegalMove(state: BoardState, index: number): boolean {
  return index >= 0 && index < 9 && state.cells[index] === null;
}

export function applyMove(state: BoardState, index: number, mark: Person): BoardState {
  const cells = [...state.cells];
  cells[index] = mark;
  return { cells };
}

export function winnerOf(state: BoardState): Person | null {
  for (const [a, b, c] of LINES) {
    const mark = state.cells[a];
    if (mark && mark === state.cells[b] && mark === state.cells[c]) return mark;
  }
  return null;
}

export function isDraw(state: BoardState): boolean {
  return winnerOf(state) === null && state.cells.every((c) => c !== null);
}
```

- [ ] **Step 4: Esegui e verifica che i test passino**

Run: `npm run test -- board`
Expected: 11 test PASS.

- [ ] **Step 5: Commit**

```bash
git add features/games/ticTacToe/board.ts features/games/ticTacToe/board.test.ts
git commit -m "feat: regole del Tris, logica pura senza dipendenze da React"
```

### Task 6: Schermata di gioco

**Files:**
- Create: `features/games/games.module.css`
- Create: `features/games/MatchStatus.tsx`
- Create: `features/games/MatchStatus.test.tsx`
- Create: `features/games/ticTacToe/TicTacToeBoard.tsx`
- Create: `features/games/ticTacToe/TicTacToeBoard.test.tsx`
- Create: `app/games/tic-tac-toe/page.tsx`
- Create: `app/games/tic-tac-toe/page.test.tsx`

**Interfaces:**
- Consumes: `useActiveMatch`, `useGameHistory`, `createMatch`, `makeMove` (Task 4), `EMPTY_BOARD`/`isLegalMove`/`applyMove`/`winnerOf`/`isDraw` (Task 5).
- Produces: schermata `/games/tic-tac-toe` completa.

- [ ] **Step 1: Scrivi `features/games/games.module.css`**

```css
.muted { font: var(--font-small); color: var(--fg-muted); }
.error { font: var(--font-small); color: var(--danger); margin: 0; }

.status {
  text-align: center;
  font: var(--font-lead);
  color: var(--fg-muted);
  margin: 0 0 var(--space-3);
}

.tally {
  text-align: center;
  font: var(--font-small);
  color: var(--fg-muted);
  margin: 0 0 var(--space-3);
}

.newGame {
  display: block;
  margin: var(--space-6) auto;
  min-height: 52px;
  padding: 0 var(--space-5);
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-fg);
  font: var(--font-lead);
}
.newGame:disabled { opacity: 0.45; }

.gameShell { display: grid; gap: var(--space-3); }

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  max-width: 320px;
  margin: 0 auto;
}
.cell {
  aspect-ratio: 1;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-title);
}
.cell:disabled { opacity: 1; }

.list { display: grid; gap: var(--space-3); }
.gameCard {
  display: block;
  min-height: 52px;
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-lead);
  text-decoration: none;
}
.gameCardDisabled {
  min-height: 52px;
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg-muted);
  font: var(--font-lead);
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.soon { font: var(--font-small); }
```

- [ ] **Step 2: Scrivi il test di `MatchStatus` (deve fallire: il componente non esiste ancora)**

`features/games/MatchStatus.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchStatus } from './MatchStatus';

describe('MatchStatus', () => {
  it('mostra "Your turn" quando tocca a chi guarda', () => {
    render(<MatchStatus currentTurn="fabrizio" who="fabrizio" />);
    expect(screen.getByText('Your turn')).toBeDefined();
  });

  it("mostra chi sta aspettando quando tocca all'altro", () => {
    render(<MatchStatus currentTurn="emily" who="fabrizio" />);
    expect(screen.getByText('Waiting for Emily')).toBeDefined();
  });
});
```

- [ ] **Step 3: Esegui e verifica che fallisca**

Run: `npm run test -- MatchStatus`
Expected: FAIL — il modulo `./MatchStatus` non esiste.

- [ ] **Step 4: Scrivi `features/games/MatchStatus.tsx`**

```tsx
import { displayName, partnerOf, type Person } from '@/features/auth/identity';
import styles from './games.module.css';

/** Generico e riusabile da ogni gioco: non sa nulla delle regole, solo di chi ha il turno. */
export function MatchStatus({ currentTurn, who }: { currentTurn: Person; who: Person }) {
  const mine = currentTurn === who;
  return <p className={styles.status}>{mine ? 'Your turn' : `Waiting for ${displayName(partnerOf(who))}`}</p>;
}
```

- [ ] **Step 5: Esegui e verifica che i test passino**

Run: `npm run test -- MatchStatus`
Expected: 2 test PASS.

- [ ] **Step 6: Scrivi il test di `TicTacToeBoard` (deve fallire: il componente non esiste ancora)**

`features/games/ticTacToe/TicTacToeBoard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TicTacToeBoard } from './TicTacToeBoard';
import type { Match } from '../types';

const createMatch = vi.fn();
const makeMove = vi.fn();
vi.mock('../queries', () => ({
  createMatch: (...a: unknown[]) => createMatch(...a),
  makeMove: (...a: unknown[]) => makeMove(...a),
}));

const useActiveMatch = vi.fn();
vi.mock('../useActiveMatch', () => ({ useActiveMatch: () => useActiveMatch() }));

const useGameHistory = vi.fn();
vi.mock('../useGameHistory', () => ({ useGameHistory: () => useGameHistory() }));

const baseState = { loading: false, error: null, offline: false, refetch: vi.fn() };
const baseHistory = { ...baseState, data: { fabrizio: 0, emily: 0, draws: 0 } };

const openMatch = (over: Partial<Match> & { cells?: Array<string | null> } = {}): Match => ({
  id: 'm1',
  game_type: 'tic_tac_toe',
  state: { cells: over.cells ?? Array(9).fill(null) },
  started_by: 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: null,
  created_at: '2026-08-20T10:00:00Z',
  closed_at: null,
});

describe('TicTacToeBoard', () => {
  beforeEach(() => {
    createMatch.mockReset();
    makeMove.mockReset();
    useActiveMatch.mockReset();
    useGameHistory.mockReset();
    useGameHistory.mockReturnValue(baseHistory);
    createMatch.mockResolvedValue({ data: null, error: null });
    makeMove.mockResolvedValue({ data: null, error: null });
  });

  it('nessuna partita attiva: mostra "New game"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('avviando una partita, chiama createMatch con la griglia vuota', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TicTacToeBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() =>
      expect(createMatch).toHaveBeenCalledWith('tic_tac_toe', 'emily', { cells: Array(9).fill(null) }),
    );
  });

  it('partita attiva, il mio turno: le celle sono cliccabili', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText('Your turn')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cell 1' }).getAttribute('disabled')).toBeNull();
  });

  it('partita attiva, non il mio turno: le celle sono disabilitate', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<TicTacToeBoard who="fabrizio" />);
    for (const cell of screen.getAllByRole('button', { name: /^Cell \d/ })) {
      expect(cell.getAttribute('disabled')).not.toBeNull();
    }
  });

  it('muovendo su una cella vuota nel proprio turno, calcola lo stato e chiama makeMove', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TicTacToeBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'Cell 1' }).click();
    await waitFor(() =>
      expect(makeMove).toHaveBeenCalledWith(
        'm1',
        'fabrizio',
        { cells: ['fabrizio', null, null, null, null, null, null, null, null] },
        null,
        null,
      ),
    );
  });

  it('una mossa che completa una riga vincente chiama makeMove con result "win"', async () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ cells: ['fabrizio', 'fabrizio', null, 'emily', 'emily', null, null, null, null] }),
    });
    render(<TicTacToeBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'Cell 3' }).click();
    await waitFor(() =>
      expect(makeMove).toHaveBeenCalledWith(
        'm1',
        'fabrizio',
        { cells: ['fabrizio', 'fabrizio', 'fabrizio', 'emily', 'emily', null, null, null, null] },
        'win',
        'fabrizio',
      ),
    );
  });

  it('mostra il tally di vittorie/pareggi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 1 } });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText('3 – 2 – 1 draws')).toBeDefined();
  });

  it('due tocchi rapidi sulla stessa cella inviano una sola mossa', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TicTacToeBoard who="fabrizio" />);
    const cell = screen.getByRole('button', { name: 'Cell 1' });
    cell.click();
    cell.click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    expect(makeMove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Esegui e verifica che falliscano**

Run: `npm run test -- TicTacToeBoard`
Expected: FAIL — il modulo `./TicTacToeBoard` non esiste.

- [ ] **Step 8: Scrivi `features/games/ticTacToe/TicTacToeBoard.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import { EMPTY_BOARD, isLegalMove, applyMove, winnerOf, isDraw, type BoardState } from './board';
import styles from '../games.module.css';

export function TicTacToeBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError } = useActiveMatch('tic_tac_toe');
  const { data: tally } = useGameHistory('tic_tac_toe');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona del composer delle lettere e di QuestionCard: il
  // `disabled` da solo non basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('tic_tac_toe', who, EMPTY_BOARD);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function play(index: number) {
    if (sending.current || !match) return;
    const state = match.state as BoardState;
    if (match.current_turn !== who || !isLegalMove(state, index)) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyMove(state, index, who);
    const winner = winnerOf(next);
    const result = winner ? 'win' : isDraw(next) ? 'draw' : null;
    const { error: failure } = await makeMove(match.id, who, next, result, winner);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  if (loading && !match) return <p className={styles.muted}>Loading…</p>;

  return (
    <div className={styles.gameShell}>
      {tally && (
        <p className={styles.tally}>
          {tally.fabrizio} – {tally.emily} – {tally.draws} draws
        </p>
      )}
      {loadError && (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      )}

      {!match && (
        <button type="button" className={styles.newGame} onClick={start} disabled={busy}>
          {busy ? 'Starting…' : 'New game'}
        </button>
      )}

      {match && (
        <>
          <MatchStatus currentTurn={match.current_turn} who={who} />
          <div className={styles.board}>
            {(match.state as BoardState).cells.map((cell, i) => (
              <button
                key={i}
                type="button"
                className={styles.cell}
                aria-label={`Cell ${i + 1}`}
                onClick={() => play(i)}
                disabled={busy || match.current_turn !== who || cell !== null}
              >
                {cell ? (cell === match.started_by ? 'X' : 'O') : ''}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Esegui e verifica che i test passino**

Run: `npm run test -- TicTacToeBoard`
Expected: 8 test PASS.

- [ ] **Step 10: Scrivi il test della pagina (deve fallire: la pagina non esiste ancora)**

`app/games/tic-tac-toe/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TicTacToePage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

vi.mock('@/features/games/useActiveMatch', () => ({
  useActiveMatch: () => ({ data: null, loading: false, error: null, offline: false, refetch: vi.fn() }),
}));
vi.mock('@/features/games/useGameHistory', () => ({
  useGameHistory: () => ({
    data: { fabrizio: 0, emily: 0, draws: 0 },
    loading: false,
    error: null,
    offline: false,
    refetch: vi.fn(),
  }),
}));

describe('TicTacToePage', () => {
  it('renderizza la schermata del Tris', () => {
    render(<TicTacToePage />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
```

- [ ] **Step 11: Esegui e verifica che fallisca**

Run: `npm run test -- "app/games/tic-tac-toe/page"`
Expected: FAIL — il file `./page` non esiste.

- [ ] **Step 12: Scrivi `app/games/tic-tac-toe/page.tsx`**

```tsx
'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { TicTacToeBoard } from '@/features/games/ticTacToe/TicTacToeBoard';

export default function TicTacToePage() {
  const { who } = useIdentity();
  return <TicTacToeBoard who={who} />;
}
```

- [ ] **Step 13: Esegui e verifica che i test passino**

Run: `npm run test -- "app/games/tic-tac-toe/page"`
Expected: 1 test PASS.

- [ ] **Step 14: Esegui l'intera suite unit**

Run: `npm run test`
Expected: tutti i test PASS.

- [ ] **Step 15: Commit**

```bash
git add features/games/games.module.css features/games/MatchStatus.tsx features/games/MatchStatus.test.tsx features/games/ticTacToe/TicTacToeBoard.tsx features/games/ticTacToe/TicTacToeBoard.test.tsx app/games/tic-tac-toe
git commit -m "feat: schermata di gioco del Tris, con tally e turni"
```

### Task 7: Elenco giochi

**Files:**
- Modify: `app/games/page.tsx`
- Create: `app/games/page.test.tsx`

**Interfaces:**
- Consumes: nessuna dipendenza da Task 1-6 oltre alla route `/games/tic-tac-toe` (Task 6).
- Produces: schermata `/games` completa.

- [ ] **Step 1: Scrivi il test che deve fallire**

`app/games/page.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GamesPage from './page';

describe('GamesPage', () => {
  it('mostra un link giocabile per il Tris', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Tic-tac-toe/ });
    expect(link.getAttribute('href')).toBe('/games/tic-tac-toe');
  });

  it('mostra gli altri giochi come "coming soon", senza link', () => {
    render(<GamesPage />);
    expect(screen.getByText('Connect 4')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Connect 4/ })).toBeNull();
    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm run test -- "app/games/page"`
Expected: FAIL — la pagina segnaposto non ha alcun link.

- [ ] **Step 3: Sostituisci `app/games/page.tsx`**

```tsx
import Link from 'next/link';
import styles from '@/features/games/games.module.css';

const GAMES = [
  { slug: 'tic-tac-toe', label: 'Tic-tac-toe', available: true },
  { slug: 'connect-four', label: 'Connect 4', available: false },
  { slug: 'blackjack', label: 'Blackjack', available: false },
  { slug: 'trivia', label: 'Trivia', available: false },
];

export default function GamesPage() {
  return (
    <div className={styles.list}>
      {GAMES.map((game) =>
        game.available ? (
          <Link key={game.slug} href={`/games/${game.slug}`} className={styles.gameCard}>
            {game.label}
          </Link>
        ) : (
          <div key={game.slug} className={styles.gameCardDisabled}>
            {game.label}
            <span className={styles.soon}>Coming soon</span>
          </div>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 4: Esegui e verifica che i test passino**

Run: `npm run test -- "app/games/page"`
Expected: 2 test PASS.

- [ ] **Step 5: Esegui l'intera suite unit**

Run: `npm run test`
Expected: tutti i test PASS.

- [ ] **Step 6: Verifica manuale end-to-end**

Run: `npm run dev` (con `npm run db:start` già attivo). Nell'app:

1. Apri `/games`: Tic-tac-toe è un link cliccabile, gli altri tre mostrano "Coming soon" senza essere link.
2. Apri `/games/tic-tac-toe`, premi "New game": la griglia appare, tocca a te.
3. Fai una mossa: la cella si riempie, il turno passa all'altro (`MatchStatus` cambia, la griglia diventa sola lettura).
4. Cambia identità (bottone in alto) e fai muovere l'altra persona: il turno torna a girare.
5. Porta la partita a una vittoria: la partita si chiude, il tally si aggiorna, appare di nuovo "New game".
6. Prova un pareggio (griglia piena senza vincitore): la partita si chiude senza vincitore, il tally conta un pareggio.
7. Prova ad aprire una seconda partita mentre una è attiva: il pulsante "New game" non è visibile.

- [ ] **Step 7: Verifica `tsc` e build**

Run: `npx tsc --noEmit && npm run build`
Expected: nessun errore.

- [ ] **Step 8: Commit**

```bash
git add app/games/page.tsx app/games/page.test.tsx
git commit -m "feat: elenco giochi con Tic-tac-toe giocabile"
```
