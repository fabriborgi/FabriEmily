# F0 + F1 — Fondazioni e Lettere · Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una PWA mobile-first in cui Fabrizio ed Emily entrano con una password condivisa, scelgono chi sono, e si scambiano lettere di testo e disegni che compaiono in tempo reale sull'altro telefono, guadagnando monete.

**Architecture:** Next.js App Router, tutti i componenti dati sono client component che parlano con Supabase dal browser tramite un unico hook `useRealtimeQuery`. Nessuna scrittura diretta sulle tabelle: il client può solo leggere (RLS `select` per `authenticated`) e chiamare quattro funzioni Postgres `security definer` che contengono tutta la logica economica. I disegni sono tratti vettoriali in JSONB, non immagini.

**Tech Stack:** Next.js (App Router) · TypeScript strict · `@supabase/supabase-js` · CSS Modules con custom properties · Vitest (unit in jsdom + integrazione in node contro Supabase locale) · `pg` per le fixture SQL nei test · Playwright · Supabase CLI

**Spec di riferimento:** [`docs/superpowers/specs/2026-08-17-fondazioni-e-lettere-design.md`](../specs/2026-08-17-fondazioni-e-lettere-design.md)

**Branch:** `feature/f0-f1-fondazioni-lettere`

## Global Constraints

Valgono per ogni task, anche dove non ripetuti.

- **Lingua dell'interfaccia: inglese.** Ogni stringa visibile all'utente è in inglese. Commenti e documentazione in italiano.
- **Mobile-first.** Si progetta per 390 × 844 px (iPhone 13) e si adatta verso l'alto. Ogni target di tocco è almeno 44 × 44 px.
- **TypeScript strict.** `strict: true`, nessun `any` implicito, nessun `@ts-ignore`.
- **Nessuna scrittura diretta dal client.** Il client non chiama mai `.insert()`, `.update()` o `.delete()` su una tabella. Solo `.select()` e `.rpc()`.
- **Identità:** enum `person` = `'fabrizio' | 'emily'`. La chiave in `localStorage` è esattamente `fe.who`.
- **Fuso dei cap giornalieri:** letterale `'America/New_York'` (mezzanotte a Buffalo). Compare **solo** dentro `grant_coins`.
- **Spazio logico dei disegni:** 1000 × 1000, coordinate intere. Palette di 12 colori, 3 spessori (6, 14, 30 unità), massimo 200 tratti e 400 punti per tratto, distanza minima fra punti 4 unità.
- **Valori economici** (in `coin_rules`, mai in codice TypeScript): `letter_written` 15 monete / cap 3 / min 40 caratteri · `drawing_sent` 20 / cap 2 / min 5 tratti · `question_answered` 8 / cap 5 · `game_win` 20 · `game_draw` 10 · `game_loss` 5 · `pet_care_action` 2 / cap 30 · `plant_watered` 3 / cap 15 · `daily_open` 10 / cap 1.
- **Commit dopo ogni task**, con messaggio in italiano e prefisso convenzionale (`feat:`, `test:`, `chore:`).

## Mappa dei file

| File | Responsabilità |
|---|---|
| `lib/env.ts` | Accesso alle variabili d'ambiente con errore esplicito se mancano |
| `lib/supabase/client.ts` | Singleton del client browser |
| `lib/rpc.ts` | Traduzione degli errori Postgres in messaggi inglesi; nessuna logica di dominio |
| `lib/useRealtimeQuery.ts` | Fetch + subscribe + refetch alla riconnessione. L'unico punto che conosce Realtime |
| `features/auth/identity.ts` | Lettura/scrittura dell'identità in `localStorage`. Funzioni pure |
| `features/auth/IdentityProvider.tsx` | Context con l'identità corrente |
| `features/auth/AuthGate.tsx` | Sceglie fra login, scelta identità e app |
| `features/coins/useCoins.ts` | Saldo monete live |
| `features/letters/strokes.ts` | Formato dei tratti, semplificazione, undo, validazione, rendering. Funzioni pure |
| `features/letters/grouping.ts` | Raggruppamento per mese, derivazione delle non-lette. Funzioni pure |
| `features/letters/queries.ts` | Le quattro query/mutazioni sulle lettere |
| `features/letters/DrawingCanvas.tsx` | Editor: pointer events, barra strumenti, autosave locale |
| `features/letters/DrawingView.tsx` | Rendering di sola lettura: miniatura e replay |
| `supabase/migrations/*.sql` | Schema, funzioni, permessi, seed |
| `supabase/tests/*.test.ts` | Test di integrazione contro Postgres reale |

Le fasi F2–F6 **aggiungono** cartelle sotto `features/`; non modificano queste.

---

### Task 1: Scaffold, toolchain e accesso all'ambiente

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `vitest.integration.config.ts`, `.env.local.example`, `.gitignore`
- Create: `lib/env.ts`
- Create: `app/layout.tsx`, `app/page.tsx`
- Create: `supabase/config.toml` (generato da `supabase init`)
- Test: `lib/env.test.ts`

**Interfaces:**
- Consumes: niente, è il primo task.
- Produces: `requireEnv(name: string, value: string | undefined): string` — usata da `lib/supabase/client.ts` in Task 8. Script npm `test`, `test:int`, `dev`, `build`.

- [ ] **Step 1: Inizializza il progetto**

```bash
npm init -y
npm install next@latest react@latest react-dom@latest @supabase/supabase-js
npm install -D typescript @types/react @types/node @types/react-dom \
  vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom \
  pg @types/pg dotenv
npx supabase init --force
```

Se `npx supabase` non è disponibile: `brew install supabase/tap/supabase`.

- [ ] **Step 2: Configura TypeScript, Next e gli script**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
export default { reactStrictMode: true };
```

In `package.json`, aggiungi `"type": "module"` e gli script:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run --config vitest.config.ts",
  "test:watch": "vitest --config vitest.config.ts",
  "db:start": "supabase start && supabase status -o env > .env.test",
  "db:reset": "supabase db reset",
  "test:int": "vitest run --config vitest.integration.config.ts"
}
```

`vitest.config.ts` — unit test, ambiente browser simulato:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    include: ['{lib,features,components,app}/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
```

`vitest.integration.config.ts` — test di integrazione, ambiente node, seriali perché condividono un database:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    globals: true,
    fileParallelism: false,
    testTimeout: 20000,
    setupFiles: ['supabase/tests/setup.ts'],
  },
});
```

`.gitignore`:

```
node_modules
.next
.env.local
.env.test
supabase/.branches
supabase/.temp
test-results
playwright-report
```

`.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_COUPLE_EMAIL=couple@fabriemily.app
```

- [ ] **Step 3: Scrivi il test che deve fallire**

`lib/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
  it('ritorna il valore quando è presente', () => {
    expect(requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost')).toBe('http://localhost');
  });

  it('nomina la variabile mancante nel messaggio di errore', () => {
    expect(() => requireEnv('NEXT_PUBLIC_COUPLE_EMAIL', undefined))
      .toThrow('Missing environment variable: NEXT_PUBLIC_COUPLE_EMAIL');
  });

  it('tratta la stringa vuota come mancante', () => {
    expect(() => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')).toThrow(/Missing/);
  });
});
```

- [ ] **Step 4: Esegui il test e verifica che falisca**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./env"`

- [ ] **Step 5: Implementa**

`lib/env.ts`:

```ts
/**
 * Le variabili d'ambiente NEXT_PUBLIC_* sono inlined a build time: se ne manca una,
 * il valore è `undefined` e il bug si manifesta molto lontano dalla causa.
 * Questa funzione lo fa fallire subito, con il nome della variabile nel messaggio.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
```

- [ ] **Step 6: Aggiungi un layout e una home minimi**

`app/layout.tsx`:

```tsx
export const metadata = { title: 'Fabrizio & Emily' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Home</main>;
}
```

- [ ] **Step 7: Verifica che tutto passi e che il progetto compili**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 3 test PASS, nessun errore di tipo, build completata.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js, Vitest e Supabase CLI"
```

---

### Task 2: Schema, permessi e Realtime

**Files:**
- Create: `supabase/migrations/20260817090000_schema.sql`
- Create: `supabase/tests/setup.ts`, `supabase/tests/helpers.ts`
- Test: `supabase/tests/schema.test.ts`

**Interfaces:**
- Consumes: niente dal codice applicativo.
- Produces: tabelle `couple_state`, `coin_rules`, `item_prices`, `coin_ledger`, `letters`; tipi `person`, `letter_kind`. Helper di test `sql(text, params)`, `serviceClient()`, `signedInClient()`, `resetData()`, `COUPLE_EMAIL`, `COUPLE_PASSWORD` — usati da tutti i task di integrazione successivi.

- [ ] **Step 1: Avvia Supabase in locale**

```bash
npm run db:start
cat .env.test
```

Expected: `.env.test` contiene `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DB_URL`.

- [ ] **Step 2: Scrivi gli helper di test**

`supabase/tests/helpers.ts`:

```ts
import { Client } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

export const COUPLE_EMAIL = 'couple@fabriemily.test';
export const COUPLE_PASSWORD = 'ci-shared-password';

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} mancante: hai eseguito "npm run db:start"?`);
  return v;
};

/** SQL diretto: serve per le fixture (timestamp controllati) e per le asserzioni. */
export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: need('DB_URL') });
  await client.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

/** Client con service role: bypassa RLS, usato per predisporre lo stato. */
export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(need('API_URL'), need('SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client autenticato come la coppia: è esattamente ciò che gira nel browser. */
export async function signedInClient(): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(need('API_URL'), need('ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: COUPLE_EMAIL,
    password: COUPLE_PASSWORD,
  });
  if (error) throw error;
  return client;
}

/** Client anonimo: non ha superato il login. */
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(need('API_URL'), need('ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Riporta i dati allo stato iniziale fra i test. Non toccare coin_rules. */
export async function resetData(): Promise<void> {
  await sql(`
    truncate coin_ledger restart identity;
    delete from letters;
    delete from item_prices;
    update couple_state set coins = 0 where id = 1;
  `);
}
```

`supabase/tests/setup.ts`:

```ts
import { config } from 'dotenv';
import { beforeAll } from 'vitest';
import { serviceClient, COUPLE_EMAIL, COUPLE_PASSWORD } from './helpers';

config({ path: '.env.test' });

/** L'utente della coppia si crea a mano in produzione; nei test lo creiamo qui. */
beforeAll(async () => {
  const admin = serviceClient();
  const { error } = await admin.auth.admin.createUser({
    email: COUPLE_EMAIL,
    password: COUPLE_PASSWORD,
    email_confirm: true,
  });
  if (error && !/already/i.test(error.message)) throw error;
});
```

Nota: `config()` va chiamata anche in cima a `helpers.ts`? No — `setupFiles` gira prima dei test, ma gli import di `helpers` vengono valutati prima del corpo di `setup.ts`. Poiché `need()` legge `process.env` solo **quando viene chiamata** (dentro le funzioni, non a livello di modulo), l'ordine è corretto così com'è.

- [ ] **Step 3: Scrivi il test che deve fallire**

`supabase/tests/schema.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, anonClient, serviceClient, resetData } from './helpers';

describe('schema e permessi', () => {
  beforeEach(resetData);

  it('couple_state ha esattamente una riga, con id 1', async () => {
    const rows = await sql<{ id: number; coins: number }>('select id, coins from couple_state');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });

  it('impedisce una seconda riga in couple_state', async () => {
    await expect(sql('insert into couple_state (id) values (2)')).rejects.toThrow();
  });

  it('rifiuta una lettera di testo senza corpo', async () => {
    await expect(
      sql(`insert into letters (author, kind) values ('emily', 'text')`),
    ).rejects.toThrow(/letters_payload_matches_kind/);
  });

  it('rifiuta un disegno che porta anche del testo', async () => {
    await expect(
      sql(`insert into letters (author, kind, body, strokes)
           values ('emily', 'drawing', 'ciao', '[]'::jsonb)`),
    ).rejects.toThrow(/letters_payload_matches_kind/);
  });

  it('rifiuta una lettera di testo di soli spazi', async () => {
    await expect(
      sql(`insert into letters (author, kind, body) values ('emily', 'text', '   ')`),
    ).rejects.toThrow(/letters_text_not_blank/);
  });

  it('un client autenticato legge le lettere', async () => {
    await sql(`insert into letters (author, kind, body) values ('emily', 'text', 'hello there')`);
    const client = await signedInClient();
    const { data, error } = await client.from('letters').select('id, body');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('un client anonimo NON legge le lettere', async () => {
    await sql(`insert into letters (author, kind, body) values ('emily', 'text', 'hello there')`);
    const { data, error } = await anonClient().from('letters').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error ?? { message: '' }).toBeTruthy();
  });

  it('un client autenticato NON scrive sulle lettere', async () => {
    const client = await signedInClient();
    const { error } = await client
      .from('letters')
      .insert({ author: 'emily', kind: 'text', body: 'x'.repeat(50) });
    expect(error).not.toBeNull();
  });

  it('un client autenticato NON modifica il saldo monete', async () => {
    const client = await signedInClient();
    const { error } = await client.from('couple_state').update({ coins: 99999 }).eq('id', 1);
    expect(error).not.toBeNull();
    const rows = await sql<{ coins: number }>('select coins from couple_state where id = 1');
    expect(rows[0].coins).toBe(0);
  });

  it('letters e couple_state sono pubblicate su Realtime', async () => {
    const rows = await sql<{ tablename: string }>(`
      select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' order by tablename
    `);
    const names = rows.map((r) => r.tablename);
    expect(names).toContain('letters');
    expect(names).toContain('couple_state');
  });

  it('il saldo monete non può diventare negativo', async () => {
    const admin = serviceClient();
    const { error } = await admin.from('couple_state').update({ coins: -1 }).eq('id', 1);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Esegui e verifica che falisca**

Run: `npm run test:int`
Expected: FAIL — le tabelle non esistono (`relation "couple_state" does not exist`).

- [ ] **Step 5: Scrivi la migrazione**

`supabase/migrations/20260817090000_schema.sql`:

```sql
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

-- Seconda barriera oltre alle RLS: i privilegi di scrittura non esistono affatto.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
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
```

- [ ] **Step 6: Applica la migrazione e verifica che i test passino**

Run: `npm run db:reset && npm run test:int`
Expected: 11 test PASS.

Se `revoke usage on schema public from anon` fa fallire il test "un client anonimo NON legge": è il risultato voluto, il client anonimo riceve un errore di permesso invece di zero righe — il test accetta entrambi.

- [ ] **Step 7: Genera i tipi TypeScript dallo schema**

Gli helper di test importano `Database`: senza questo file non compilano. Va rigenerato
**dopo ogni migrazione**, quindi anche nei Task 3–7.

```bash
npx supabase gen types typescript --local > lib/types.ts
npx tsc --noEmit
```

Aggiungi lo script a `package.json`: `"db:types": "supabase gen types typescript --local > lib/types.ts"`.

- [ ] **Step 8: Commit**

```bash
git add supabase lib package.json
git commit -m "feat: schema, RLS e Realtime per stato coppia, monete e lettere"
```

---

### Task 3: `grant_coins` — il cuore dell'economia

**Files:**
- Create: `supabase/migrations/20260817091000_grant_coins.sql`
- Test: `supabase/tests/grant_coins.test.ts`

**Interfaces:**
- Consumes: tabelle `coin_rules`, `coin_ledger`, `couple_state` (Task 2); helper di test (Task 2).
- Produces: `grant_coins(p_actor person, p_reason text, p_ref uuid default null, p_units int default 0) returns int` — il nuovo saldo. Chiamata da `create_letter` (Task 4) e, in F2–F5, da giochi, animali e domande.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/grant_coins.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

const grant = async (actor: string, reason: string, units = 0) =>
  (
    await sql<{ grant_coins: number }>(
      'select grant_coins($1::person, $2, null, $3) as grant_coins',
      [actor, reason, units],
    )
  )[0].grant_coins;

/** Inizio della giornata a Buffalo, come lo calcola grant_coins. */
const DAY_START = `date_trunc('day', now() at time zone 'America/New_York')
                     at time zone 'America/New_York'`;

describe('grant_coins', () => {
  beforeEach(resetData);

  it('accredita l’importo della regola e ritorna il nuovo saldo', async () => {
    const balance = await grant('fabrizio', 'game_win');
    expect(balance).toBe(20);
    expect(await coins()).toBe(20);
  });

  it('scrive una riga di ledger con attore, importo e motivo', async () => {
    await grant('emily', 'game_win');
    const rows = await sql<{ actor: string; amount: number; reason: string }>(
      'select actor, amount, reason from coin_ledger',
    );
    expect(rows).toEqual([{ actor: 'emily', amount: 20, reason: 'game_win' }]);
  });

  it('solleva unknown_coin_reason per un motivo inesistente', async () => {
    await expect(grant('emily', 'nope')).rejects.toThrow(/unknown_coin_reason/);
  });

  it('non accredita sotto il minimo di unità, senza sollevare errori', async () => {
    const balance = await grant('emily', 'letter_written', 39);
    expect(balance).toBe(0);
    expect(await coins()).toBe(0);
    expect(await sql('select 1 from coin_ledger')).toHaveLength(0);
  });

  it('accredita esattamente al minimo di unità', async () => {
    expect(await grant('emily', 'letter_written', 40)).toBe(15);
  });

  it('ferma l’accredito al cap giornaliero', async () => {
    expect(await grant('emily', 'letter_written', 100)).toBe(15);
    expect(await grant('emily', 'letter_written', 100)).toBe(30);
    expect(await grant('emily', 'letter_written', 100)).toBe(45);
    expect(await grant('emily', 'letter_written', 100)).toBe(45); // quarta: niente
    expect(await sql('select 1 from coin_ledger')).toHaveLength(3);
  });

  it('applica il cap per persona, non per coppia', async () => {
    for (let i = 0; i < 3; i++) await grant('emily', 'letter_written', 100);
    expect(await grant('fabrizio', 'letter_written', 100)).toBe(60);
  });

  it('non applica alcun cap quando daily_cap è null', async () => {
    for (let i = 0; i < 6; i++) await grant('fabrizio', 'game_win');
    expect(await coins()).toBe(120);
  });

  it('ignora i movimenti precedenti a mezzanotte di Buffalo', async () => {
    // Tre lettere premiate "ieri": la giornata è nuova, il cap è libero.
    await sql(`
      insert into coin_ledger (actor, amount, reason, created_at)
      select 'emily', 15, 'letter_written', ${DAY_START} - interval '1 minute'
      from generate_series(1, 3)
    `);
    expect(await grant('emily', 'letter_written', 100)).toBeGreaterThan(0);
  });

  it('conta i movimenti successivi a mezzanotte di Buffalo', async () => {
    await sql(`
      insert into coin_ledger (actor, amount, reason, created_at)
      select 'emily', 15, 'letter_written', ${DAY_START} + interval '1 minute'
      from generate_series(1, 3)
    `);
    const before = await coins();
    expect(await grant('emily', 'letter_written', 100)).toBe(before);
  });

  it('conta solo lo stesso motivo, non tutti i movimenti della persona', async () => {
    for (let i = 0; i < 3; i++) await grant('emily', 'letter_written', 100);
    expect(await grant('emily', 'drawing_sent', 10)).toBe(65);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm run test:int -- grant_coins`
