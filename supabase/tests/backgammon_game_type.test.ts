import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

beforeEach(resetData);

describe('game_type include backgammon', () => {
  it('create_match apre una partita di tipo backgammon, senza alcuna modifica alla funzione', async () => {
    const rows = await sql<{ game_type: string; current_turn: string }>(
      `select * from create_match('backgammon'::game_type, 'fabrizio'::person, '{"points":{},"bar":{"fabrizio":0,"emily":0},"borneOff":{"fabrizio":0,"emily":0}}')`,
    );
    expect(rows[0].game_type).toBe('backgammon');
    expect(rows[0].current_turn).toBe('fabrizio');
  });
});
