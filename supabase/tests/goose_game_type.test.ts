import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

beforeEach(resetData);

describe('game_type include goose', () => {
  it('create_match apre una partita di tipo goose, senza alcuna modifica alla funzione', async () => {
    const rows = await sql<{ game_type: string; current_turn: string }>(
      `select * from create_match('goose'::game_type, 'fabrizio'::person, '{"positions":{"fabrizio":0,"emily":0},"stuck":{"fabrizio":0,"emily":0},"lastRoll":null}')`,
    );
    expect(rows[0].game_type).toBe('goose');
    expect(rows[0].current_turn).toBe('fabrizio');
  });
});