Expected: FAIL — `function grant_coins(person, text, unknown, integer) does not exist`

- [ ] **Step 3: Implementa la funzione**

`supabase/migrations/20260817091000_grant_coins.sql`:

```sql
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
```

- [ ] **Step 4: Verifica che i test passino**

Run: `npm run db:reset && npm run test:int -- grant_coins`
Expected: 11 test PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: grant_coins con minimi, cap per persona e giornata su Buffalo"
```

---

### Task 4: `create_letter` per le lettere di testo

**Files:**
- Create: `supabase/migrations/20260817092000_create_letter.sql`
- Test: `supabase/tests/create_letter_text.test.ts`

**Interfaces:**
- Consumes: `grant_coins` (Task 3), tabella `letters` (Task 2).
- Produces: `create_letter(p_author person, p_kind letter_kind, p_body text default null, p_strokes jsonb default null) returns letters`. Chiamata dal client in Task 13 e Task 16.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/create_letter_text.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const LONG = 'I miss you more than I know how to write down, but I am trying anyway.'; // 69 char

const writeText = async (author: string, body: string) =>
  (
    await sql<{ id: string; author: string; kind: string; body: string }>(
      `select * from create_letter($1::person, 'text'::letter_kind, $2, null)`,
      [author, body],
    )
  )[0];

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

describe('create_letter — testo', () => {
  beforeEach(resetData);

  it('inserisce la lettera e ne ritorna la riga', async () => {
    const letter = await writeText('fabrizio', LONG);
    expect(letter.author).toBe('fabrizio');
    expect(letter.kind).toBe('text');
    expect(letter.body).toBe(LONG);
    expect(letter.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('nasce non letta', async () => {
    const letter = await writeText('fabrizio', LONG);
    const rows = await sql<{ read_at: string | null }>(
      'select read_at from letters where id = $1',
      [letter.id],
    );
    expect(rows[0].read_at).toBeNull();
  });

  it('accredita 15 monete per una lettera di almeno 40 caratteri', async () => {
    await writeText('emily', LONG);
    expect(await coins()).toBe(15);
  });

  it('collega il movimento alla lettera tramite ref_id', async () => {
    const letter = await writeText('emily', LONG);
    const rows = await sql<{ ref_id: string; reason: string }>(
      'select ref_id, reason from coin_ledger',
    );
    expect(rows).toEqual([{ ref_id: letter.id, reason: 'letter_written' }]);
  });

  it('salva ma non paga una lettera troppo corta', async () => {
    const letter = await writeText('emily', 'ti amo');
    expect(letter.body).toBe('ti amo');
    expect(await coins()).toBe(0);
  });

  it('conta i caratteri senza gli spazi ai bordi', async () => {
    await writeText('emily', `   ${'a'.repeat(39)}   `);
    expect(await coins()).toBe(0);
  });

  it('salva ma non paga la quarta lettera della giornata', async () => {
    for (let i = 0; i < 3; i++) await writeText('emily', LONG);
    expect(await coins()).toBe(45);
    await writeText('emily', LONG);
    expect(await coins()).toBe(45);
    expect(await sql('select 1 from letters')).toHaveLength(4);
  });

  it('rifiuta un corpo vuoto senza inserire nulla', async () => {
    await expect(writeText('emily', '   ')).rejects.toThrow(/empty_letter/);
    expect(await sql('select 1 from letters')).toHaveLength(0);
  });

  it('ignora i tratti passati a una lettera di testo', async () => {
    const rows = await sql<{ strokes: unknown }>(
      `select strokes from create_letter('emily'::person, 'text'::letter_kind, $1, '[]'::jsonb)`,
      [LONG],
    );
    expect(rows[0].strokes).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm run test:int -- create_letter_text`
Expected: FAIL — `function create_letter(...) does not exist`

- [ ] **Step 3: Implementa, per ora solo il ramo testo**

`supabase/migrations/20260817092000_create_letter.sql`:

```sql
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
```

- [ ] **Step 4: Verifica che i test passino**

Run: `npm run db:reset && npm run test:int -- create_letter_text`
Expected: 9 test PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: create_letter per le lettere di testo, con ricompensa in transazione"
```

---

### Task 5: Validazione dei tratti e disegni in `create_letter`

**Files:**
- Modify: `supabase/migrations/20260817092000_create_letter.sql` → nuova migrazione `supabase/migrations/20260817093000_create_letter_drawing.sql`
- Test: `supabase/tests/create_letter_drawing.test.ts`

**Interfaces:**
- Consumes: `create_letter` (Task 4), `grant_coins` (Task 3).
- Produces: la stessa firma di `create_letter`, che ora accetta `p_kind = 'drawing'`. Il formato validato qui è **identico** a quello prodotto da `features/letters/strokes.ts` (Task 12): tratti `{c, w, p}`, `c` 0–11, `w` 0–2, `p` interi 0–1000 di lunghezza pari, massimo 200 tratti e 800 numeri per tratto.

Le migrazioni non si modificano dopo essere state applicate: questa ne aggiunge una nuova con `create or replace function`.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/create_letter_drawing.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

type Stroke = { c: number; w: number; p: number[] };

const stroke = (c = 0, w = 0): Stroke => ({ c, w, p: [10, 10, 20, 20, 30, 25] });
const strokes = (n: number): Stroke[] => Array.from({ length: n }, (_, i) => stroke(i % 12));

const draw = async (author: string, s: unknown) =>
  (
    await sql<{ id: string; kind: string; strokes: Stroke[] }>(
      `select * from create_letter($1::person, 'drawing'::letter_kind, null, $2::jsonb)`,
      [author, JSON.stringify(s)],
    )
  )[0];

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

const letterCount = async () => (await sql('select 1 from letters')).length;

describe('create_letter — disegni', () => {
  beforeEach(resetData);

  it('salva i tratti e li restituisce identici', async () => {
    const input = strokes(5);
    const letter = await draw('emily', input);
    expect(letter.kind).toBe('drawing');
    expect(letter.strokes).toEqual(input);
  });

  it('accredita 20 monete da 5 tratti in su', async () => {
    await draw('emily', strokes(5));
    expect(await coins()).toBe(20);
  });

  it('salva ma non paga un disegno di 4 tratti', async () => {
    await draw('emily', strokes(4));
    expect(await letterCount()).toBe(1);
    expect(await coins()).toBe(0);
  });

  it('salva ma non paga il terzo disegno della giornata', async () => {
    await draw('fabrizio', strokes(5));
    await draw('fabrizio', strokes(5));
    expect(await coins()).toBe(40);
    await draw('fabrizio', strokes(5));
    expect(await coins()).toBe(40);
    expect(await letterCount()).toBe(3);
  });

  it('i cap di lettere e disegni sono indipendenti', async () => {
    for (let i = 0; i < 3; i++) {
      await sql(`select create_letter('emily'::person, 'text'::letter_kind, $1, null)`, [
        'a'.repeat(50),
      ]);
    }
    await draw('emily', strokes(5));
    expect(await coins()).toBe(45 + 20);
  });

  const invalid: Array<[string, unknown]> = [
    ['array vuoto', []],
    ['oltre 200 tratti', strokes(201)],
    ['colore fuori dalla palette', [{ c: 12, w: 0, p: [1, 1, 2, 2] }]],
    ['colore negativo', [{ c: -1, w: 0, p: [1, 1, 2, 2] }]],
    ['spessore inesistente', [{ c: 0, w: 3, p: [1, 1, 2, 2] }]],
    ['coordinate di lunghezza dispari', [{ c: 0, w: 0, p: [1, 1, 2] }]],
    ['un solo punto', [{ c: 0, w: 0, p: [] }]],
    ['coordinata oltre 1000', [{ c: 0, w: 0, p: [1, 1, 1001, 2] }]],
    ['coordinata negativa', [{ c: 0, w: 0, p: [1, -1, 2, 2] }]],
    ['coordinata non numerica', [{ c: 0, w: 0, p: [1, 1, 'x', 2] }]],
    ['oltre 400 punti', [{ c: 0, w: 0, p: Array.from({ length: 802 }, () => 5) }]],
    ['campo p mancante', [{ c: 0, w: 0 }]],
    ['tratto non oggetto', ['ciao']],
    ['non è un array', { c: 0 }],
  ];

  it.each(invalid)('rifiuta: %s', async (_name, payload) => {
    await expect(draw('emily', payload)).rejects.toThrow(/invalid_strokes/);
    expect(await letterCount()).toBe(0);
    expect(await coins()).toBe(0);
  });

  it('accetta esattamente 200 tratti e 400 punti', async () => {
    const big: Stroke[] = [
      { c: 0, w: 2, p: Array.from({ length: 800 }, (_, i) => i % 1000) },
      ...strokes(199),
    ];
    const letter = await draw('emily', big);
    expect(letter.strokes).toHaveLength(200);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm run test:int -- create_letter_drawing`
Expected: FAIL — tutti i casi validi sollevano `invalid_strokes`, perché il ramo disegno non esiste ancora.

- [ ] **Step 3: Implementa la validazione**

`supabase/migrations/20260817093000_create_letter_drawing.sql`:

```sql
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
    if jsonb_typeof(v_stroke) <> 'object'
       or jsonb_typeof(v_stroke -> 'c') <> 'number'
       or jsonb_typeof(v_stroke -> 'w') <> 'number'
       or jsonb_typeof(v_stroke -> 'p') <> 'array' then
      raise exception 'invalid_strokes';
    end if;

    if (v_stroke ->> 'c')::numeric not between 0 and 11
       or (v_stroke ->> 'w')::numeric not between 0 and 2 then
      raise exception 'invalid_strokes';
    end if;

    v_len := jsonb_array_length(v_stroke -> 'p');
    if v_len < 2 or v_len > 800 or v_len % 2 <> 0 then
      raise exception 'invalid_strokes';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_stroke -> 'p') as e(value)
      where jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}')::numeric < 0
         or (e.value #>> '{}')::numeric > 1000
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
```

- [ ] **Step 4: Verifica che i test passino, insieme a quelli del testo**

Run: `npm run db:reset && npm run test:int`
Expected: tutti PASS — 20 test in `create_letter_drawing`, 9 in `create_letter_text`, 11 in `grant_coins`, 11 in `schema`.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: disegni in create_letter con validazione dei tratti lato database"
```

---

### Task 6: `mark_letter_read`

**Files:**
- Create: `supabase/migrations/20260817094000_mark_letter_read.sql`
- Test: `supabase/tests/mark_letter_read.test.ts`

**Interfaces:**
- Consumes: tabella `letters` (Task 2).
- Produces: `mark_letter_read(p_id uuid, p_reader person) returns void`. Chiamata dal client in Task 15.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/mark_letter_read.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const insert = async (author: string) =>
  (
    await sql<{ id: string }>(
      `insert into letters (author, kind, body) values ($1::person, 'text', $2) returning id`,
      [author, 'x'.repeat(50)],
    )
  )[0].id;

const readAt = async (id: string) =>
  (await sql<{ read_at: string | null }>('select read_at from letters where id = $1', [id]))[0]
    .read_at;

const markRead = (id: string, reader: string) =>
  sql('select mark_letter_read($1::uuid, $2::person)', [id, reader]);

describe('mark_letter_read', () => {
  beforeEach(resetData);

  it('il destinatario segna la lettera come letta', async () => {
    const id = await insert('fabrizio');
    await markRead(id, 'emily');
    expect(await readAt(id)).not.toBeNull();
  });

  it('l’autore non può segnare come letta la propria lettera', async () => {
    const id = await insert('fabrizio');
    await markRead(id, 'fabrizio');
    expect(await readAt(id)).toBeNull();
  });

  it('la seconda chiamata non cambia il momento della lettura', async () => {
    const id = await insert('fabrizio');
    await markRead(id, 'emily');
    const first = await readAt(id);
    await markRead(id, 'emily');
    expect(await readAt(id)).toBe(first);
  });

  it('un id inesistente non solleva errori', async () => {
    await expect(
      markRead('00000000-0000-0000-0000-000000000000', 'emily'),
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm run test:int -- mark_letter_read`
Expected: FAIL — `function mark_letter_read(uuid, person) does not exist`

- [ ] **Step 3: Implementa**

`supabase/migrations/20260817094000_mark_letter_read.sql`:

```sql
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
```

- [ ] **Step 4: Verifica che i test passino**

Run: `npm run db:reset && npm run test:int -- mark_letter_read`
Expected: 4 test PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: mark_letter_read idempotente e riservato al destinatario"
```

---

### Task 7: `spend_coins`

**Files:**
- Create: `supabase/migrations/20260817095000_spend_coins.sql`
- Test: `supabase/tests/spend_coins.test.ts`

**Interfaces:**
- Consumes: `item_prices`, `couple_state`, `coin_ledger` (Task 2); `signedInClient` (Task 2).
- Produces: `spend_coins(p_actor person, p_item_key text) returns int` — il nuovo saldo. Non usata dall'interfaccia in F0/F1: la costruiamo ora perché F4 e F6 la useranno senza modifiche, e perché la correttezza sotto concorrenza va verificata una volta sola.

- [ ] **Step 1: Scrivi i test che devono fallire**

`supabase/tests/spend_coins.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';

const setCoins = (n: number) =>
  sql('update couple_state set coins = $1 where id = 1', [n]);

const price = (key: string, cost: number) =>
  sql('insert into item_prices (key, cost, label) values ($1, $2, $3)', [key, cost, key]);

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

const spend = async (actor: string, key: string) =>
  (
    await sql<{ spend_coins: number }>('select spend_coins($1::person, $2) as spend_coins', [
      actor,
      key,
    ])
  )[0].spend_coins;

