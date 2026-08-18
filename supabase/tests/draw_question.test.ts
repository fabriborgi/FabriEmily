import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';

beforeEach(async () => {
  await resetData();
  // Isolamento completo, non solo per i propri body: questa suite gira in
  // sequenza con altri file (fileParallelism: false) che scrivono anch'essi
  // in `questions`, mai svuotata da resetData(). Una delete per body noti
  // rende idempotente QUESTO file al proprio interno, ma non protegge da
  // residui lasciati da ALTRI file eseguiti prima nello stesso run — ed è
  // esattamente quello che ha fatto fallire il test sul riciclo della
  // categoria esaurita quando la suite gira per intero (le righe di
  // answer_question.test.ts restano nella categoria 'fun'). Svuotare
  // l'intera tabella qui è sicuro: contiene solo dati di test finché il
  // Task 5 non semina le 300 domande reali, e da quel momento in poi un
  // `db:reset` prima della suite le ripristina.
  await sql(`delete from questions`);
  await sql(`
    insert into questions (category, body) values
      ('fun', 'fun A'), ('fun', 'fun B'),
      ('deep', 'deep A'), ('deep', 'deep B')
  `);
});

const draw = async (person: string, category: string | null = null) =>
  (
    await sql<{ id: string; question_id: string; drawn_by: string }>(
      `select * from draw_question($1::person, $2::question_category)`,
      [person, category],
    )
  )[0];

describe('draw_question', () => {
  it('pesca una domanda e crea un round aperto', async () => {
    const round = await draw('fabrizio');
    expect(round.drawn_by).toBe('fabrizio');
    const rows = await sql<{ closed_at: string | null }>(
      'select closed_at from question_rounds where id = $1',
      [round.id],
    );
    expect(rows[0].closed_at).toBeNull();
  });

  it('rispetta la categoria richiesta', async () => {
    const round = await draw('fabrizio', 'deep');
    const rows = await sql<{ category: string }>('select category from questions where id = $1', [
      round.question_id,
    ]);
    expect(rows[0].category).toBe('deep');
  });

  it('senza categoria pesca da tutte', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const round = await draw('fabrizio');
      const [{ category }] = await sql<{ category: string }>(
        'select category from questions where id = $1',
        [round.question_id],
      );
      seen.add(category);
      await sql(`update question_rounds set closed_at = now(), closed_reason = 'skipped'
                 where id = $1`, [round.id]);
    }
    // Con solo 2 domande per categoria e 20 pescate (con richiusura fra una e
    // l'altra), è praticamente certo che siano comparse entrambe le categorie.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('rifiuta una seconda pescata mentre un round è aperto', async () => {
    await draw('fabrizio');
    await expect(draw('emily')).rejects.toThrow(/round_already_open/);
  });

  it('dopo che il round si chiude, si può pescare di nuovo', async () => {
    const first = await draw('fabrizio');
    await sql(`update question_rounds set closed_at = now(), closed_reason = 'skipped'
               where id = $1`, [first.id]);
    await expect(draw('emily')).resolves.toBeDefined();
  });

  it('non ripesca una domanda già risposta, finché ce ne sono altre nella categoria', async () => {
    const seenQuestionIds = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const round = await draw('fabrizio', 'fun');
      expect(seenQuestionIds.has(round.question_id)).toBe(false);
      seenQuestionIds.add(round.question_id);
      await sql(`update question_rounds set closed_at = now(), closed_reason = 'answered'
                 where id = $1`, [round.id]);
    }
    expect(seenQuestionIds.size).toBe(2); // le due uniche domande 'fun' del fixture
  });

  it('esaurita la categoria, ripesca dalla più vecchia invece di fallire', async () => {
    // Risponde a entrambe le domande 'fun', la prima molto prima della seconda.
    const first = await draw('fabrizio', 'fun');
    await sql(
      `update question_rounds set closed_at = now() - interval '10 days', closed_reason = 'answered'
       where id = $1`,
      [first.id],
    );
    const second = await draw('fabrizio', 'fun');
    await sql(`update question_rounds set closed_at = now(), closed_reason = 'answered'
               where id = $1`, [second.id]);

    // Categoria esaurita: la terza pescata deve ripescare quella chiusa da più
    // tempo, cioè la prima (10 giorni fa), non fallire.
    const third = await draw('fabrizio', 'fun');
    expect(third.question_id).toBe(first.question_id);
  });

  it('una domanda skippata resta pescabile, non viene esclusa come le risposte', async () => {
    const round = await draw('fabrizio', 'deep');
    const skippedQuestionId = round.question_id;
    await sql(`update question_rounds set closed_at = now(), closed_reason = 'skipped'
               where id = $1`, [round.id]);
    // Con una sola domanda 'deep' rimasta candidata (l'altra 'deep' del
    // fixture, mai toccata) più quella appena skippata: entrambe devono
    // restare nel pool delle "mai risposte".
    const again = await draw('fabrizio', 'deep');
    expect(['deep A', 'deep B']).toContain(
      (await sql<{ body: string }>('select body from questions where id = $1', [
        again.question_id,
      ]))[0].body,
    );
    void skippedQuestionId;
  });

  it('due pescate concorrenti: una sola riesce, l’altra riceve round_already_open', async () => {
    // Autenticazione in sequenza e connessioni "riscaldate" prima della vera
    // corsa: la forma naive con due login dentro Promise.all è intermittente,
    // perché la finestra di corsa finisce per dipendere dall'handshake della
    // connessione invece che dal comportamento della funzione (lezione da
    // F0+F1, task 3 e 7).
    const clientA = await signedInClient();
    const clientB = await signedInClient();
    await clientA.from('questions').select('id').limit(1);
    await clientB.from('questions').select('id').limit(1);

    // p_category è un parametro opzionale con default nel database (i tipi
    // generati lo tipano come `?`, non nullable): si passa `undefined`, non
    // `null`, per chiedere "qualunque categoria".
    const [a, b] = await Promise.all([
      clientA.rpc('draw_question', { p_person: 'fabrizio', p_category: undefined }),
      clientB.rpc('draw_question', { p_person: 'emily', p_category: undefined }),
    ]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/round_already_open|one_open_round/);

    const openRounds = await sql('select 1 from question_rounds where closed_at is null');
    expect(openRounds).toHaveLength(1);
  });
});
