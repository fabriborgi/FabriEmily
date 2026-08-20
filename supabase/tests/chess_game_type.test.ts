import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

beforeEach(resetData);

describe('game_type include chess', () => {
  it('create_match apre una partita di tipo chess, senza alcuna modifica alla funzione', async () => {
    const rows = await sql<{ game_type: string; current_turn: string }>(
      `select * from create_match('chess'::game_type, 'fabrizio'::person, '{"board":[],"castlingRights":{},"enPassantTarget":null}')`,
    );
    expect(rows[0].game_type).toBe('chess');
    expect(rows[0].current_turn).toBe('fabrizio');
  });
});
