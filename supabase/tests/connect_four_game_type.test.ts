import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

beforeEach(resetData);

describe('game_type include connect_four', () => {
  it('create_match apre una partita di tipo connect_four, senza alcuna modifica alla funzione', async () => {
    const rows = await sql<{ game_type: string; current_turn: string }>(
      `select * from create_match('connect_four'::game_type, 'fabrizio'::person, '{"cells":[]}')`,
    );
    expect(rows[0].game_type).toBe('connect_four');
    expect(rows[0].current_turn).toBe('fabrizio');
  });
});