describe('spend_coins', () => {
  beforeEach(async () => {
    await resetData();
    await price('pet:koala', 150);
  });

  it('scala il costo e ritorna il nuovo saldo', async () => {
    await setCoins(200);
    expect(await spend('emily', 'pet:koala')).toBe(50);
    expect(await coins()).toBe(50);
  });

  it('registra la spesa nel ledger come importo negativo', async () => {
    await setCoins(200);
    await spend('emily', 'pet:koala');
    const rows = await sql<{ actor: string; amount: number; reason: string }>(
      'select actor, amount, reason from coin_ledger',
    );
    expect(rows).toEqual([{ actor: 'emily', amount: -150, reason: 'spend:pet:koala' }]);
  });

  it('accetta una spesa che azzera esattamente il saldo', async () => {
    await setCoins(150);
    expect(await spend('emily', 'pet:koala')).toBe(0);
  });

  it('rifiuta con insufficient_funds e lascia il saldo intatto', async () => {
    await setCoins(149);
    await expect(spend('emily', 'pet:koala')).rejects.toThrow(/insufficient_funds/);
    expect(await coins()).toBe(149);
    expect(await sql('select 1 from coin_ledger')).toHaveLength(0);
  });

  it('rifiuta una chiave inesistente', async () => {
    await setCoins(1000);
    await expect(spend('emily', 'pet:dragon')).rejects.toThrow(/unknown_item/);
    expect(await coins()).toBe(1000);
  });

  it('con due acquisti simultanei uno solo passa, e il saldo non va sotto zero', async () => {
    await setCoins(150);
    const [a, b] = await Promise.all([
      signedInClient().then((c) => c.rpc('spend_coins', { p_actor: 'emily', p_item_key: 'pet:koala' })),
      signedInClient().then((c) => c.rpc('spend_coins', { p_actor: 'fabrizio', p_item_key: 'pet:koala' })),
    ]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/insufficient_funds/);
    expect(await coins()).toBe(0);
  });

  it('è invocabile da un client autenticato', async () => {
    await setCoins(200);
    const client = await signedInClient();
    const { data, error } = await client.rpc('spend_coins', {
      p_actor: 'emily',
      p_item_key: 'pet:koala',
    });
    expect(error).toBeNull();
    expect(data).toBe(50);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm run test:int -- spend_coins`
Expected: FAIL — `function spend_coins(person, text) does not exist`

- [ ] **Step 3: Implementa**

`supabase/migrations/20260817095000_spend_coins.sql`:

```sql
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
```

- [ ] **Step 4: Verifica l'intera suite di integrazione**

Run: `npm run db:reset && npm run test:int`
Expected: tutti PASS. Il database è completo: da qui in poi si lavora solo sul frontend.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: spend_coins con prezzo dal database e lock contro le spese concorrenti"
```

---

### Task 8: Client Supabase, tipi generati e traduzione degli errori

**Files:**
- Create: `lib/supabase/client.ts`, `lib/rpc.ts`, `lib/types.ts` (generato)
- Test: `lib/rpc.test.ts`

**Interfaces:**
- Consumes: `requireEnv` (Task 1); le funzioni SQL (Task 3–7).
- Produces:
  - `getSupabase(): SupabaseClient<Database>` — singleton, usato da ogni hook.
  - `toUserMessage(error: { message: string } | null): string | null` — messaggio inglese o `null` se non c'è errore.
  - `call<T>(promise): Promise<{ data: T | null; error: string | null }>` — avvolge una chiamata Supabase e ne traduce l'errore.

- [ ] **Step 1: Rigenera i tipi, ora che esistono anche le funzioni**

I tipi generati nel Task 2 conoscevano solo le tabelle. Ora includono le firme delle RPC,
ed è ciò che fa segnalare a `tsc` un nome di parametro sbagliato.

```bash
npm run db:types
grep -c 'create_letter\|spend_coins' lib/types.ts
```

Expected: il conteggio è maggiore di zero — le funzioni compaiono sotto `Functions`.

- [ ] **Step 2: Scrivi i test che devono fallire**

`lib/rpc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toUserMessage, call } from './rpc';

describe('toUserMessage', () => {
  it('non produce messaggi quando non c’è errore', () => {
    expect(toUserMessage(null)).toBeNull();
  });

  it('traduce insufficient_funds', () => {
    expect(toUserMessage({ message: 'insufficient_funds' })).toBe(
      "You don't have enough coins for that yet.",
    );
  });

  it('riconosce il codice anche dentro un messaggio più lungo di Postgres', () => {
    expect(
      toUserMessage({ message: 'ERROR: invalid_strokes (SQLSTATE P0001)' }),
    ).toBe("That drawing couldn't be saved. Try drawing it again.");
  });

  it('traduce empty_letter', () => {
    expect(toUserMessage({ message: 'empty_letter' })).toBe('Write something first.');
  });

  it('traduce unknown_item', () => {
    expect(toUserMessage({ message: 'unknown_item' })).toBe("That item doesn't exist anymore.");
  });

  it('usa un messaggio generico per gli errori sconosciuti', () => {
    expect(toUserMessage({ message: 'connection reset by peer' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('non mostra mai all’utente il testo grezzo di Postgres', () => {
    expect(toUserMessage({ message: 'duplicate key value violates unique constraint' })).not.toMatch(
      /constraint/,
    );
  });
});

describe('call', () => {
  it('passa i dati quando la chiamata riesce', async () => {
    const result = await call(Promise.resolve({ data: 42, error: null }));
    expect(result).toEqual({ data: 42, error: null });
  });

  it('traduce l’errore e azzera i dati', async () => {
    const result = await call(
      Promise.resolve({ data: null, error: { message: 'insufficient_funds' } }),
    );
    expect(result.data).toBeNull();
    expect(result.error).toBe("You don't have enough coins for that yet.");
  });

  it('cattura anche un rifiuto della promise, tipicamente la rete', async () => {
    const result = await call(Promise.reject(new Error('Failed to fetch')));
    expect(result.error).toBe('No connection. Your work is still here — try again.');
  });
});
```

- [ ] **Step 3: Esegui e verifica che falisca**

Run: `npm test -- rpc`
Expected: FAIL — `Failed to resolve import "./rpc"`

- [ ] **Step 4: Implementa**

`lib/supabase/client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/lib/types';

let client: SupabaseClient<Database> | null = null;

/**
 * Un solo client per tutta l'app: apre una sola connessione Realtime e condivide
 * la sessione. `persistSession` in localStorage è ciò che rende il login
 * una cosa da fare una volta per telefono.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}

export const coupleEmail = () =>
  requireEnv('NEXT_PUBLIC_COUPLE_EMAIL', process.env.NEXT_PUBLIC_COUPLE_EMAIL);
```

`lib/rpc.ts`:

```ts
/**
 * Confine fra gli errori del database e ciò che legge una persona.
 * Le eccezioni delle funzioni Postgres arrivano come messaggi che contengono
 * il codice che abbiamo scelto noi; tutto il resto diventa un messaggio generico,
 * perché il testo grezzo di Postgres non va mai mostrato.
 */
const MESSAGES: Array<[string, string]> = [
  ['insufficient_funds', "You don't have enough coins for that yet."],
  ['invalid_strokes', "That drawing couldn't be saved. Try drawing it again."],
  ['empty_letter', 'Write something first.'],
  ['unknown_item', "That item doesn't exist anymore."],
  ['unknown_coin_reason', 'Something went wrong. Please try again.'],
];

const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = 'No connection. Your work is still here — try again.';

export function toUserMessage(error: { message: string } | null | undefined): string | null {
  if (!error) return null;
  const found = MESSAGES.find(([code]) => error.message.includes(code));
  return found ? found[1] : GENERIC;
}

type SupabaseResult<T> = { data: T | null; error: { message: string } | null };

/** Avvolge una chiamata Supabase: nessun throw, e l'errore è già leggibile. */
export async function call<T>(
  promise: PromiseLike<SupabaseResult<T>>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await promise;
    if (error) return { data: null, error: toUserMessage(error) };
    return { data, error: null };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : '';
    return { data: null, error: /fetch|network|offline/i.test(message) ? OFFLINE : GENERIC };
  }
}
```

- [ ] **Step 5: Verifica che i test passino**

Run: `npm test -- rpc && npx tsc --noEmit`
Expected: 10 test PASS, nessun errore di tipo.

- [ ] **Step 6: Commit**

```bash
git add lib package.json
git commit -m "feat: client Supabase, tipi generati e traduzione degli errori"
```

---

### Task 9: `useRealtimeQuery`

**Files:**
- Create: `lib/useRealtimeQuery.ts`
- Test: `lib/useRealtimeQuery.test.tsx`

**Interfaces:**
- Consumes: `getSupabase` (Task 8).
- Produces: `useRealtimeQuery<T>({ tables, fetcher, client? }): { data, error, loading, offline, refetch }`. È l'unico punto dell'app che conosce Realtime; ogni schermata live passa da qui. Il parametro `client` esiste per i test.

- [ ] **Step 1: Scrivi i test che devono fallire**

`lib/useRealtimeQuery.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeQuery } from './useRealtimeQuery';

/** Client finto: registra le sottoscrizioni e permette al test di scatenare un evento. */
function fakeClient() {
  const handlers: Array<() => void> = [];
  const removed: string[] = [];
  const channel = {
    name: '',
    on(_event: string, _filter: unknown, handler: () => void) {
      handlers.push(handler);
      return channel;
    },
    subscribe(cb?: (status: string) => void) {
      cb?.('SUBSCRIBED');
      return channel;
    },
  };
  return {
    client: {
      channel(name: string) {
        channel.name = name;
        return channel;
      },
      removeChannel(ch: { name: string }) {
        removed.push(ch.name);
      },
    },
    fireChange: () => handlers.forEach((h) => h()),
    removed,
    handlerCount: () => handlers.length,
  };
}

describe('useRealtimeQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('parte in caricamento e poi espone i dati', async () => {
    const { client } = fakeClient();
    const fetcher = vi.fn().mockResolvedValue(['a']);
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: client as never }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('ri-scarica quando Realtime segnala una modifica', async () => {
    const f = fakeClient();
    const fetcher = vi.fn().mockResolvedValueOnce(['prima']).mockResolvedValueOnce(['dopo']);
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(result.current.data).toEqual(['prima']));

    await act(async () => f.fireChange());
    await waitFor(() => expect(result.current.data).toEqual(['dopo']));
  });

  it('si iscrive a una tabella per ogni tabella richiesta', async () => {
    const f = fakeClient();
    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() =>
      useRealtimeQuery({
        tables: ['letters', 'couple_state'],
        fetcher,
        client: f.client as never,
      }),
    );
    await waitFor(() => expect(f.handlerCount()).toBe(2));
  });

  it('conserva i dati precedenti quando un ri-scarico fallisce', async () => {
    const f = fakeClient();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(['buono'])
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(result.current.data).toEqual(['buono']));

    await act(async () => f.fireChange());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toEqual(['buono']);
  });

  it('ri-scarica quando la connessione torna', async () => {
    const f = fakeClient();
    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('segnala lo stato offline e lo revoca al ritorno online', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const f = fakeClient();
    const { result } = renderHook(() =>
      useRealtimeQuery({
        tables: ['letters'],
        fetcher: vi.fn().mockResolvedValue([]),
        client: f.client as never,
      }),
    );
    await waitFor(() => expect(result.current.offline).toBe(true));

    await act(async () => {
      vi.stubGlobal('navigator', { onLine: true });
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.offline).toBe(false));
  });

  it('rimuove il canale allo smontaggio', async () => {
    const f = fakeClient();
    const { unmount } = renderHook(() =>
      useRealtimeQuery({
        tables: ['letters'],
        fetcher: vi.fn().mockResolvedValue([]),
        client: f.client as never,
      }),
    );
    await waitFor(() => expect(f.handlerCount()).toBe(1));
    unmount();
    expect(f.removed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- useRealtimeQuery`
Expected: FAIL — `Failed to resolve import "./useRealtimeQuery"`

- [ ] **Step 3: Implementa**

`lib/useRealtimeQuery.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { toUserMessage } from '@/lib/rpc';

type Options<T> = {
  /** Tabelle da osservare: una modifica su qualsiasi di queste provoca un ri-scarico. */
  tables: string[];
  fetcher: () => Promise<T>;
  /** Iniettabile solo per i test. */
  client?: SupabaseClient;
};

export type RealtimeQuery<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  offline: boolean;
  refetch: () => void;
};

/**
 * Fetch iniziale, sottoscrizione Realtime, e ri-scarico quando la rete torna.
 *
 * Il ri-scarico completo a ogni evento, invece dell'applicazione incrementale
 * della modifica ricevuta, è deliberato: con due utenti il costo è irrilevante e
 * la correttezza è banale — non esiste stato locale che possa divergere dal database.
 */
export function useRealtimeQuery<T>({ tables, fetcher, client }: Options<T>): RealtimeQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Il fetcher è una closure che cambia a ogni render: tenerlo in un ref evita
  // di ricreare la sottoscrizione Realtime a ogni render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      setOffline(false);
    } catch (thrown) {
      // I dati precedenti restano visibili: meglio qualcosa di vecchio che una schermata vuota.
      setError(toUserMessage({ message: thrown instanceof Error ? thrown.message : '' }));
      if (typeof navigator !== 'undefined' && !navigator.onLine) setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const key = tables.join(',');

  useEffect(() => {
    const supabase = client ?? getSupabase();
    void load();
    setOffline(typeof navigator !== 'undefined' && !navigator.onLine);

    let channel = supabase.channel(`rt:${key}`);
    for (const table of key.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => void load(),
      );
    }
    // Al ritorno della sottoscrizione dopo una disconnessione, lo stato locale
    // può aver perso eventi: si ri-scarica invece di fidarsi.
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') void load();
    });

    const onOnline = () => {
      setOffline(false);
      void load();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [key, load, client]);

  return { data, error, loading, offline, refetch: () => void load() };
}
```

Nota sul test "parte in caricamento": il `subscribe` del client finto invoca subito `SUBSCRIBED`, quindi il fetcher viene chiamato due volte al montaggio. È il comportamento reale e i test contano le chiamate solo dove è rilevante.

- [ ] **Step 4: Verifica che i test passino**

Run: `npm test -- useRealtimeQuery`
Expected: 7 test PASS.

Se il test sul conteggio delle chiamate fallisce per il doppio caricamento iniziale, allinea l'aspettativa al comportamento reale (2 chiamate) — **non** rimuovere il ri-scarico su `SUBSCRIBED`, che è la garanzia di ripresa dopo una disconnessione.

- [ ] **Step 5: Commit**

```bash
git add lib
git commit -m "feat: useRealtimeQuery con ri-scarico su modifica e su riconnessione"
```

---

### Task 10: Identità, login e AuthGate

**Files:**
- Create: `features/auth/identity.ts`, `features/auth/IdentityProvider.tsx`, `features/auth/IdentityChooser.tsx`, `features/auth/AuthGate.tsx`, `features/auth/LoginForm.tsx`
- Create: `features/auth/auth.module.css`
- Test: `features/auth/identity.test.ts`, `features/auth/IdentityChooser.test.tsx`

**Interfaces:**
- Consumes: `getSupabase`, `coupleEmail`, `call` (Task 8).
- Produces:
  - `type Person = 'fabrizio' | 'emily'`, `IDENTITY_KEY = 'fe.who'`
  - `readIdentity(storage): Person | null`, `writeIdentity(storage, who)`, `clearIdentity(storage)`
  - `partnerOf(who): Person`, `displayName(who): string`
  - `useIdentity(): { who: Person; partner: Person; setWho(w: Person): void; forget(): void }` — usata da ogni schermata che ha bisogno di sapere chi sta guardando.
  - `<AuthGate>{children}</AuthGate>` — mostra i figli solo dopo login e scelta identità.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/auth/identity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  IDENTITY_KEY,
  readIdentity,
  writeIdentity,
  clearIdentity,
  partnerOf,
  displayName,
} from './identity';

const fakeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    read: () => Object.fromEntries(map),
  };
};

describe('identity', () => {
  it('usa la chiave fe.who', () => {
    expect(IDENTITY_KEY).toBe('fe.who');
  });

  it('non restituisce identità quando non è stata scelta', () => {
    expect(readIdentity(fakeStorage())).toBeNull();
  });

  it('rilegge l’identità appena scritta', () => {
    const storage = fakeStorage();
    writeIdentity(storage, 'emily');
    expect(readIdentity(storage)).toBe('emily');
  });

  it('ignora un valore non valido invece di fidarsi', () => {
    expect(readIdentity(fakeStorage({ [IDENTITY_KEY]: 'gandalf' }))).toBeNull();
  });

  it('dimentica l’identità', () => {
    const storage = fakeStorage({ [IDENTITY_KEY]: 'fabrizio' });
    clearIdentity(storage);
    expect(readIdentity(storage)).toBeNull();
  });

  it('conosce il partner di ciascuno', () => {
    expect(partnerOf('fabrizio')).toBe('emily');
    expect(partnerOf('emily')).toBe('fabrizio');
  });

  it('mostra i nomi con l’iniziale maiuscola', () => {
    expect(displayName('fabrizio')).toBe('Fabrizio');
    expect(displayName('emily')).toBe('Emily');
  });
});
```

`features/auth/IdentityChooser.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdentityChooser } from './IdentityChooser';

