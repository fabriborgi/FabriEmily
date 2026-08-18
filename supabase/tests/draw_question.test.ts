import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql, signedInClient, resetData, cleanupQuestions } from './helpers';

// `questions` non è mai svuotata da resetData() (è seme, come coin_rules) e
// questa suite gira in sequenza con altri file (fileParallelism: false) che
// possono già aver seminato le 300 domande reali (Task 5). Ogni test traccia
// gli id che crea e li rimuove chirurgicamente in afterEach — mai una delete
// indiscriminata, che cancellerebbe il seme reale o le fixture di altri
// file. Trovato eseguendo il Task 5: una prima versione con "delete from
// questions" nel beforeEach faceva sparire il seme reale non appena la
// suite completa arrivava a questo file.
let fixtureIds: string[] = [];
let fun_A: string, fun_B: string, deep_A: string, deep_B: string;

beforeEach(async () => {
  await resetData();
  const rows = await sql<{ id: string; body: string }>(
    `insert into questions (category, body) values
       ('fun', 'fun A'), ('fun', 'fun B'),
       ('deep', 'deep A'), ('deep', 'deep B')
     returning id, body`,
  );
  fixtureIds = rows.map((r) => r.id);
  fun_A = rows.find((r) => r.body === 'fun A')!.id;
  fun_B = rows.find((r) => r.body === 'fun B')!.id;
  deep_A = rows.find((r) => r.body === 'deep A')!.id;
  deep_B = rows.find((r) => r.body === 'deep B')!.id;
});

afterEach(async () => {
  await cleanupQuestions(fixtureIds);
  fixtureIds = [];
});

/**
 * Chiude come 'answered' ogni domanda della categoria che non è fra quelle
 * controllate dal test corrente, così il pool delle "mai risposte" per
 * quella categoria resta esattamente quello atteso — indipendente da quante
 * domande reali (il seme del Task 5) o di altri file esistano già. I round
 * sintetici creati qui vengono ripuliti dall'afterEach standard, perché
 * puntano a domande NON tracciate in fixtureIds: vanno rimossi a parte.
 */
async function isolateCategory(category: string, controlledIds: string[]): Promise<void> {
  const others = await sql<{ id: string }>(
    `select id from questions where category = $1::question_category and not (id = any($2::uuid[]))`,
    [category, controlledIds],
  );
  if (others.length === 0) return;
  // closed_at = now(), NON un anno fa: il riciclo di draw_question sceglie
  // la domanda con la chiusura "answered" più VECCHIA. Se queste chiusure
  // sintetiche fossero più vecchie del "10 giorni fa" che il test assegna
  // deliberatamente a `first`, verrebbero scelte loro al posto di `first` —
  // bug trovato eseguendo questo stesso task: `now()` qui, eseguito PRIMA
  // del draw di `first`, resta comunque più recente di "10 giorni fa".
  await sql(
    `insert into question_rounds (question_id, drawn_by, closed_at, closed_reason)
     select id, 'fabrizio', now(), 'answered'
     from questions where id = any($1::uuid[])`,
    [others.map((o) => o.id)],
  );
}

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
    // Con il seme reale (o almeno più categorie disponibili) è praticamente
    // certo che compaiano categorie diverse su 20 pescate.
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
    // Isolata: senza chiudere le altre 'fun' del seme reale, due draw su una
    // categoria enorme non garantirebbero di pescare proprio le due
    // controllate, ma la proprietà sotto test — nessun id ripetuto — vale
    // comunque. Isoliamo per rendere il test deterministico e leggibile.
    await isolateCategory('fun', [fun_A, fun_B]);
    const seenQuestionIds = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const round = await draw('fabrizio', 'fun');
      expect(seenQuestionIds.has(round.question_id)).toBe(false);
      seenQuestionIds.add(round.question_id);
      await sql(`update question_rounds set closed_at = now(), closed_reason = 'answered'
                 where id = $1`, [round.id]);
    }
    expect(seenQuestionIds.size).toBe(2);
    expect([fun_A, fun_B]).toEqual(expect.arrayContaining([...seenQuestionIds]));
  });

  it('esaurita la categoria, ripesca dalla più vecchia invece di fallire', async () => {
    // Isolamento indispensabile qui: con il seme reale (60 domande 'fun') il
    // pool delle "mai risposte" non si esaurirebbe mai rispondendo solo a
    // queste due, e il test non arriverebbe mai a esercitare il riciclo.
    await isolateCategory('fun', [fun_A, fun_B]);

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
    await isolateCategory('deep', [deep_A, deep_B]);
    const round = await draw('fabrizio', 'deep');
    await sql(`update question_rounds set closed_at = now(), closed_reason = 'skipped'
               where id = $1`, [round.id]);
    // Con una sola domanda 'deep' rimasta candidata (l'altra, mai toccata)
    // più quella appena skippata: entrambe devono restare nel pool delle
    // "mai risposte".
    const again = await draw('fabrizio', 'deep');
    expect([deep_A, deep_B]).toContain(again.question_id);
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
