import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql, resetData, cleanupQuestions } from './helpers';

// Vedi draw_question.test.ts per la motivazione: mai una delete
// indiscriminata su `questions`, che cancellerebbe il seme reale (Task 5) o
// le fixture di altri file. Si traccia l'id creato e si ripulisce
// chirurgicamente in afterEach.
let fixtureIds: string[] = [];

beforeEach(async () => {
  await resetData();
  const rows = await sql<{ id: string }>(
    `insert into questions (category, body) values ('fun', 'domanda di prova') returning id`,
  );
  fixtureIds = rows.map((r) => r.id);
});

afterEach(async () => {
  await cleanupQuestions(fixtureIds);
  fixtureIds = [];
});

const openRound = async () =>
  (await sql<{ id: string }>(`select * from draw_question('fabrizio'::person, null)`))[0].id;

const skip = async (roundId: string, person: string) =>
  (await sql<{ skip_question: boolean }>('select skip_question($1::uuid, $2::person)', [
    roundId,
    person,
  ]))[0].skip_question;

describe('skip_question', () => {
  it('chiude un round vuoto e ritorna true', async () => {
    const roundId = await openRound();
    expect(await skip(roundId, 'emily')).toBe(true);
    const rows = await sql<{ closed_at: string | null; closed_reason: string | null }>(
      'select closed_at, closed_reason from question_rounds where id = $1',
      [roundId],
    );
    expect(rows[0].closed_at).not.toBeNull();
    expect(rows[0].closed_reason).toBe('skipped');
  });

  it('la domanda skippata torna pescabile subito dopo', async () => {
    const roundId = await openRound();
    await skip(roundId, 'fabrizio');
    await expect(
      sql(`select * from draw_question('emily'::person, null)`),
    ).resolves.toHaveLength(1);
  });

  it('è un no-op se il round è già chiuso, e ritorna false', async () => {
    const roundId = await openRound();
    await skip(roundId, 'fabrizio');
    expect(await skip(roundId, 'emily')).toBe(false);
  });

  it('è un no-op se esiste già una risposta, per non cancellarla in silenzio', async () => {
    // Se Fabrizio ha già risposto onestamente e Emily preme "Skip" invece di
    // rispondere, uno skip che chiudesse comunque il round farebbe sparire
    // la risposta di Fabrizio senza che nessuno la veda mai.
    const roundId = await openRound();
    await sql(
      `insert into question_answers (round_id, author, body) values ($1, 'fabrizio', 'gia scritta')`,
      [roundId],
    );
    expect(await skip(roundId, 'emily')).toBe(false);
    const rows = await sql<{ closed_at: string | null }>(
      'select closed_at from question_rounds where id = $1',
      [roundId],
    );
    expect(rows[0].closed_at).toBeNull();
  });

  it('un id inesistente non solleva errori, ritorna false', async () => {
    await expect(
      skip('00000000-0000-0000-0000-000000000000', 'fabrizio'),
    ).resolves.toBe(false);
  });
});
