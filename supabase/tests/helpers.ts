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

/** Riporta i dati allo stato iniziale fra i test. Non toccare coin_rules né questions. */
export async function resetData(): Promise<void> {
  await sql(`
    delete from question_answers;
    delete from question_rounds;
    truncate coin_ledger restart identity;
    delete from letters;
    delete from item_prices;
    update couple_state set coins = 0 where id = 1;
  `);
}

/**
 * Rimuove chirurgicamente delle domande di fixture, insieme a tutto ciò che
 * le referenzia (round, risposte). Mai un "delete from questions"
 * indiscriminato: questa suite gira in sequenza (fileParallelism: false) con
 * altri file che possono già aver seminato le 300 domande reali (Task 5) o
 * le proprie righe di fixture — una pulizia totale cancellerebbe dati di cui
 * il chiamante non ha nulla da dire. Va invocato dall'afterEach dei file che
 * inseriscono domande di prova, passando esattamente gli id che hanno creato.
 */
export async function cleanupQuestions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql(
    `delete from question_answers where round_id in (
       select id from question_rounds where question_id = any($1::uuid[])
     )`,
    [ids],
  );
  await sql(`delete from question_rounds where question_id = any($1::uuid[])`, [ids]);
  await sql(`delete from questions where id = any($1::uuid[])`, [ids]);
}