describe('IdentityChooser', () => {
  it('offre entrambe le identità, in inglese', () => {
    render(<IdentityChooser onChoose={vi.fn()} />);
    expect(screen.getByRole('button', { name: "I'm Fabrizio" })).toBeDefined();
    expect(screen.getByRole('button', { name: "I'm Emily" })).toBeDefined();
  });

  it('comunica la scelta', () => {
    const onChoose = vi.fn();
    render(<IdentityChooser onChoose={onChoose} />);
    screen.getByRole('button', { name: "I'm Emily" }).click();
    expect(onChoose).toHaveBeenCalledWith('emily');
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- identity IdentityChooser`
Expected: FAIL — moduli non risolti.

- [ ] **Step 3: Implementa il modulo puro**

`features/auth/identity.ts`:

```ts
export type Person = 'fabrizio' | 'emily';

export const IDENTITY_KEY = 'fe.who';
export const PEOPLE: readonly Person[] = ['fabrizio', 'emily'];

const isPerson = (value: unknown): value is Person =>
  value === 'fabrizio' || value === 'emily';

/**
 * L'identità è una preferenza locale, non una credenziale: chi ha la password
 * condivisa può presentarsi come entrambi. La validazione qui serve solo a non
 * fidarsi di un localStorage manomesso o rimasto da una versione precedente.
 */
export function readIdentity(storage: Pick<Storage, 'getItem'>): Person | null {
  const raw = storage.getItem(IDENTITY_KEY);
  return isPerson(raw) ? raw : null;
}

export function writeIdentity(storage: Pick<Storage, 'setItem'>, who: Person): void {
  storage.setItem(IDENTITY_KEY, who);
}

export function clearIdentity(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(IDENTITY_KEY);
}

export const partnerOf = (who: Person): Person => (who === 'emily' ? 'fabrizio' : 'emily');

export const displayName = (who: Person): string => (who === 'emily' ? 'Emily' : 'Fabrizio');
```

- [ ] **Step 4: Implementa i componenti**

`features/auth/IdentityChooser.tsx`:

```tsx
'use client';

import { PEOPLE, displayName, type Person } from './identity';
import styles from './auth.module.css';

export function IdentityChooser({ onChoose }: { onChoose: (who: Person) => void }) {
  return (
    <main className={styles.gate}>
      <h1 className={styles.title}>Who&rsquo;s holding the phone?</h1>
      <div className={styles.choices}>
        {PEOPLE.map((who) => (
          <button key={who} className={styles.choice} onClick={() => onChoose(who)}>
            I&rsquo;m {displayName(who)}
          </button>
        ))}
      </div>
    </main>
  );
}
```

`features/auth/LoginForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { getSupabase, coupleEmail } from '@/lib/supabase/client';
import styles from './auth.module.css';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // Il campo NON viene svuotato in caso di errore: si riprova correggendo.
    const { error: authError } = await getSupabase().auth.signInWithPassword({
      email: coupleEmail(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError('That’s not the password. Try again?');
      return;
    }
    onSuccess();
  }

  return (
    <main className={styles.gate}>
      <h1 className={styles.title}>Fabrizio &amp; Emily</h1>
      <form onSubmit={submit} className={styles.form}>
        <label className={styles.label} htmlFor="password">
          Our password
        </label>
        <input
          id="password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.submit} disabled={busy || password.length === 0}>
          {busy ? 'Opening…' : 'Come in'}
        </button>
      </form>
    </main>
  );
}
```

`features/auth/IdentityProvider.tsx`:

```tsx
'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { clearIdentity, partnerOf, writeIdentity, type Person } from './identity';

type IdentityValue = {
  who: Person;
  partner: Person;
  setWho: (who: Person) => void;
  forget: () => void;
};

const IdentityContext = createContext<IdentityValue | null>(null);

export function IdentityProvider({ initial, children }: { initial: Person; children: React.ReactNode }) {
  const [who, setWhoState] = useState<Person>(initial);

  const value = useMemo<IdentityValue>(
    () => ({
      who,
      partner: partnerOf(who),
      setWho: (next) => {
        writeIdentity(window.localStorage, next);
        setWhoState(next);
      },
      forget: () => clearIdentity(window.localStorage),
    }),
    [who],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityValue {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('useIdentity va usato dentro IdentityProvider');
  return value;
}
```

`features/auth/AuthGate.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { readIdentity, writeIdentity, type Person } from './identity';
import { IdentityProvider } from './IdentityProvider';
import { IdentityChooser } from './IdentityChooser';
import { LoginForm } from './LoginForm';

type Stage = 'checking' | 'login' | 'identity' | 'ready';

/**
 * Non è una guardia di sicurezza: i dati sono protetti dalle RLS, non dal routing.
 * Serve a non mostrare un'app vuota a chi non ha ancora una sessione o un'identità.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [who, setWho] = useState<Person | null>(null);

  useEffect(() => {
    const supabase = getSupabase();

    const decide = (hasSession: boolean) => {
      if (!hasSession) return setStage('login');
      const stored = readIdentity(window.localStorage);
      setWho(stored);
      setStage(stored ? 'ready' : 'identity');
    };

    void supabase.auth.getSession().then(({ data }) => decide(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      decide(Boolean(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (stage === 'checking') return null;
  if (stage === 'login') return <LoginForm onSuccess={() => setStage('identity')} />;
  if (stage === 'identity' || !who) {
    return (
      <IdentityChooser
        onChoose={(chosen) => {
          writeIdentity(window.localStorage, chosen);
          setWho(chosen);
          setStage('ready');
        }}
      />
    );
  }
  return <IdentityProvider initial={who}>{children}</IdentityProvider>;
}
```

`features/auth/auth.module.css`:

```css
.gate {
  min-height: 100dvh;
  display: grid;
  align-content: center;
  gap: var(--space-6);
  padding: var(--space-6);
  background: var(--bg);
}
.title { font: var(--font-title); color: var(--fg); text-align: center; margin: 0; }
.choices { display: grid; gap: var(--space-4); }
.choice {
  min-height: 88px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-lead);
}
.form { display: grid; gap: var(--space-3); }
.label { font: var(--font-small); color: var(--fg-muted); }
.input {
  min-height: 52px;
  padding: 0 var(--space-4);
  font-size: 17px; /* sotto i 16px iOS ingrandisce la pagina al focus */
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--fg);
}
.submit {
  min-height: 52px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-fg);
  font: var(--font-lead);
}
.submit:disabled { opacity: 0.5; }
.error { font: var(--font-small); color: var(--danger); margin: 0; }
```

- [ ] **Step 5: Verifica che i test passino**

Run: `npm test -- identity IdentityChooser && npx tsc --noEmit`
Expected: 9 test PASS.

- [ ] **Step 6: Commit**

```bash
git add features/auth
git commit -m "feat: login a password condivisa, scelta identità e AuthGate"
```

---

### Task 11: Shell dell'app — token visivi, tab bar, header, PWA

**Files:**
- Create: `app/globals.css`, `app/layout.tsx` (riscrittura), `app/shell.module.css`
- Create: `components/TabBar.tsx`, `components/AppChrome.tsx`, `components/ui/CoinPill.tsx`, `components/ui/OfflineStrip.tsx`, `components/ui/EmptyState.tsx`
- Create: `features/coins/useCoins.ts`
- Create: `app/games/page.tsx`, `app/pets/page.tsx`, `app/questions/page.tsx`, `app/shop/page.tsx`
- Create: `public/manifest.webmanifest`, `public/sw.js`, `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
- Create: `components/ServiceWorker.tsx`, `scripts/make-icons.mjs`
- Test: `components/TabBar.test.tsx`, `components/ui/CoinPill.test.tsx`

**Interfaces:**
- Consumes: `AuthGate` (Task 10).
- Produces: token CSS globali (`--bg`, `--surface`, `--fg`, `--fg-muted`, `--line`, `--accent`, `--accent-fg`, `--danger`, `--font-title`, `--font-lead`, `--font-body`, `--font-small`, `--space-1…6`, `--radius-md`, `--radius-lg`); `<TabBar />`; `<CoinPill coins={n} />`; `<OfflineStrip />`; `<EmptyState title body />`. Le fasi F2–F6 usano questi token e non ne introducono di nuovi senza motivo.

Direzione visiva: **carta e inchiostro caldi**. Sfondo crema, superfici bianche, un solo accento (rosa terracotta) usato con parsimonia per le azioni. Niente ombre marcate: le separazioni sono linee sottili. Le sezioni future prendono lo stesso vocabolario. In F6 un tema acquistato ridefinirà solo questi token su `:root`, quindi **nessun colore va scritto direttamente in un componente**.

- [ ] **Step 1: Scrivi i test che devono fallire**

`components/TabBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabBar } from './TabBar';

vi.mock('next/navigation', () => ({ usePathname: () => '/letters' }));

describe('TabBar', () => {
  it('mostra le cinque sezioni', () => {
    render(<TabBar />);
    for (const label of ['Home', 'Games', 'Letters', 'Pets', 'Questions']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeDefined();
    }
  });

  it('non contiene lo Shop, che si raggiunge dal saldo monete', () => {
    render(<TabBar />);
    expect(screen.queryByRole('link', { name: /Shop/ })).toBeNull();
  });

  it('segna come corrente la sezione attiva', () => {
    render(<TabBar />);
    const letters = screen.getByRole('link', { name: /Letters/ });
    expect(letters.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Home/ }).getAttribute('aria-current')).toBeNull();
  });

  it('collega ogni voce alla propria rotta', () => {
    render(<TabBar />);
    expect(screen.getByRole('link', { name: /Games/ }).getAttribute('href')).toBe('/games');
    expect(screen.getByRole('link', { name: /Questions/ }).getAttribute('href')).toBe('/questions');
  });
});
```

`components/ui/CoinPill.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoinPill } from './CoinPill';

describe('CoinPill', () => {
  it('mostra il saldo e porta allo shop', () => {
    render(<CoinPill coins={1234} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/shop');
    expect(link.textContent).toContain('1,234');
  });

  it('mostra un segnaposto mentre il saldo non è ancora noto', () => {
    render(<CoinPill coins={null} />);
    expect(screen.getByRole('link').textContent).toContain('—');
  });

  it('ha un’etichetta accessibile che spiega il numero', () => {
    render(<CoinPill coins={40} />);
    expect(screen.getByLabelText('40 coins — open the shop')).toBeDefined();
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- TabBar CoinPill`
Expected: FAIL — moduli non risolti.

- [ ] **Step 3: Definisci i token globali**

`app/globals.css`:

```css
:root {
  /* Carta e inchiostro caldi. In F6 un tema acquistato ridefinisce questi valori
     e nient'altro: nessun componente scrive colori propri. */
  --bg: #faf6f0;
  --surface: #ffffff;
  --fg: #1f2933;
  --fg-muted: #6b7280;
  --line: #e7ded1;
  --accent: #c65f52;
  --accent-fg: #ffffff;
  --danger: #b3261e;

  --font-title: 600 26px/1.2 ui-serif, Georgia, serif;
  --font-lead: 600 17px/1.3 system-ui, -apple-system, sans-serif;
  --font-body: 400 16px/1.55 system-ui, -apple-system, sans-serif;
  --font-small: 400 13px/1.4 system-ui, -apple-system, sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  --radius-md: 12px;
  --radius-lg: 20px;

  --tabbar-height: 60px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font: var(--font-body);
  -webkit-text-size-adjust: 100%;
}

/* Nessun rimbalzo orizzontale su mobile. */
body { overflow-x: hidden; }

button, a { -webkit-tap-highlight-color: transparent; }
```

- [ ] **Step 4: Implementa la shell**

`components/TabBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@/app/shell.module.css';

const TABS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/games', label: 'Games', icon: '🎲' },
  { href: '/letters', label: 'Letters', icon: '✉️' },
  { href: '/pets', label: 'Pets', icon: '🐨' },
  { href: '/questions', label: 'Questions', icon: '💬' },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.tabbar} aria-label="Sections">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            <span aria-hidden>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

`components/ui/CoinPill.tsx`:

```tsx
import Link from 'next/link';
import styles from '@/app/shell.module.css';

export function CoinPill({ coins }: { coins: number | null }) {
  const shown = coins === null ? '—' : coins.toLocaleString('en-US');
  const label = coins === null ? 'Open the shop' : `${coins} coins — open the shop`;

  return (
    <Link href="/shop" className={styles.coinPill} aria-label={label}>
      <span aria-hidden>🪙</span>
      <span>{shown}</span>
    </Link>
  );
}
```

`components/ui/OfflineStrip.tsx`:

```tsx
import styles from '@/app/shell.module.css';

export function OfflineStrip() {
  return (
    <p className={styles.offline} role="status">
      You&rsquo;re offline — showing what we already had.
    </p>
  );
}
```

`components/ui/EmptyState.tsx`:

```tsx
import styles from '@/app/shell.module.css';

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
```

`app/shell.module.css`:

```css
.app {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  padding-bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
}
.header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.headerTitle { font: var(--font-lead); margin: 0; }
.whoButton {
  min-height: 44px;
  min-width: 44px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--fg-muted);
  font: var(--font-small);
  padding: 0 var(--space-3);
}
.coinPill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--fg);
  font: var(--font-lead);
  text-decoration: none;
}
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--surface);
  border-top: 1px solid var(--line);
}
.tab {
  display: grid;
  place-items: center;
  gap: 2px;
  min-height: 44px;
  text-decoration: none;
  color: var(--fg-muted);
  font-size: 20px;
}
.tab[aria-current='page'] { color: var(--accent); }
.tabLabel { font: var(--font-small); }
.offline {
  margin: 0;
  padding: var(--space-2) var(--space-4);
  background: var(--line);
  color: var(--fg);
  font: var(--font-small);
  text-align: center;
}
.empty { padding: var(--space-6) var(--space-4); text-align: center; }
.emptyTitle { font: var(--font-lead); margin: 0 0 var(--space-2); }
.emptyBody { font: var(--font-body); color: var(--fg-muted); margin: 0; }
.content { padding: var(--space-4); display: grid; gap: var(--space-4); align-content: start; }
```

`app/layout.tsx` (riscrittura completa):

```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthGate } from '@/features/auth/AuthGate';
import { AppChrome } from '@/components/AppChrome';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'Fabrizio & Emily',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Fabrizio & Emily' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
};

// `viewportFit: cover` è ciò che rende utile env(safe-area-inset-*) sugli iPhone con notch.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf6f0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorker />
        <AuthGate>
          <AppChrome>{children}</AppChrome>
        </AuthGate>
      </body>
    </html>
  );
}
```

`components/AppChrome.tsx`:

```tsx
'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { displayName } from '@/features/auth/identity';
import { useCoins } from '@/features/coins/useCoins';
import { CoinPill } from '@/components/ui/CoinPill';
import { TabBar } from '@/components/TabBar';
import styles from '@/app/shell.module.css';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const { who, setWho, partner } = useIdentity();
  const coins = useCoins();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button
          className={styles.whoButton}
          onClick={() => setWho(partner)}
          title="Tap if this is the wrong person"
        >
          {displayName(who)}
        </button>
        <CoinPill coins={coins} />
      </header>
      <main className={styles.content}>{children}</main>
      <TabBar />
    </div>
  );
}
```

`features/coins/useCoins.ts`:

```ts
'use client';

import { getSupabase } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';

/** Saldo monete condiviso, live: cambia anche quando è l'altro a guadagnare. */
export function useCoins(): number | null {
  const { data } = useRealtimeQuery<number>({
    tables: ['couple_state'],
    fetcher: async () => {
      const { data, error } = await getSupabase()
        .from('couple_state')
        .select('coins')
        .eq('id', 1)
        .single();
      if (error) throw new Error(error.message);
      return data.coins;
    },
  });
  return data;
}
```

Le quattro pagine placeholder, tutte con la stessa forma — `app/games/page.tsx`:

```tsx
import { EmptyState } from '@/components/ui/EmptyState';

export default function GamesPage() {
  return <EmptyState title="Games" body="Tic-tac-toe, Connect 4 and more are coming here soon." />;
}
```

`app/pets/page.tsx` → titolo `Pets`, corpo `Your animals and plants will live here.`
`app/questions/page.tsx` → titolo `Questions`, corpo `300 questions to ask each other, coming soon.`
`app/shop/page.tsx` → titolo `Shop`, corpo `Themes, avatars and little decorations, coming soon.`

- [ ] **Step 5: Aggiungi la PWA**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#faf6f0"/>
  <path d="M256 400c-80-52-136-100-136-160a72 72 0 0 1 136-32 72 72 0 0 1 136 32c0 60-56 108-136 160z" fill="#c65f52"/>
</svg>
```

`scripts/make-icons.mjs` — genera i PNG richiesti dal manifest e da iOS:

```js
// Una volta sola, in sviluppo: sharp non finisce nel bundle.
// npm i -D sharp && node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
for (const [size, name] of [
  [192, 'public/icon-192.png'],
  [512, 'public/icon-512.png'],
  [180, 'public/apple-touch-icon.png'],
]) {
  await sharp(svg).resize(size, size).png().toFile(name);
  console.log('scritto', name);
}
```

