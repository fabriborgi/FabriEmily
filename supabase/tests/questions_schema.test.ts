import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, anonClient, resetData } from './helpers';

// File autonomo: non si affida al seed delle 300 domande (Task 5), che può
// non esistere ancora quando questo task viene eseguito per primo. Una riga
// di prova basta per verificare vincoli, RLS e privilegi.
beforeEach(async () => {
  await resetData();
  await sql(
    `insert into questions (category, body) values ('fun', 'placeholder for schema tests')
     on conflict do nothing`,
  );
});

const insertRound = async (questionId: string, closedReason: 'answered' | null = null) => {
  const rows = await sql<{ id: string }>(
    `insert into question_rounds (question_id, drawn_by, closed_at, closed_reason)
     values ($1, 'fabrizio', case when $2::text is null then null else now() end, $2)
     returning id`,
    [questionId, closedReason],
  );
  return rows[0].id;
};

describe('schema domande — vincoli e permessi', () => {
  it('impedisce un secondo round aperto contemporaneamente', async () => {
    const [{ id: qid }] = await sql<{ id: string }>(
      `select id from questions limit 1`,
    );
    await insertRound(qid);
    await expect(insertRound(qid)).rejects.toThrow(/one_open_round/);
  });

  it('permette molti round chiusi per la stessa domanda', async () => {
    const [{ id: qid }] = await sql<{ id: string }>(`select id from questions limit 1`);
    await insertRound(qid, 'answered');
    await expect(insertRound(qid, 'answered')).resolves.toBeDefined();
  });

  it('impedisce due risposte della stessa persona allo stesso round', async () => {
    const [{ id: qid }] = await sql<{ id: string }>(`select id from questions limit 1`);
    const roundId = await insertRound(qid);
    await sql(
      `insert into question_answers (round_id, author, body) values ($1, 'fabrizio', 'x')`,
      [roundId],
    );
    await expect(
      sql(`insert into question_answers (round_id, author, body) values ($1, 'fabrizio', 'y')`, [
        roundId,
      ]),
    ).rejects.toThrow();
  });

  it('un client autenticato legge le domande e i round', async () => {
    const client = await signedInClient();
    const { data: questions, error: qErr } = await client.from('questions').select('id').limit(1);
    expect(qErr).toBeNull();
    expect(questions).toHaveLength(1);

    const [{ id: qid }] = await sql<{ id: string }>(`select id from questions limit 1`);
    await insertRound(qid);
    const { data: rounds, error: rErr } = await client.from('question_rounds').select('id');
    expect(rErr).toBeNull();
    expect(rounds).toHaveLength(1);
  });

  it('un client anonimo NON legge le domande', async () => {
    const { data, error } = await anonClient().from('questions').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error ?? { message: '' }).toBeTruthy();
  });

  it('un client autenticato NON scrive direttamente sulle tabelle', async () => {
    const client = await signedInClient();
    const { error } = await client
      .from('question_rounds')
      .insert({ question_id: '00000000-0000-0000-0000-000000000000', drawn_by: 'fabrizio' });
    expect(error).not.toBeNull();
  });

  it('un round APERTO: nessuno vede le risposte, nemmeno chi le ha scritte', async () => {
    // Punto di sicurezza centrale della fase: l'identità non è verificata dal
    // database, quindi l'unica riservatezza possibile è "nessuno vede niente
    // finché il round non è chiuso" — non "solo il suo autore la vede".
    const [{ id: qid }] = await sql<{ id: string }>(`select id from questions limit 1`);
    const roundId = await insertRound(qid); // resta aperto
    await sql(
      `insert into question_answers (round_id, author, body) values ($1, 'fabrizio', 'segreta')`,
      [roundId],
    );
    const client = await signedInClient();
    const { data, error } = await client
      .from('question_answers')
      .select('body')
      .eq('round_id', roundId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('un round CHIUSO come answered: entrambe le risposte diventano visibili', async () => {
    const [{ id: qid }] = await sql<{ id: string }>(`select id from questions limit 1`);
    const roundId = await insertRound(qid, 'answered');
    await sql(
      `insert into question_answers (round_id, author, body) values
         ($1, 'fabrizio', 'una'), ($1, 'emily', 'due')`,
      [roundId],
    );
    const client = await signedInClient();
    const { data, error } = await client
      .from('question_answers')
      .select('author, body')
      .eq('round_id', roundId);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('un round chiuso come skipped: le risposte (se ce ne fossero) restano nascoste', async () => {
    const [{ id: qid }] = await sql<{ id: string }>(`select id from questions limit 1`);
    const roundId = await insertRound(qid, null);
    await sql(
      `update question_rounds set closed_at = now(), closed_reason = 'skipped' where id = $1`,
      [roundId],
    );
    const client = await signedInClient();
    const { data } = await client.from('question_answers').select('body').eq('round_id', roundId);
    expect(data).toHaveLength(0);
  });

  it('question_rounds e question_answers sono pubblicate su Realtime', async () => {
    const rows = await sql<{ tablename: string }>(`
      select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' order by tablename
    `);
    const names = rows.map((r) => r.tablename);
    expect(names).toContain('question_rounds');
    expect(names).toContain('question_answers');
  });
});
