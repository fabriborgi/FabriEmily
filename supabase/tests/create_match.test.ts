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