Run: `npm i -D sharp && node scripts/make-icons.mjs`

`public/manifest.webmanifest`:

```json
{
  "name": "Fabrizio & Emily",
  "short_name": "Fabri&Emily",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf6f0",
  "theme_color": "#faf6f0",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`public/sw.js` — solo la shell in cache, nessun dato:

```js
// I dati NON vengono messi in cache: le lettere devono essere fresche, e la
// gestione dell'offline sta in useRealtimeQuery. Qui si evita solo la pagina
// bianca all'apertura senza rete.
const CACHE = 'fe-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r ?? caches.match('/'))),
  );
});
```

`components/ServiceWorker.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
  }, []);
  return null;
}
```

- [ ] **Step 6: Verifica**

Run: `npm test -- TabBar CoinPill && npx tsc --noEmit && npm run build`
Expected: 7 test PASS, build completata.

Poi, a mano: `npm run dev`, apri `http://localhost:3000` con il device toolbar su iPhone 13, inserisci la password, scegli un'identità, e verifica che la tab bar sia raggiungibile col pollice e che le quattro pagine placeholder si aprano.

- [ ] **Step 7: Commit**

```bash
git add app components features public scripts package.json
git commit -m "feat: shell dell'app con token visivi, tab bar, header e PWA installabile"
```

---

### Task 12: `strokes.ts` — il formato dei disegni

**Files:**
- Create: `features/letters/strokes.ts`
- Test: `features/letters/strokes.test.ts`

**Interfaces:**
- Consumes: niente. È un modulo puro, senza React e senza DOM globale.
- Produces:
  - costanti `PALETTE` (12 colori), `WIDTHS = [6, 14, 30]`, `CANVAS_UNITS = 1000`, `MAX_STROKES = 200`, `MAX_POINTS_PER_STROKE = 400`, `MIN_POINT_DISTANCE = 4`, `MIN_STROKES_FOR_REWARD = 5`
  - `type Stroke = { c: number; w: number; p: number[] }`
  - `toUnits(px: number, sizePx: number): number`
  - `startStroke(c: number, w: number, x: number, y: number): Stroke`
  - `appendPoint(stroke: Stroke, x: number, y: number): Stroke` — **ritorna lo stesso riferimento** se il punto è stato scartato
  - `undo(strokes: Stroke[]): Stroke[]`
  - `canAddStroke(strokes: Stroke[]): boolean`
  - `drawStrokes(ctx, strokes, sizePx, visibleStrokes?): void`
  - `isStrokeArray(value: unknown): value is Stroke[]`

I limiti replicano esattamente quelli validati da `assert_valid_strokes` (Task 5): il client evita di produrre dati che il database rifiuterebbe.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/letters/strokes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PALETTE,
  WIDTHS,
  CANVAS_UNITS,
  MAX_STROKES,
  MAX_POINTS_PER_STROKE,
  toUnits,
  startStroke,
  appendPoint,
  undo,
  canAddStroke,
  drawStrokes,
  isStrokeArray,
  type Stroke,
} from './strokes';

describe('costanti del formato', () => {
  it('ha dodici colori, tutti esadecimali', () => {
    expect(PALETTE).toHaveLength(12);
    for (const color of PALETTE) expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('ha tre spessori, in ordine crescente', () => {
    expect(WIDTHS).toEqual([6, 14, 30]);
  });
});

describe('toUnits', () => {
  it('converte i pixel nello spazio logico', () => {
    expect(toUnits(250, 500)).toBe(500);
    expect(toUnits(0, 500)).toBe(0);
    expect(toUnits(500, 500)).toBe(CANVAS_UNITS);
  });

  it('restituisce interi, non decimali', () => {
    expect(Number.isInteger(toUnits(123, 377))).toBe(true);
  });

  it('taglia i valori fuori dalla tela invece di produrre coordinate invalide', () => {
    expect(toUnits(-40, 500)).toBe(0);
    expect(toUnits(900, 500)).toBe(CANVAS_UNITS);
  });
});

describe('costruzione di un tratto', () => {
  it('parte con un solo punto', () => {
    expect(startStroke(3, 1, 100, 200)).toEqual({ c: 3, w: 1, p: [100, 200] });
  });

  it('aggiunge un punto abbastanza distante', () => {
    const next = appendPoint(startStroke(0, 0, 100, 100), 110, 100);
    expect(next.p).toEqual([100, 100, 110, 100]);
  });

  it('scarta un punto troppo vicino, restituendo lo stesso tratto', () => {
    const stroke = startStroke(0, 0, 100, 100);
    const next = appendPoint(stroke, 102, 100);
    expect(next).toBe(stroke);
  });

  it('non muta il tratto di partenza', () => {
    const stroke = startStroke(0, 0, 100, 100);
    appendPoint(stroke, 200, 200);
    expect(stroke.p).toEqual([100, 100]);
  });

  it('smette di aggiungere punti raggiunto il limite del tratto', () => {
    let stroke: Stroke = startStroke(0, 0, 0, 0);
    for (let i = 1; i <= MAX_POINTS_PER_STROKE + 50; i++) stroke = appendPoint(stroke, i * 5, 0);
    expect(stroke.p).toHaveLength(MAX_POINTS_PER_STROKE * 2);
  });
});

describe('undo e limiti', () => {
  it('rimuove esattamente l’ultimo tratto', () => {
    const a = startStroke(0, 0, 1, 1);
    const b = startStroke(1, 1, 2, 2);
    expect(undo([a, b])).toEqual([a]);
  });

  it('su una tela vuota non fa nulla', () => {
    expect(undo([])).toEqual([]);
  });

  it('non muta l’array originale', () => {
    const list = [startStroke(0, 0, 1, 1)];
    undo(list);
    expect(list).toHaveLength(1);
  });

  it('impedisce di superare i 200 tratti', () => {
    const many = Array.from({ length: MAX_STROKES }, () => startStroke(0, 0, 1, 1));
    expect(canAddStroke(many)).toBe(false);
    expect(canAddStroke(many.slice(1))).toBe(true);
  });
});

describe('isStrokeArray', () => {
  const valid: Stroke[] = [{ c: 0, w: 0, p: [1, 2, 3, 4] }];

  it('accetta tratti ben formati', () => {
    expect(isStrokeArray(valid)).toBe(true);
  });

  it.each([
    ['non un array', { c: 0 }],
    ['colore fuori palette', [{ c: 12, w: 0, p: [1, 2] }]],
    ['spessore inesistente', [{ c: 0, w: 5, p: [1, 2] }]],
    ['coordinate dispari', [{ c: 0, w: 0, p: [1, 2, 3] }]],
    ['coordinata oltre il limite', [{ c: 0, w: 0, p: [1, 2000] }]],
    ['coordinata non numerica', [{ c: 0, w: 0, p: [1, 'x'] }]],
    ['campo mancante', [{ c: 0, p: [1, 2] }]],
    ['troppi tratti', Array.from({ length: MAX_STROKES + 1 }, () => valid[0])],
  ])('rifiuta: %s', (_name, value) => {
    expect(isStrokeArray(value)).toBe(false);
  });
});

describe('drawStrokes', () => {
  /** Contesto finto: registra le chiamate per poterle verificare. */
  function fakeCtx() {
    const calls: string[] = [];
    const record = (name: string) => (...args: unknown[]) =>
      void calls.push(`${name}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : a)).join(',')})`);
    return {
      calls,
      ctx: {
        clearRect: record('clearRect'),
        beginPath: record('beginPath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        quadraticCurveTo: record('quadraticCurveTo'),
        stroke: record('stroke'),
        set strokeStyle(v: string) { calls.push(`strokeStyle=${v}`); },
        set lineWidth(v: number) { calls.push(`lineWidth=${Math.round(v)}`); },
        set lineCap(v: string) { calls.push(`lineCap=${v}`); },
        set lineJoin(v: string) { calls.push(`lineJoin=${v}`); },
      } as unknown as CanvasRenderingContext2D,
    };
  }

  it('pulisce la tela prima di disegnare', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [], 500);
    expect(calls[0]).toBe('clearRect(0,0,500,500)');
  });

  it('scala le coordinate dallo spazio logico ai pixel', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 0, p: [0, 0, 1000, 1000] }], 500);
    expect(calls).toContain('moveTo(0,0)');
    expect(calls).toContain('lineTo(500,500)');
  });

  it('scala anche lo spessore del tratto', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 2, p: [0, 0, 100, 100] }], 500);
    expect(calls).toContain('lineWidth=15'); // 30 unità su tela da 500 px
  });

  it('usa il colore della palette corrispondente all’indice', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 1, w: 0, p: [0, 0, 10, 10] }], 500);
    expect(calls).toContain(`strokeStyle=${PALETTE[1]}`);
  });

  it('usa estremità arrotondate', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 0, p: [0, 0, 10, 10] }], 500);
    expect(calls).toContain('lineCap=round');
    expect(calls).toContain('lineJoin=round');
  });

  it('interpola con curve quando i punti sono più di due', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 0, p: [0, 0, 100, 0, 200, 100] }], 1000);
    expect(calls.some((c) => c.startsWith('quadraticCurveTo'))).toBe(true);
  });

  it('disegna solo i primi N tratti quando richiesto — è la base del replay', () => {
    const { ctx, calls } = fakeCtx();
    const three: Stroke[] = [
      { c: 0, w: 0, p: [0, 0, 10, 10] },
      { c: 1, w: 0, p: [0, 0, 10, 10] },
      { c: 2, w: 0, p: [0, 0, 10, 10] },
    ];
    drawStrokes(ctx, three, 500, 2);
    expect(calls.filter((c) => c === 'stroke()')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- strokes`
Expected: FAIL — `Failed to resolve import "./strokes"`

- [ ] **Step 3: Implementa**

`features/letters/strokes.ts`:

```ts
/**
 * Formato dei disegni. Un disegno è una lista di tratti, ogni tratto è un colore,
 * uno spessore e una polilinea in uno spazio logico 1000 × 1000 con coordinate intere.
 *
 * Perché vettoriale e non un PNG: annullare è togliere l'ultimo elemento da un array,
 * il peso è di qualche kilobyte invece di qualche centinaio, non serve Storage, e i
 * tratti sono in ordine — quindi il disegno si può rigiocare come è stato fatto.
 *
 * I limiti qui sono gli stessi che il database valida in assert_valid_strokes:
 * il client non deve poter produrre dati che il database rifiuterebbe.
 */

export const PALETTE = [
  '#1F2933', // 0 ink
  '#E4572E', // 1 red
  '#F4A259', // 2 orange
  '#F2C14E', // 3 yellow
  '#8FBC5A', // 4 lime
  '#2E9E6B', // 5 green
  '#2AA8A8', // 6 teal
  '#4C9BE8', // 7 sky
  '#3355C4', // 8 blue
  '#7B5EA7', // 9 violet
  '#E86AA6', // 10 pink
  '#8C6239', // 11 brown
] as const;

export const WIDTHS = [6, 14, 30] as const;
export const CANVAS_UNITS = 1000;
export const MAX_STROKES = 200;
export const MAX_POINTS_PER_STROKE = 400;
export const MIN_POINT_DISTANCE = 4;
/** Solo per la copy dell'interfaccia: la regola vera vive in coin_rules. */
export const MIN_STROKES_FOR_REWARD = 5;

export type Stroke = { c: number; w: number; p: number[] };

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Da pixel della tela a unità logiche. Il taglio evita coordinate fuori range
 *  quando il dito esce dalla tela durante il tratto. */
export function toUnits(px: number, sizePx: number): number {
  return Math.round(clamp((px / sizePx) * CANVAS_UNITS, 0, CANVAS_UNITS));
}

export function startStroke(c: number, w: number, x: number, y: number): Stroke {
  return { c, w, p: [x, y] };
}

/**
 * Aggiunge un punto, scartandolo se troppo vicino al precedente o se il tratto è pieno.
 * Ritorna lo **stesso riferimento** quando non aggiunge nulla: così il chiamante può
 * evitare un re-render con un semplice confronto di identità.
 */
export function appendPoint(stroke: Stroke, x: number, y: number): Stroke {
  if (stroke.p.length >= MAX_POINTS_PER_STROKE * 2) return stroke;
  const lastX = stroke.p[stroke.p.length - 2];
  const lastY = stroke.p[stroke.p.length - 1];
  if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE) return stroke;
  return { ...stroke, p: [...stroke.p, x, y] };
}

export function undo(strokes: Stroke[]): Stroke[] {
  return strokes.slice(0, -1);
}

export function canAddStroke(strokes: Stroke[]): boolean {
  return strokes.length < MAX_STROKES;
}

export function isStrokeArray(value: unknown): value is Stroke[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STROKES) return false;
  return value.every((stroke) => {
    if (typeof stroke !== 'object' || stroke === null) return false;
    const { c, w, p } = stroke as Partial<Stroke>;
    if (!Number.isInteger(c) || c! < 0 || c! >= PALETTE.length) return false;
    if (!Number.isInteger(w) || w! < 0 || w! >= WIDTHS.length) return false;
    if (!Array.isArray(p) || p.length < 2 || p.length % 2 !== 0) return false;
    if (p.length > MAX_POINTS_PER_STROKE * 2) return false;
    return p.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= CANVAS_UNITS);
  });
}

