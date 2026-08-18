import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';

beforeEach(async () => {
  await resetData();
  // Svuota l'intera tabella, non solo i propri body noti: questa suite gira
  // in sequenza con altri file (fileParallelism: false), e un'eventuale
  // pulizia parziale lascerebbe comunque residui che inquinano il conteggio
  // esatto richiesto da altri file (vedi draw_question.test.ts). Sicuro
  // finché il Task 5 non semina le 300 domande reali; da quel momento un
  // `db:reset` prima della suite le ripristina.
  await sql(`delete from questions`);
  await sql(`insert into questions (category, body) values ('fun', 'domanda di prova')`);
});

const openRound = async () =>
  (
    await sql<{ id: string }>(`select * from draw_question('fabrizio'::person, null)`)
  )[0].id;

const answer = async (roundId: string, person: string, body: string) =>
  (
    await sql<{ round_id: string; author: string; body: string }>(
      'select * from answer_question($1::uuid, $2::person, $3)',
      [roundId, person, body],
    )
  )[0];

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

describe('answer_question', () => {
  it('inserisce la risposta e accredita 8 monete', async () => {
    const roundId = await openRound();
    await answer(roundId, 'fabrizio', 'la mia risposta');
    expect(await coins()).toBe(8);
  });

  it('rifiuta una risposta vuota', async () => {
    const roundId = await openRound();
    await expect(answer(roundId, 'fabrizio', '   ')).rejects.toThrow(/empty_answer/);
    expect(await coins()).toBe(0);
  });

  it('rifiuta una seconda risposta della stessa persona allo stesso round', async () => {
    const roundId = await openRound();
    await answer(roundId, 'fabrizio', 'prima');
    await expect(answer(roundId, 'fabrizio', 'seconda')).rejects.toThrow(/already_answered/);
    expect(await coins()).toBe(8); // solo la prima ha pagato
  });

  it('rifiuta una risposta su un round già chiuso', async () => {
    const roundId = await openRound();
    await sql(`update question_rounds set closed_at = now(), closed_reason = 'skipped'
               where id = $1`, [roundId]);
    await expect(answer(roundId, 'fabrizio', 'troppo tardi')).rejects.toThrow(
      /round_already_closed/,
    );
  });

  it('non chiude il round dopo una sola risposta', async () => {
    const roundId = await openRound();
    await answer(roundId, 'fabrizio', 'una');
    const rows = await sql<{ closed_at: string | null }>(
      'select closed_at from question_rounds where id = $1',
      [roundId],
    );
    expect(rows[0].closed_at).toBeNull();
  });

  it('chiude il round come answered dopo la seconda risposta', async () => {
    const roundId = await openRound();
    await answer(roundId, 'fabrizio', 'una');
    await answer(roundId, 'emily', 'due');
    const rows = await sql<{ closed_at: string | null; closed_reason: string | null }>(
      'select closed_at, closed_reason from question_rounds where id = $1',
      [roundId],
    );
    expect(rows[0].closed_at).not.toBeNull();
    expect(rows[0].closed_reason).toBe('answered');
  });

  it('entrambe le persone guadagnano, indipendentemente', async () => {
    const roundId = await openRound();
    await answer(roundId, 'fabrizio', 'una');
    await answer(roundId, 'emily', 'due');
    expect(await coins()).toBe(16);
  });

  it('rispetta il tetto giornaliero per persona (5 al giorno)', async () => {
    for (let i = 0; i < 6; i++) {
      await sql(`insert into questions (category, body) values ('fun', $1)`, [`q${i}`]);
      const roundId = await openRound();
      await answer(roundId, 'fabrizio', `risposta ${i}`);
      await sql(`update question_rounds set closed_at = now(), closed_reason = 'skipped'
                 where id = $1 and closed_at is null`, [roundId]);
      // Se la seconda risposta non è arrivata, il round resta aperto e la
      // prossima draw_question fallirebbe: lo chiudiamo a mano nel fixture
      // per isolare il test sul solo comportamento del tetto.
    }
    expect(await coins()).toBe(40); // 5 pagate (8 l'una), la sesta no
  });

  it('due risposte simultanee di persone diverse: il round si chiude comunque', async () => {
    // Senza il lock su question_rounds, sotto READ COMMITTED entrambe le
    // transazioni potrebbero non vedersi a vicenda e nessuna chiuderebbe il
    // round, che resterebbe aperto per sempre nonostante esistano entrambe
    // le risposte. Stesso principio del lock in grant_coins/spend_coins.
    const roundId = await openRound();
    const clientA = await signedInClient();
    const clientB = await signedInClient();
    await clientA.from('questions').select('id').limit(1);
    await clientB.from('questions').select('id').limit(1);

    const [a, b] = await Promise.all([
      clientA.rpc('answer_question', {
        p_round_id: roundId,
        p_person: 'fabrizio',
        p_body: 'una',
      }),
      clientB.rpc('answer_question', { p_round_id: roundId, p_person: 'emily', p_body: 'due' }),
    ]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    const rows = await sql<{ closed_at: string | null; closed_reason: string | null }>(
      'select closed_at, closed_reason from question_rounds where id = $1',
      [roundId],
    );
    expect(rows[0].closed_at).not.toBeNull();
    expect(rows[0].closed_reason).toBe('answered');
  });
});
