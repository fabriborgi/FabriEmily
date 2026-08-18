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