/**
 * Disegna su una tela quadrata di `sizePx` pixel di lato.
 * `visibleStrokes` limita quanti tratti disegnare: è tutto ciò che serve al replay.
 */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  sizePx: number,
  visibleStrokes?: number,
): void {
  const scale = sizePx / CANVAS_UNITS;
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const count = visibleStrokes ?? strokes.length;
  for (const stroke of strokes.slice(0, count)) {
    const points = stroke.p;
    ctx.strokeStyle = PALETTE[stroke.c] ?? PALETTE[0];
    ctx.lineWidth = (WIDTHS[stroke.w] ?? WIDTHS[0]) * scale;
    ctx.beginPath();
    ctx.moveTo(points[0] * scale, points[1] * scale);

    if (points.length === 4) {
      ctx.lineTo(points[2] * scale, points[3] * scale);
    } else {
      // Curve quadratiche fra i punti medi: il tratto risulta liscio invece di spigoloso.
      for (let i = 2; i < points.length - 2; i += 2) {
        const midX = (points[i] + points[i + 2]) / 2;
        const midY = (points[i + 1] + points[i + 3]) / 2;
        ctx.quadraticCurveTo(points[i] * scale, points[i + 1] * scale, midX * scale, midY * scale);
      }
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      ctx.lineTo(lastX * scale, lastY * scale);
    }
    ctx.stroke();
  }
}
```

- [ ] **Step 4: Verifica che i test passino**

Run: `npm test -- strokes`
Expected: 31 test PASS.

- [ ] **Step 5: Commit**

```bash
git add features/letters
git commit -m "feat: formato vettoriale dei disegni con undo, limiti e rendering"
```

---

### Task 13: Livello dati delle lettere

**Files:**
- Create: `features/letters/queries.ts`, `features/letters/grouping.ts`, `features/letters/useLetters.ts`
- Test: `features/letters/grouping.test.ts`, `supabase/tests/queries.test.ts`

**Interfaces:**
- Consumes: `getSupabase`, `call` (Task 8); `useRealtimeQuery` (Task 9); `Person` (Task 10); `Stroke` (Task 12).
- Produces:
  - `type Letter = { id, author: Person, kind: 'text' | 'drawing', body: string | null, strokes: Stroke[] | null, created_at: string, read_at: string | null }`
  - `fetchLetters(client?): Promise<Letter[]>` — tutte, dalla più recente
  - `fetchLetter(id, client?): Promise<Letter | null>`
  - `sendText(author, body, client?): Promise<{ data: Letter | null; error: string | null }>`
  - `sendDrawing(author, strokes, client?): Promise<{ data: Letter | null; error: string | null }>`
  - `markRead(id, reader, client?): Promise<{ error: string | null }>`
  - `groupByMonth(letters): Array<{ label: string; letters: Letter[] }>`
  - `isUnread(letter, who): boolean`
  - `unreadFor(letters, who): Letter[]`
  - `useLetters(): RealtimeQuery<Letter[]>`

I test di integrazione di questo task hanno un valore specifico: verificano che i **nomi dei parametri** passati alle RPC (`p_author`, `p_kind`, `p_body`, `p_strokes`, `p_id`, `p_reader`) coincidano con le firme SQL. È l'errore più facile da fare e il più silenzioso.

- [ ] **Step 1: Scrivi i test puri che devono fallire**

`features/letters/grouping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupByMonth, isUnread, unreadFor } from './grouping';
import type { Letter } from './queries';

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: crypto.randomUUID(),
  author: 'emily',
  kind: 'text',
  body: 'hello',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('groupByMonth', () => {
  it('raggruppa per mese e anno, con etichette in inglese', () => {
    const groups = groupByMonth([
      letter({ created_at: '2026-08-14T10:00:00Z' }),
      letter({ created_at: '2026-08-02T10:00:00Z' }),
      letter({ created_at: '2026-07-30T10:00:00Z' }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['August 2026', 'July 2026']);
    expect(groups[0].letters).toHaveLength(2);
  });

  it('tiene distinti gli stessi mesi di anni diversi', () => {
    const groups = groupByMonth([
      letter({ created_at: '2026-08-14T10:00:00Z' }),
      letter({ created_at: '2025-08-14T10:00:00Z' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('su una lista vuota non produce gruppi', () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it('conserva l’ordine di arrivo dentro ogni gruppo', () => {
    const first = letter({ created_at: '2026-08-14T10:00:00Z', body: 'prima' });
    const second = letter({ created_at: '2026-08-13T10:00:00Z', body: 'seconda' });
    expect(groupByMonth([first, second])[0].letters.map((l) => l.body)).toEqual([
      'prima',
      'seconda',
    ]);
  });
});

describe('isUnread', () => {
  it('è non letta se l’ha scritta l’altro e non è stata aperta', () => {
    expect(isUnread(letter({ author: 'emily', read_at: null }), 'fabrizio')).toBe(true);
  });

  it('le proprie lettere non sono mai non lette', () => {
    expect(isUnread(letter({ author: 'emily', read_at: null }), 'emily')).toBe(false);
  });

  it('una lettera già aperta non è non letta', () => {
    expect(
      isUnread(letter({ author: 'emily', read_at: '2026-08-14T11:00:00Z' }), 'fabrizio'),
    ).toBe(false);
  });
});

describe('unreadFor', () => {
  it('restituisce solo le non lette, dalla più vecchia alla più recente', () => {
    const older = letter({ created_at: '2026-08-10T10:00:00Z', body: 'vecchia' });
    const newer = letter({ created_at: '2026-08-14T10:00:00Z', body: 'nuova' });
    const mine = letter({ author: 'fabrizio', body: 'mia' });
    const read = letter({ read_at: '2026-08-14T12:00:00Z', body: 'letta' });
    expect(unreadFor([newer, read, older, mine], 'fabrizio').map((l) => l.body)).toEqual([
      'vecchia',
      'nuova',
    ]);
  });

  it('senza non lette restituisce una lista vuota', () => {
    expect(unreadFor([letter({ author: 'fabrizio' })], 'fabrizio')).toEqual([]);
  });
});
```

- [ ] **Step 2: Scrivi il test di integrazione delle query**

`supabase/tests/queries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetData, signedInClient, sql } from './helpers';
import {
  fetchLetters,
  fetchLetter,
  sendText,
  sendDrawing,
  markRead,
} from '@/features/letters/queries';

const LONG = 'This is long enough to earn the fifteen coins it deserves, I promise.';
const STROKES = Array.from({ length: 5 }, (_, i) => ({ c: i, w: 1, p: [10, 10, 40, 40] }));

describe('queries delle lettere contro il database reale', () => {
  beforeEach(resetData);

  it('sendText usa i nomi di parametro giusti e ritorna la lettera', async () => {
    const client = await signedInClient();
    const { data, error } = await sendText('fabrizio', LONG, client);
    expect(error).toBeNull();
    expect(data?.author).toBe('fabrizio');
    expect(data?.kind).toBe('text');
  });

  it('sendDrawing salva i tratti', async () => {
    const client = await signedInClient();
    const { data, error } = await sendDrawing('emily', STROKES, client);
    expect(error).toBeNull();
    expect(data?.strokes).toEqual(STROKES);
  });

  it('traduce l’errore di una lettera vuota', async () => {
    const client = await signedInClient();
    const { data, error } = await sendText('emily', '   ', client);
    expect(data).toBeNull();
    expect(error).toBe('Write something first.');
  });

  it('traduce l’errore di un disegno malformato', async () => {
    const client = await signedInClient();
    const { error } = await sendDrawing('emily', [{ c: 99, w: 0, p: [1, 1] }], client);
    expect(error).toBe("That drawing couldn't be saved. Try drawing it again.");
  });

  it('fetchLetters ritorna dalla più recente', async () => {
    const client = await signedInClient();
    await sendText('emily', `${LONG} uno`, client);
    await sendText('emily', `${LONG} due`, client);
    const letters = await fetchLetters(client);
    expect(letters[0].body).toContain('due');
    expect(letters).toHaveLength(2);
  });

  it('fetchLetter trova una lettera per id, e null per un id inesistente', async () => {
    const client = await signedInClient();
    const { data } = await sendText('emily', LONG, client);
    expect((await fetchLetter(data!.id, client))?.body).toBe(LONG);
    expect(await fetchLetter('00000000-0000-0000-0000-000000000000', client)).toBeNull();
  });

  it('markRead segna la lettera come letta dal destinatario', async () => {
    const client = await signedInClient();
    const { data } = await sendText('emily', LONG, client);
    const { error } = await markRead(data!.id, 'fabrizio', client);
    expect(error).toBeNull();
    expect((await fetchLetter(data!.id, client))?.read_at).not.toBeNull();
  });

  it('il saldo monete si muove come previsto', async () => {
    const client = await signedInClient();
    await sendText('emily', LONG, client);
    await sendDrawing('emily', STROKES, client);
    const rows = await sql<{ coins: number }>('select coins from couple_state where id = 1');
    expect(rows[0].coins).toBe(35);
  });
});
```

- [ ] **Step 3: Esegui e verifica che falliscano**

Run: `npm test -- grouping ; npm run test:int -- queries`
Expected: FAIL entrambi — moduli non risolti.

- [ ] **Step 4: Implementa**

`features/letters/queries.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database } from '@/lib/types';
import type { Person } from '@/features/auth/identity';
import type { Stroke } from './strokes';

export type Letter = {
  id: string;
  author: Person;
  kind: 'text' | 'drawing';
  body: string | null;
  strokes: Stroke[] | null;
  created_at: string;
  read_at: string | null;
};

const COLUMNS = 'id, author, kind, body, strokes, created_at, read_at';

// Il parametro `client` esiste perché i test di integrazione girano in node con una
// sessione creata a mano; nell'app resta sempre il singleton.
export type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

// I tipi generati dichiarano `strokes: Json`. Qui lo restringiamo al nostro formato:
// la garanzia non viene dal tipo ma da assert_valid_strokes, che è l'unica via d'ingresso.
const asLetter = (row: unknown): Letter => row as Letter;

export async function fetchLetters(client?: Client): Promise<Letter[]> {
  const { data, error } = await db(client)
    .from('letters')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(asLetter);
}

export async function fetchLetter(id: string, client?: Client): Promise<Letter | null> {
  const { data, error } = await db(client)
    .from('letters')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asLetter(data) : null;
}

export async function sendText(author: Person, body: string, client?: Client) {
  const { data, error } = await call(
    db(client)
      .rpc('create_letter', { p_author: author, p_kind: 'text', p_body: body, p_strokes: null })
      .single(),
  );
  return { data: data ? asLetter(data) : null, error };
}

export async function sendDrawing(author: Person, strokes: Stroke[], client?: Client) {
  const { data, error } = await call(
    db(client)
      .rpc('create_letter', {
        p_author: author,
        p_kind: 'drawing',
        p_body: null,
        p_strokes: strokes,
      })
      .single(),
  );
  return { data: data ? asLetter(data) : null, error };
}

export async function markRead(id: string, reader: Person, client?: Client) {
  const { error } = await call(db(client).rpc('mark_letter_read', { p_id: id, p_reader: reader }));
  return { error };
}
```

`features/letters/grouping.ts`:

```ts
import type { Person } from '@/features/auth/identity';
import type { Letter } from './queries';

/** "August 2026". Le etichette sono interfaccia, quindi in inglese. */
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function groupByMonth(letters: Letter[]): Array<{ label: string; letters: Letter[] }> {
  const groups: Array<{ label: string; letters: Letter[] }> = [];
  for (const letter of letters) {
    const label = monthLabel(letter.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.letters.push(letter);
    else groups.push({ label, letters: [letter] });
  }
  return groups;
}

/** Le proprie lettere non sono mai "non lette": si scrivono già sapendo cosa dicono. */
export const isUnread = (letter: Letter, who: Person): boolean =>
  letter.read_at === null && letter.author !== who;

/** Dalla più vecchia: si aprono nell'ordine in cui sono state scritte. */
export const unreadFor = (letters: Letter[], who: Person): Letter[] =>
  letters
    .filter((letter) => isUnread(letter, who))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
```

`features/letters/useLetters.ts`:

```ts
'use client';

import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchLetters, type Letter } from './queries';

export function useLetters() {
  return useRealtimeQuery<Letter[]>({ tables: ['letters'], fetcher: () => fetchLetters() });
}
```

- [ ] **Step 5: Verifica**

Run: `npm test -- grouping && npm run test:int -- queries`
Expected: 9 test unit PASS, 8 test di integrazione PASS.

- [ ] **Step 6: Commit**

```bash
git add features/letters supabase/tests
git commit -m "feat: livello dati delle lettere con raggruppamento e non-lette"
```

---

### Task 14: Archivio delle lettere

**Files:**
- Create: `app/letters/page.tsx`, `features/letters/LetterCard.tsx`, `features/letters/DrawingThumbnail.tsx`, `features/letters/letters.module.css`
- Test: `features/letters/LetterCard.test.tsx`

**Interfaces:**
- Consumes: `useLetters`, `groupByMonth`, `isUnread`, `Letter` (Task 13); `drawStrokes` (Task 12); `useIdentity` (Task 10); `EmptyState`, `OfflineStrip` (Task 11).
- Produces: `<LetterCard letter who />`, `<DrawingThumbnail strokes size />`. Il thumbnail è usato anche dalla Home in Task 18.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/letters/LetterCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LetterCard } from './LetterCard';
import type { Letter } from './queries';

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: '11111111-1111-1111-1111-111111111111',
  author: 'emily',
  kind: 'text',
  body: 'I walked past the bakery today and thought of you for the whole afternoon.',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('LetterCard', () => {
  it('nomina l’autore', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByText('Emily')).toBeDefined();
  });

  it('mostra un estratto del testo', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByText(/walked past the bakery/)).toBeDefined();
  });

  it('accorcia gli estratti lunghi', () => {
    render(<LetterCard letter={letter({ body: 'a'.repeat(300) })} who="fabrizio" />);
    const excerpt = screen.getByTestId('excerpt').textContent ?? '';
    expect(excerpt.length).toBeLessThan(160);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('segnala le lettere non lette', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByLabelText('Unread')).toBeDefined();
  });

  it('non segnala le proprie lettere come non lette', () => {
    render(<LetterCard letter={letter({ author: 'fabrizio' })} who="fabrizio" />);
    expect(screen.queryByLabelText('Unread')).toBeNull();
  });

  it('non segnala una lettera già aperta', () => {
    render(<LetterCard letter={letter({ read_at: '2026-08-14T12:00:00Z' })} who="fabrizio" />);
    expect(screen.queryByLabelText('Unread')).toBeNull();
  });

  it('collega al dettaglio della lettera', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/letters/11111111-1111-1111-1111-111111111111',
    );
  });

  it('per un disegno mostra una miniatura invece del testo', () => {
    render(
      <LetterCard
        letter={letter({ kind: 'drawing', body: null, strokes: [{ c: 0, w: 0, p: [1, 1, 2, 2] }] })}
        who="fabrizio"
      />,
    );
    expect(screen.getByLabelText('Drawing from Emily')).toBeDefined();
    expect(screen.queryByTestId('excerpt')).toBeNull();
  });

  it('mostra la data in formato leggibile', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByText(/Aug 14/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- LetterCard`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementa**

`features/letters/DrawingThumbnail.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { drawStrokes, type Stroke } from './strokes';

/**
 * Ridisegna i tratti su una tela piccola. Nessun thumbnail viene generato o salvato:
 * i tratti SONO il disegno, e ridisegnarli costa meno di scaricare un'immagine.
 */
export function DrawingThumbnail({
  strokes,
  size,
  label,
}: {
  strokes: Stroke[];
  size: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // in jsdom getContext è null: il componente resta valido
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    drawStrokes(ctx, strokes, size);
  }, [strokes, size]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      style={{ width: size, height: size, borderRadius: 'var(--radius-md)', background: '#fff' }}
    />
  );
}
```

`features/letters/LetterCard.tsx`:

```tsx
import Link from 'next/link';
import { displayName, type Person } from '@/features/auth/identity';
import { isUnread } from './grouping';
import { DrawingThumbnail } from './DrawingThumbnail';
import type { Letter } from './queries';
import styles from './letters.module.css';

const EXCERPT_LENGTH = 140;

const excerpt = (body: string) =>
  body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…` : body;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function LetterCard({ letter, who }: { letter: Letter; who: Person }) {
  const author = displayName(letter.author);

  return (
    <Link href={`/letters/${letter.id}`} className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.author}>{author}</span>
        <span className={styles.date}>{shortDate(letter.created_at)}</span>
        {isUnread(letter, who) && <span className={styles.dot} aria-label="Unread" />}
      </div>

      {letter.kind === 'drawing' && letter.strokes ? (
        <DrawingThumbnail strokes={letter.strokes} size={96} label={`Drawing from ${author}`} />
      ) : (
        <p className={styles.excerpt} data-testid="excerpt">
          {excerpt(letter.body ?? '')}
        </p>
      )}
    </Link>
  );
}
```

`app/letters/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { useLetters } from '@/features/letters/useLetters';
import { groupByMonth } from '@/features/letters/grouping';
import { LetterCard } from '@/features/letters/LetterCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/letters/letters.module.css';

export default function LettersPage() {
  const { who } = useIdentity();
  const { data, loading, offline, error } = useLetters();
  const letters = data ?? [];

  return (
    <>
      {offline && <OfflineStrip />}
      <div className={styles.actions}>
        <Link href="/letters/new" className={styles.primaryAction}>
          Write a letter
        </Link>
        <Link href="/letters/draw" className={styles.secondaryAction}>
          Draw something
        </Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading && letters.length === 0 && <p className={styles.muted}>Opening the archive…</p>}

      {!loading && letters.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          body="Write the first letter, or draw something silly."
        />
      )}

      {groupByMonth(letters).map((group) => (
        <section key={group.label} className={styles.month}>
          <h2 className={styles.monthLabel}>{group.label}</h2>
          <div className={styles.list}>
            {group.letters.map((letter) => (
              <LetterCard key={letter.id} letter={letter} who={who} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
```

`features/letters/letters.module.css`:

```css
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.primaryAction, .secondaryAction {
  display: grid;
  place-items: center;
  min-height: 52px;
  border-radius: var(--radius-md);
  text-decoration: none;
  font: var(--font-lead);
}
.primaryAction { background: var(--accent); color: var(--accent-fg); }
.secondaryAction { background: var(--surface); color: var(--fg); border: 1px solid var(--line); }

.month { display: grid; gap: var(--space-3); }
.monthLabel { font: var(--font-small); color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }
.list { display: grid; gap: var(--space-3); }

.card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--fg);
}
.cardHead { display: flex; align-items: center; gap: var(--space-2); }
.author { font: var(--font-lead); }
.date { font: var(--font-small); color: var(--fg-muted); margin-left: auto; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.excerpt { font: var(--font-body); margin: 0; color: var(--fg); }
.muted { font: var(--font-small); color: var(--fg-muted); }
.error { font: var(--font-small); color: var(--danger); }

.detail { display: grid; gap: var(--space-4); }
.detailBody { font: var(--font-body); white-space: pre-wrap; margin: 0; }
.detailMeta { font: var(--font-small); color: var(--fg-muted); }

.composer { display: grid; gap: var(--space-3); }
.textarea {
  min-height: 40dvh;
  padding: var(--space-4);
  font: var(--font-body);
  font-size: 17px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg);
  resize: none;
}
.send {
  min-height: 52px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-fg);
  font: var(--font-lead);
}
.send:disabled { opacity: 0.45; }
.counter { font: var(--font-small); color: var(--fg-muted); text-align: right; }

/* Replay del disegno: sta qui e non in draw.module.css perché serve al dettaglio
   della lettera (Task 16), che non dipende dall'editor (Task 17). */
.replayWrap { display: grid; gap: var(--space-3); }
.replayCanvas {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}
.replayButton {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-small);
}
```

- [ ] **Step 4: Verifica**

Run: `npm test -- LetterCard && npx tsc --noEmit`
Expected: 9 test PASS.

- [ ] **Step 5: Verifica a mano con dati veri**

```bash
psql "$(grep DB_URL .env.test | cut -d= -f2- | tr -d '"')" -c \
  "select create_letter('emily','text','A letter long enough to be worth fifteen coins, written by hand.',null)"
npm run dev
```

Apri `/letters`: la lettera compare sotto "August 2026" con il pallino di non letta (se hai scelto Fabrizio).

- [ ] **Step 6: Commit**

```bash
git add app/letters features/letters
git commit -m "feat: archivio delle lettere con gruppi mensili, non-lette e miniature"
```

---

### Task 15: Comporre una lettera di testo

**Files:**
- Create: `app/letters/new/page.tsx`
- Test: `app/letters/new/composer.test.tsx`

**Interfaces:**
- Consumes: `sendText` (Task 13); `useIdentity` (Task 10).
- Produces: la rotta `/letters/new`. Nessuna API riusata altrove.

**Nota sulla ricompensa comunicata.** La spec §9 chiedeva un toast con le monete guadagnate
dopo l'invio. Non è realizzabile in modo onesto: `create_letter` ritorna la lettera, non il
saldo, quindi il client non può sapere se il cap giornaliero ha annullato la ricompensa.
La soluzione è migliore del toast: dopo l'invio si torna all'archivio, dove la pastiglia
delle monete nell'header è live e **si vede cambiare** — o restare ferma, se il cap era pieno.
Il contatore nel composer copre l'altra metà dell'informazione, la lunghezza minima.

- [ ] **Step 1: Scrivi i test che devono fallire**

`app/letters/new/composer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NewLetterPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'emily', partner: 'fabrizio', setWho: vi.fn(), forget: vi.fn() }),
}));

const sendText = vi.fn();
vi.mock('@/features/letters/queries', () => ({ sendText: (...a: unknown[]) => sendText(...a) }));

const type = (value: string) => {
  const box = screen.getByRole('textbox') as HTMLTextAreaElement;
  box.value = value;
  box.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('composer di testo', () => {
  beforeEach(() => {
    push.mockReset();
    sendText.mockReset();
    sendText.mockResolvedValue({ data: { id: 'x' }, error: null });
  });

  it('non permette di inviare una lettera vuota', () => {
    render(<NewLetterPage />);
    expect(screen.getByRole('button', { name: /Send/ }).getAttribute('disabled')).not.toBeNull();
  });

  it('invia il testo firmandolo con l’identità corrente', async () => {
    render(<NewLetterPage />);
    type('Buffalo is far but not that far.');
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(sendText).toHaveBeenCalledWith('emily', 'Buffalo is far but not that far.'));
  });

  it('porta all’archivio quando l’invio riesce', async () => {
    render(<NewLetterPage />);
    type('ok');
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/letters'));
  });

  it('in caso di errore mostra il messaggio e NON perde il testo', async () => {
    sendText.mockResolvedValue({ data: null, error: 'No connection. Your work is still here — try again.' });
    render(<NewLetterPage />);
    type('una lettera lunga che non voglio riscrivere');
    screen.getByRole('button', { name: /Send/ }).click();

    await waitFor(() => expect(screen.getByText(/No connection/)).toBeDefined());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'una lettera lunga che non voglio riscrivere',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('dice quanto manca per guadagnare le monete', () => {
    render(<NewLetterPage />);
    type('short');
    expect(screen.getByText(/35 more characters/)).toBeDefined();
  });

  it('conferma la ricompensa quando la lunghezza è sufficiente', () => {
    render(<NewLetterPage />);
    type('a'.repeat(40));
    expect(screen.getByText(/worth 15 coins/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- composer`
Expected: FAIL — `./page` non risolto.

- [ ] **Step 3: Implementa**

`app/letters/new/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { sendText } from '@/features/letters/queries';
import styles from '@/features/letters/letters.module.css';

/** Deve restare allineato a coin_rules.min_units per 'letter_written'. */
const REWARD_MIN_CHARS = 40;
const REWARD_COINS = 15;

export default function NewLetterPage() {
  const { who } = useIdentity();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = body.trim();
  const missing = REWARD_MIN_CHARS - trimmed.length;

  async function send() {
    setBusy(true);
    setError(null);
    const { error: failure } = await sendText(who, body);
    setBusy(false);
    // Il testo resta nel campo: una lettera lunga non si perde per una tacca di segnale.
    if (failure) return setError(failure);
    router.push('/letters');
  }

  return (
    <div className={styles.composer}>
      <textarea
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tell them about your day…"
        aria-label="Your letter"
        autoFocus
      />
      <p className={styles.counter}>
        {missing > 0
          ? `${missing} more characters to earn coins`
          : `This one is worth ${REWARD_COINS} coins`}
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.send} onClick={send} disabled={busy || trimmed.length === 0}>
        {busy ? 'Sending…' : 'Send it'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verifica**

Run: `npm test -- composer`
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```bash
git add app/letters/new
git commit -m "feat: composer delle lettere di testo, con testo conservato in caso di errore"
```

---

### Task 16: Dettaglio della lettera, lettura e replay del disegno

**Files:**
- Create: `app/letters/[id]/page.tsx`, `features/letters/LetterDetail.tsx`, `features/letters/DrawingReplay.tsx`, `features/letters/useLetter.ts`
- Test: `features/letters/LetterDetail.test.tsx`

**Interfaces:**
- Consumes: `fetchLetter`, `markRead` (Task 13); `drawStrokes` (Task 12); `useRealtimeQuery` (Task 9); `useIdentity` (Task 10).
- Produces: `<DrawingReplay strokes />` — tela piena con pulsante di replay; `useLetter(id)`.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/letters/LetterDetail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LetterDetail } from './LetterDetail';
import type { Letter } from './queries';

const markRead = vi.fn();
vi.mock('./queries', async (original) => ({
  ...(await original<typeof import('./queries')>()),
  markRead: (...a: unknown[]) => markRead(...a),
}));

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: 'abc',
  author: 'emily',
  kind: 'text',
  body: 'Two paragraphs.\n\nAnd the second one.',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('LetterDetail', () => {
  beforeEach(() => {
    markRead.mockReset();
    markRead.mockResolvedValue({ error: null });
  });

  it('mostra il testo per intero, a capo compresi', () => {
    render(<LetterDetail letter={letter()} who="fabrizio" />);
    expect(screen.getByText(/And the second one/)).toBeDefined();
  });

  it('segna come letta la lettera dell’altro', async () => {
    render(<LetterDetail letter={letter()} who="fabrizio" />);
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('abc', 'fabrizio'));
  });

  it('non segna come letta la propria lettera', async () => {
    render(<LetterDetail letter={letter({ author: 'fabrizio' })} who="fabrizio" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('non richiama markRead su una lettera già letta', async () => {
    render(<LetterDetail letter={letter({ read_at: '2026-08-14T12:00:00Z' })} who="fabrizio" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('all’autore mostra quando è stata letta', () => {
    render(
      <LetterDetail
        letter={letter({ author: 'fabrizio', read_at: '2026-08-14T12:00:00Z' })}
        who="fabrizio"
      />,
    );
    expect(screen.getByText(/Read on Aug 14/)).toBeDefined();
  });

  it('all’autore di una lettera non ancora letta lo dice', () => {
    render(<LetterDetail letter={letter({ author: 'fabrizio' })} who="fabrizio" />);
    expect(screen.getByText(/Not read yet/)).toBeDefined();
  });

  it('per un disegno offre il replay invece del testo', () => {
    render(
      <LetterDetail
        letter={letter({ kind: 'drawing', body: null, strokes: [{ c: 0, w: 0, p: [1, 1, 9, 9] }] })}
        who="fabrizio"
      />,
    );
    expect(screen.getByRole('button', { name: /Watch it again/ })).toBeDefined();
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- LetterDetail`
Expected: FAIL — `./LetterDetail` non risolto.

- [ ] **Step 3: Implementa il replay**

`features/letters/DrawingReplay.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { drawStrokes, type Stroke } from './strokes';
import styles from './letters.module.css';

const REPLAY_MS = 2000;

/**
 * Ridisegna il disegno tratto per tratto, in circa due secondi.
 * Avendo i tratti in ordine costa quasi nulla, e vedere la mano dell'altro
 * muoversi è la ragione per cui questo formato è stato scelto.
 */
export function DrawingReplay({ strokes }: { strokes: Stroke[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const frameRef = useRef<number | null>(null);

  const paint = useCallback(
    (visible: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || size === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      drawStrokes(ctx, strokes, size, visible);
    },
    [size, strokes],
  );

  // La tela è quadrata e larga quanto il contenitore: si misura una volta e a ogni resize.
  useEffect(() => {
    const measure = () => setSize(canvasRef.current?.parentElement?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    paint(strokes.length);
  }, [paint, strokes.length]);

  const replay = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / REPLAY_MS);
      paint(Math.max(1, Math.ceil(progress * strokes.length)));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className={styles.replayWrap}>
      <canvas ref={canvasRef} className={styles.replayCanvas} role="img" aria-label="Drawing" />
      <button className={styles.replayButton} onClick={replay}>
        ▸ Watch it again
      </button>
    </div>
  );
}
```

`features/letters/LetterDetail.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { markRead, type Letter } from './queries';
import { isUnread } from './grouping';
import { DrawingReplay } from './DrawingReplay';
import styles from './letters.module.css';

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function LetterDetail({ letter, who }: { letter: Letter; who: Person }) {
  const marked = useRef(false);

  useEffect(() => {
    // Una volta sola per montaggio: la funzione SQL è idempotente, ma non serve insistere.
    if (marked.current || !isUnread(letter, who)) return;
    marked.current = true;
    void markRead(letter.id, who);
  }, [letter, who]);

  const mine = letter.author === who;

  return (
    <article className={styles.detail}>
      <header>
        <p className={styles.author}>{mine ? 'You' : displayName(letter.author)}</p>
        <p className={styles.detailMeta}>{longDate(letter.created_at)}</p>
      </header>

      {letter.kind === 'drawing' && letter.strokes ? (
        <DrawingReplay strokes={letter.strokes} />
      ) : (
        <p className={styles.detailBody}>{letter.body}</p>
      )}

      {mine && (
        <p className={styles.detailMeta}>
          {letter.read_at ? `Read on ${longDate(letter.read_at)}` : 'Not read yet'}
        </p>
      )}
    </article>
  );
}
```

`features/letters/useLetter.ts`:

```ts
'use client';

import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchLetter, type Letter } from './queries';

export function useLetter(id: string) {
  return useRealtimeQuery<Letter | null>({
    tables: ['letters'],
    fetcher: () => fetchLetter(id),
  });
}
```

`app/letters/[id]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { useLetter } from '@/features/letters/useLetter';
import { LetterDetail } from '@/features/letters/LetterDetail';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineStrip } from '@/components/ui/OfflineStrip';

export default function LetterPage() {
  const { id } = useParams<{ id: string }>();
  const { who } = useIdentity();
  const { data, loading, offline } = useLetter(id);

  if (loading && !data) return <p>Opening…</p>;
  if (!data) return <EmptyState title="Not found" body="This letter isn't here anymore." />;

  return (
    <>
      {offline && <OfflineStrip />}
      <LetterDetail letter={data} who={who} />
    </>
  );
}
```

- [ ] **Step 4: Verifica**

Run: `npm test -- LetterDetail && npx tsc --noEmit`
Expected: 7 test PASS.

- [ ] **Step 5: Commit**

```bash
git add app/letters features/letters
git commit -m "feat: dettaglio lettera, marcatura come letta e replay del disegno"
```

---

### Task 17: Disegnare

**Files:**
- Create: `app/letters/draw/page.tsx`, `features/letters/DrawingCanvas.tsx`, `features/letters/draft.ts`, `features/letters/draw.module.css`
- Test: `features/letters/draft.test.ts`, `features/letters/DrawingCanvas.test.tsx`

**Interfaces:**
- Consumes: tutto `strokes.ts` (Task 12); `sendDrawing` (Task 13); `useIdentity` (Task 10).
- Produces: `<DrawingCanvas onSend />`; `saveDraft(storage, strokes)`, `loadDraft(storage): Stroke[]`, `clearDraft(storage)`, `DRAFT_KEY = 'fe.draft'`.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/letters/draft.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DRAFT_KEY, saveDraft, loadDraft, clearDraft } from './draft';
import type { Stroke } from './strokes';

const fakeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

const strokes: Stroke[] = [{ c: 2, w: 1, p: [10, 10, 50, 50] }];

describe('bozza locale del disegno', () => {
  it('usa la chiave fe.draft', () => {
    expect(DRAFT_KEY).toBe('fe.draft');
  });

  it('salva e rilegge i tratti identici', () => {
    const storage = fakeStorage();
    saveDraft(storage, strokes);
    expect(loadDraft(storage)).toEqual(strokes);
  });

  it('senza bozza restituisce una lista vuota', () => {
    expect(loadDraft(fakeStorage())).toEqual([]);
  });

  it('scarta una bozza illeggibile invece di far crashare l’editor', () => {
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: '{{{' }))).toEqual([]);
  });

  it('scarta una bozza dal formato non valido', () => {
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: '[{"c":99,"w":0,"p":[1,1]}]' }))).toEqual([]);
  });

  it('cancella la bozza', () => {
    const storage = fakeStorage();
    saveDraft(storage, strokes);
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual([]);
  });

  it('salvare una tela vuota equivale a cancellare la bozza', () => {
    const storage = fakeStorage();
    saveDraft(storage, strokes);
    saveDraft(storage, []);
    expect(loadDraft(storage)).toEqual([]);
  });
});
```

`features/letters/DrawingCanvas.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrawingCanvas } from './DrawingCanvas';
import { PALETTE, WIDTHS } from './strokes';

describe('DrawingCanvas', () => {
  it('offre tutti i colori della palette', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getAllByRole('radio', { name: /color/i })).toHaveLength(PALETTE.length);
  });

  it('offre tutti gli spessori', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getAllByRole('radio', { name: /brush/i })).toHaveLength(WIDTHS.length);
  });

  it('parte con annulla e cancella disattivati, perché la tela è vuota', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' }).getAttribute('disabled')).not.toBeNull();
  });

  it('non permette di inviare una tela vuota', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getByRole('button', { name: /Send/ }).getAttribute('disabled')).not.toBeNull();
  });

  it('dice quanti tratti mancano alla ricompensa', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getByText(/5 more strokes/)).toBeDefined();
  });

  it('la tela disabilita lo scroll del dito', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    const canvas = screen.getByLabelText('Drawing area');
    expect(canvas.style.touchAction).toBe('none');
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- draft DrawingCanvas`
Expected: FAIL — moduli non risolti.

- [ ] **Step 3: Implementa la bozza locale**

`features/letters/draft.ts`:

```ts
import { isStrokeArray, type Stroke } from './strokes';

export const DRAFT_KEY = 'fe.draft';

/**
 * Bozza LOCALE, non sul server. Serve a un caso concreto: iOS scarica dalla memoria
 * una PWA in background, e senza questo dieci minuti di disegno svanirebbero.
 */
export function saveDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, strokes: Stroke[]): void {
  if (strokes.length === 0) return storage.removeItem(DRAFT_KEY);
  storage.setItem(DRAFT_KEY, JSON.stringify(strokes));
}

export function loadDraft(storage: Pick<Storage, 'getItem'>): Stroke[] {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStrokeArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDraft(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(DRAFT_KEY);
}
```

- [ ] **Step 4: Implementa l'editor**

`features/letters/DrawingCanvas.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PALETTE,
  WIDTHS,
  MAX_STROKES,
  MIN_STROKES_FOR_REWARD,
  appendPoint,
  canAddStroke,
  drawStrokes,
  startStroke,
  toUnits,
  undo,
  type Stroke,
} from './strokes';
import { loadDraft, saveDraft, clearDraft } from './draft';
import styles from './draw.module.css';

const DRAFT_DEBOUNCE_MS = 1000;

export function DrawingCanvas({
  onSend,
  busy,
  error,
}: {
  onSend: (strokes: Stroke[]) => void;
  busy: boolean;
  error?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const drawing = useRef<Stroke | null>(null);

  // Bozza recuperata all'apertura: se l'app è stata scaricata dalla memoria, il disegno è ancora qui.
  useEffect(() => {
    setStrokes(loadDraft(window.localStorage));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveDraft(window.localStorage, strokes), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [strokes]);

  // Tela quadrata, larga quanto il contenitore.
  useEffect(() => {
    const measure = () => setSize(canvasRef.current?.parentElement?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const repaint = useCallback(
    (list: Stroke[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || size === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      drawStrokes(ctx, list, size);
    },
    [size],
  );

  useEffect(() => {
    repaint(drawing.current ? [...strokes, drawing.current] : strokes);
  }, [repaint, strokes]);

  const pointToUnits = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: toUnits(event.clientX - rect.left, rect.width),
      y: toUnits(event.clientY - rect.top, rect.height),
    };
  };

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canAddStroke(strokes)) {
      setNotice(`That's ${MAX_STROKES} strokes — send it before adding more.`);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = pointToUnits(event);
    drawing.current = startStroke(color, width, x, y);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = drawing.current;
    if (!current) return;
    const { x, y } = pointToUnits(event);
    const next = appendPoint(current, x, y);
    // Identità invariata = punto scartato: niente ridisegno.
    if (next === current) return;
    drawing.current = next;
    repaint([...strokes, next]);
  }

  function onPointerUp() {
    const current = drawing.current;
    drawing.current = null;
    if (current) setStrokes((list) => [...list, current]);
  }

  const missing = MIN_STROKES_FOR_REWARD - strokes.length;

  return (
    <div className={styles.editor}>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ touchAction: 'none' }}
          aria-label="Drawing area"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className={styles.swatches} role="radiogroup" aria-label="Colors">
        {PALETTE.map((hex, index) => (
          <button
            key={hex}
            role="radio"
            aria-label={`Color ${index + 1}`}
            aria-checked={color === index}
            className={color === index ? styles.swatchActive : styles.swatch}
            style={{ background: hex }}
            onClick={() => setColor(index)}
          />
        ))}
      </div>

      <div className={styles.tools}>
        <div className={styles.widths} role="radiogroup" aria-label="Brush sizes">
          {WIDTHS.map((unit, index) => (
            <button
              key={unit}
              role="radio"
              aria-label={`Brush ${index + 1}`}
              aria-checked={width === index}
              className={width === index ? styles.widthActive : styles.width}
              onClick={() => setWidth(index)}
            >
              <span style={{ width: 4 + index * 8, height: 4 + index * 8 }} className={styles.dot} />
            </button>
          ))}
        </div>

        <button
          className={styles.tool}
          onClick={() => setStrokes(undo)}
          disabled={strokes.length === 0}
        >
          Undo
        </button>
        <button
          className={styles.tool}
          disabled={strokes.length === 0}
          onClick={() => {
            if (window.confirm('Clear the whole drawing?')) {
              setStrokes([]);
              clearDraft(window.localStorage);
            }
          }}
        >
          Clear
        </button>
      </div>

      <p className={styles.counter}>
        {missing > 0 ? `${missing} more strokes to earn coins` : 'This one is worth 20 coins'}
      </p>
      {notice && <p className={styles.counter}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.send}
        disabled={busy || strokes.length === 0}
        onClick={() => onSend(strokes)}
      >
        {busy ? 'Sending…' : 'Send it'}
      </button>
    </div>
  );
}
```

`app/letters/draw/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { sendDrawing } from '@/features/letters/queries';
import { clearDraft } from '@/features/letters/draft';
import { DrawingCanvas } from '@/features/letters/DrawingCanvas';
import type { Stroke } from '@/features/letters/strokes';

export default function DrawPage() {
  const { who } = useIdentity();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(strokes: Stroke[]) {
    setBusy(true);
    setError(null);
    const { error: failure } = await sendDrawing(who, strokes);
    setBusy(false);
    // In caso di errore la bozza NON viene cancellata: il disegno resta recuperabile.
    if (failure) return setError(failure);
    clearDraft(window.localStorage);
    router.push('/letters');
  }

  return <DrawingCanvas onSend={send} busy={busy} error={error} />;
}
```

`features/letters/draw.module.css`:

```css
.editor { display: grid; gap: var(--space-3); }
.canvasWrap { width: 100%; }
.canvas {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  cursor: crosshair;
}
.swatches { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--space-2); }
.swatch, .swatchActive {
  min-height: 44px;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
}
.swatchActive { border-color: var(--fg); }
.tools { display: flex; align-items: center; gap: var(--space-2); }
.widths { display: flex; gap: var(--space-2); margin-right: auto; }
.width, .widthActive {
  display: grid;
  place-items: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface);
}
.widthActive { border-color: var(--fg); }
.dot { display: block; border-radius: 50%; background: var(--fg); }
.tool {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-small);
}
.tool:disabled { opacity: 0.4; }
.counter { font: var(--font-small); color: var(--fg-muted); margin: 0; text-align: center; }
.error { font: var(--font-small); color: var(--danger); margin: 0; text-align: center; }
.send {
  min-height: 52px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-fg);
  font: var(--font-lead);
}
.send:disabled { opacity: 0.45; }
```

- [ ] **Step 5: Verifica**

Run: `npm test -- draft DrawingCanvas && npx tsc --noEmit`
Expected: 13 test PASS.

- [ ] **Step 6: Verifica a mano, che qui è indispensabile**

`npm run dev`, apri `/letters/draw` con il device toolbar su iPhone 13 e **usa il mouse tenendo premuto**: disegna, cambia colore e spessore, annulla, ricarica la pagina (la bozza deve ricomparire), invia. Il dito non deve far scorrere la pagina mentre disegni.

- [ ] **Step 7: Commit**

```bash
git add app/letters/draw features/letters
git commit -m "feat: editor di disegno con palette, spessori, annulla e bozza locale"
```

---

### Task 18: Home

**Files:**
- Create: `app/page.tsx` (riscrittura), `features/home/UnreadCard.tsx`, `features/home/home.module.css`
- Test: `features/home/UnreadCard.test.tsx`

**Interfaces:**
- Consumes: `useLetters`, `unreadFor` (Task 13); `useIdentity` (Task 10); `EmptyState` (Task 11).
- Produces: `<UnreadCard letters who />`. I segnaposto per F2 e F4 lasciano il loro spazio già impaginato.

- [ ] **Step 1: Scrivi i test che devono fallire**

`features/home/UnreadCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnreadCard } from './UnreadCard';
import type { Letter } from '@/features/letters/queries';

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: 'aaa',
  author: 'emily',
  kind: 'text',
  body: 'hello',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('UnreadCard', () => {
  it('senza non lette non mostra nulla', () => {
    const { container } = render(<UnreadCard letters={[]} who="fabrizio" />);
    expect(container.textContent).toBe('');
  });

  it('annuncia una lettera al singolare', () => {
    render(<UnreadCard letters={[letter()]} who="fabrizio" />);
    expect(screen.getByText('Emily wrote you')).toBeDefined();
  });

  it('annuncia un disegno con parole diverse', () => {
    render(
      <UnreadCard letters={[letter({ kind: 'drawing', body: null, strokes: [] })]} who="fabrizio" />,
    );
    expect(screen.getByText('Emily sent you a drawing')).toBeDefined();
  });

  it('conta le non lette quando sono più di una', () => {
    render(<UnreadCard letters={[letter({ id: 'a' }), letter({ id: 'b' })]} who="fabrizio" />);
    expect(screen.getByText(/2 unread/)).toBeDefined();
  });

  it('porta alla non letta più vecchia', () => {
    const older = letter({ id: 'old', created_at: '2026-08-01T10:00:00Z' });
    const newer = letter({ id: 'new', created_at: '2026-08-14T10:00:00Z' });
    render(<UnreadCard letters={[newer, older]} who="fabrizio" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/letters/old');
  });

  it('ignora le proprie lettere', () => {
    const { container } = render(
      <UnreadCard letters={[letter({ author: 'fabrizio' })]} who="fabrizio" />,
    );
    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Esegui e verifica che falisca**

Run: `npm test -- UnreadCard`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementa**

`features/home/UnreadCard.tsx`:

```tsx
import Link from 'next/link';
import { displayName, type Person } from '@/features/auth/identity';
import { unreadFor } from '@/features/letters/grouping';
import type { Letter } from '@/features/letters/queries';
import styles from './home.module.css';

export function UnreadCard({ letters, who }: { letters: Letter[]; who: Person }) {
  const unread = unreadFor(letters, who);
  if (unread.length === 0) return null;

  const first = unread[0];
  const author = displayName(first.author);
  const headline =
    first.kind === 'drawing' ? `${author} sent you a drawing` : `${author} wrote you`;

  return (
    <Link href={`/letters/${first.id}`} className={styles.unread}>
      <span className={styles.unreadHeadline}>{headline}</span>
      {unread.length > 1 && (
        <span className={styles.unreadCount}>{unread.length} unread waiting</span>
      )}
    </Link>
  );
}
```

`app/page.tsx`:

```tsx
'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { useLetters } from '@/features/letters/useLetters';
import { UnreadCard } from '@/features/home/UnreadCard';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import { displayName } from '@/features/auth/identity';
import styles from '@/features/home/home.module.css';

export default function HomePage() {
  const { who, partner } = useIdentity();
  const { data, offline } = useLetters();

  return (
    <>
      {offline && <OfflineStrip />}
      <h1 className={styles.greeting}>Hi {displayName(who)}</h1>

      <UnreadCard letters={data ?? []} who={who} />

      {/* Segnaposto: F2 e F4 riempiono uno spazio già impaginato invece di ridisegnare la Home. */}
      <div className={styles.slot}>
        <p className={styles.slotTitle}>Your animals</p>
        <p className={styles.slotBody}>Coming soon — they&rsquo;ll ask for food right here.</p>
      </div>
      <div className={styles.slot}>
        <p className={styles.slotTitle}>Games in progress</p>
        <p className={styles.slotBody}>
          Coming soon — you&rsquo;ll see when it&rsquo;s your turn against {displayName(partner)}.
        </p>
      </div>
    </>
  );
}
```

`features/home/home.module.css`:

```css
.greeting { font: var(--font-title); margin: 0; }
.unread {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--accent);
  color: var(--accent-fg);
  text-decoration: none;
}
.unreadHeadline { font: var(--font-lead); }
.unreadCount { font: var(--font-small); opacity: 0.85; }
.slot {
  padding: var(--space-4);
  border: 1px dashed var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}
.slotTitle { font: var(--font-lead); margin: 0 0 var(--space-1); }
.slotBody { font: var(--font-small); color: var(--fg-muted); margin: 0; }
```

- [ ] **Step 4: Verifica**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: tutti i test unit PASS, build completata.

- [ ] **Step 5: Commit**

```bash
git add app features/home
git commit -m "feat: Home con card delle non lette e spazi per giochi e animali"
```

---

### Task 19: Smoke test end-to-end e documentazione di setup

**Files:**
- Create: `playwright.config.ts`, `e2e/letters.spec.ts`
- Create: `README.setup.md`
- Modify: `package.json` (script `test:e2e`)

**Interfaces:**
- Consumes: l'app completa.
- Produces: un percorso end-to-end verificato e le istruzioni per creare l'account della coppia e mettere in produzione.

- [ ] **Step 1: Installa e configura Playwright**

```bash
npm i -D @playwright/test && npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { ...devices['iPhone 13'], baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

Aggiungi a `package.json`: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Scrivi il test end-to-end**

`e2e/letters.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? 'ci-shared-password';
const LETTER = 'Buffalo is six hours ahead and I still miss you at the same time.';

test('dal login alla lettera, al disegno, alle monete', async ({ page }) => {
  await page.goto('/');

  // Login con la password condivisa, poi scelta dell'identità.
  await page.getByLabel('Our password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Come in' }).click();
  await page.getByRole('button', { name: "I'm Fabrizio" }).click();

  await expect(page.getByRole('heading', { name: 'Hi Fabrizio' })).toBeVisible();

  // Le cinque sezioni sono raggiungibili, lo Shop passa dal saldo monete.
  for (const tab of ['Games', 'Pets', 'Questions']) {
    await page.getByRole('link', { name: new RegExp(tab) }).click();
    await expect(page.getByText(tab, { exact: false })).toBeVisible();
  }

  // Scrittura di una lettera.
  await page.getByRole('link', { name: /Letters/ }).click();
  await page.getByRole('link', { name: 'Write a letter' }).click();
  await page.getByLabel('Your letter').fill(LETTER);
  await expect(page.getByText(/worth 15 coins/)).toBeVisible();
  await page.getByRole('button', { name: 'Send it' }).click();

  await expect(page.getByText(LETTER.slice(0, 40), { exact: false })).toBeVisible();

  // Un disegno di sei tratti.
  await page.getByRole('link', { name: 'Draw something' }).click();
  const canvas = page.getByLabel('Drawing area');
  const box = (await canvas.boundingBox())!;
  for (let i = 0; i < 6; i++) {
    const y = box.y + 40 + i * 30;
    await page.mouse.move(box.x + 30, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 30, y + 10, { steps: 8 });
    await page.mouse.up();
  }
  await expect(page.getByText(/worth 20 coins/)).toBeVisible();
  await page.getByRole('button', { name: 'Send it' }).click();

  // La miniatura compare in archivio e il saldo riflette 15 + 20.
  await expect(page.getByRole('img', { name: /Drawing from Fabrizio/ })).toBeVisible();
  await expect(page.getByLabel(/35 coins/)).toBeVisible();
});
```

- [ ] **Step 3: Prepara il database e l'ambiente per il test**

```bash
npm run db:reset
node -e "
const { createClient } = require('@supabase/supabase-js');
const url = process.env.API_URL, key = process.env.SERVICE_ROLE_KEY;
createClient(url, key).auth.admin.createUser({
  email: 'couple@fabriemily.test', password: 'ci-shared-password', email_confirm: true
}).then(({ error }) => console.log(error?.message ?? 'utente creato'));
"
```

Crea `.env.local` puntando al Supabase locale, con `NEXT_PUBLIC_COUPLE_EMAIL=couple@fabriemily.test`.

- [ ] **Step 4: Esegui e verifica che passi**

Run: `npm run test:e2e`
Expected: 1 test PASS.

Se il disegno con il mouse non produce tratti, la causa è quasi sempre `setPointerCapture` in Chromium headless: esegui `npx playwright test --headed` per vedere cosa accade prima di modificare il codice di produzione.

- [ ] **Step 5: Scrivi la documentazione di setup**

`README.setup.md`:

```markdown
# Setup

## Sviluppo locale

1. `npm install`
2. `npm run db:start` — avvia Supabase e scrive `.env.test`
3. Crea `.env.local` copiando `.env.local.example` e riempiendolo con i valori
   di `supabase status` (`API_URL` → `NEXT_PUBLIC_SUPABASE_URL`,
   `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Crea l'utente della coppia (una volta sola):
   `node scripts/create-couple-user.mjs`
5. `npm run dev`

## Test

- `npm test` — unit, in jsdom
- `npm run test:int` — integrazione, richiede Supabase locale attivo
- `npm run test:e2e` — smoke end-to-end su viewport iPhone

## Produzione

1. Crea un progetto su Supabase (piano gratuito).
2. `supabase link --project-ref <ref>` e `supabase db push` per applicare le migrazioni.
3. **Crea a mano l'utente della coppia** dalla dashboard, in Authentication → Users:
   email `couple@fabriemily.app`, la password condivisa, e conferma l'email manualmente.
   Nell'app non esiste registrazione: questo account è l'unico modo di entrare.
4. Su Vercel, importa il repo e imposta `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_COUPLE_EMAIL`.
5. Su iPhone, apri il sito in Safari e fai "Aggiungi a Home": è così che diventa
   un'app a schermo pieno, e sarà il prerequisito per le notifiche push in futuro.

## Cambiare l'equilibrio economico

Nessun valore di monete sta nel codice. Per rendere una lettera più generosa:

```sql
update coin_rules set amount = 20 where reason = 'letter_written';
```

Le uniche eccezioni sono i testi dell'interfaccia in `app/letters/new/page.tsx` e
`features/letters/strokes.ts` (`MIN_STROKES_FOR_REWARD`), che vanno allineati a mano.
```

Crea anche `scripts/create-couple-user.mjs` con lo stesso contenuto del comando dello Step 3, leggendo `API_URL` e `SERVICE_ROLE_KEY` da `.env.test`.

- [ ] **Step 6: Verifica finale dell'intera suite**

Run: `npm run db:reset && npm test && npm run test:int && npm run test:e2e && npx tsc --noEmit && npm run build`
Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add e2e playwright.config.ts README.setup.md scripts package.json
git commit -m "test: smoke end-to-end su viewport iPhone e documentazione di setup"
```

---

## Verifica finale contro i criteri di accettazione

Da fare a mano, con **due dispositivi o due browser diversi** — è l'unico modo di verificare il realtime:

- [ ] Prima apertura: password, scelta identità. Riapertura: nessuna domanda.
- [ ] Cinque tab; Games, Pets, Questions sono placeholder; il saldo monete apre lo Shop.
- [ ] Su A (Fabrizio) scrivi una lettera. Su B (Emily), con l'app **già aperta**, la card compare senza ricaricare.
- [ ] B apre la lettera: la card sparisce, la lettera resta in archivio, e su A appare "Read on …".
- [ ] B disegna con due colori e due spessori, annulla un tratto, invia. La miniatura compare in archivio e il replay ridisegna il disegno.
- [ ] Il saldo cresce di 15 e di 20; la quarta lettera dello stesso giorno non paga.
- [ ] Modalità aereo: appare "You're offline", i contenuti già caricati restano; tornando online si aggiorna da sé.
- [ ] Su iPhone, "Aggiungi a Home": l'app si apre a schermo pieno con la sua icona.
