import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, anonClient, resetData } from './helpers';

beforeEach(resetData);

const insertMatch = async (closed = false) => {
  const rows = await sql<{ id: string }>(
    `insert into game_matches (game_type, state, started_by, current_turn, closed_at, winner)
     values ('tic_tac_toe', '{"cells":[null,null,null,null,null,null,null,null,null]}', 'fabrizio', 'fabrizio',
             case when $1 then now() else null end,
             case when $1 then 'fabrizio'::person else null end)
     returning id`,
    [closed],
  );
  return rows[0].id;
};

describe('schema game_matches — vincoli e permessi', () => {
  it('impedisce una seconda partita aperta dello stesso gioco', async () => {
    await insertMatch();
    await expect(insertMatch()).rejects.toThrow(/one_open_match_per_game/);
  });

  it('permette molte partite chiuse dello stesso gioco', async () => {
    await insertMatch(true);
    await expect(insertMatch(true)).resolves.toBeDefined();
  });

  it('un client autenticato legge le partite', async () => {
    await insertMatch();
    const client = await signedInClient();
    const { data, error } = await client.from('game_matches').select('id');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('un client anonimo NON legge le partite', async () => {
    await insertMatch();
    const { data, error } = await anonClient().from('game_matches').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error ?? { message: '' }).toBeTruthy();
  });

  it('un client autenticato NON scrive direttamente', async () => {
    const client = await signedInClient();
    const { error } = await client.from('game_matches').insert({
      game_type: 'tic_tac_toe',
      state: {},
      started_by: 'fabrizio',
      current_turn: 'fabrizio',
    });
    expect(error).not.toBeNull();
  });

  it('game_matches è pubblicata su Realtime', async () => {
    const rows = await sql<{ tablename: string }>(`
      select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'game_matches'
    `);
    expect(rows).toHaveLength(1);
  });
});
