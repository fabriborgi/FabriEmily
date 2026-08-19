import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

beforeEach(resetData);

describe('game_type include quoridor', () => {
  it('create_match apre una partita di tipo quoridor, senza alcuna modifica alla funzione', async () => {
    const rows = await sql<{ game_type: string; current_turn: string }>(
      `select * from create_match('quoridor'::game_type, 'fabrizio'::person, '{"positions":{"fabrizio":{"row":0,"col":4},"emily":{"row":8,"col":4}},"walls":[],"wallsRemaining":{"fabrizio":10,"emily":10}}')`,
    );
    expect(rows[0].game_type).toBe('quoridor');
    expect(rows[0].current_turn).toBe('fabrizio');
  });
});
