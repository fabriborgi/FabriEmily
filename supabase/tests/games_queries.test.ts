import { describe, it, expect, beforeEach } from 'vitest';
import { signedInClient, resetData } from './helpers';
import { fetchActiveMatch, fetchHistoryTally, createMatch, makeMove } from '@/features/games/queries';

const EMPTY = { cells: [null, null, null, null, null, null, null, null, null] };

beforeEach(resetData);

describe('queries dei giochi contro il database reale', () => {
  it('senza partita attiva, fetchActiveMatch ritorna null', async () => {
    const client = await signedInClient();
    expect(await fetchActiveMatch('tic_tac_toe', client)).toBeNull();
  });

  it('createMatch apre una partita con current_turn su chi la avvia', async () => {
    const client = await signedInClient();
    const { data, error } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    expect(error).toBeNull();
    expect(data?.current_turn).toBe('fabrizio');
    const active = await fetchActiveMatch('tic_tac_toe', client);
    expect(active?.id).toBe(data?.id);
  });

  it("makeMove gira il turno senza chiudere la partita se non c'è un risultato", async () => {
    const client = await signedInClient();
    const { data: match } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    const { data: moved, error } = await makeMove(
      match!.id,
      'fabrizio',
      { cells: ['fabrizio', null, null, null, null, null, null, null, null] },
      null,
      null,
      client,
    );
    expect(error).toBeNull();
    expect(moved?.current_turn).toBe('emily');
    expect(moved?.closed_at).toBeNull();
  });

  it("makeMove traduce l'errore di una mossa fuori turno", async () => {
    const client = await signedInClient();
    const { data: match } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    const { data, error } = await makeMove(
      match!.id,
      'emily',
      { cells: [null, 'emily', null, null, null, null, null, null, null] },
      null,
      null,
      client,
    );
    expect(data).toBeNull();
    expect(error).toBe("It's not your turn yet.");
  });

  it('fetchHistoryTally conta vittorie e pareggi dopo la chiusura', async () => {
    const client = await signedInClient();
    const { data: match } = await createMatch('tic_tac_toe', 'fabrizio', EMPTY, client);
    await makeMove(
      match!.id,
      'fabrizio',
      { cells: ['fabrizio', 'fabrizio', 'fabrizio', null, null, null, null, null, null] },
      'win',
      'fabrizio',
      client,
    );
    const tally = await fetchHistoryTally('tic_tac_toe', client);
    expect(tally).toEqual({ fabrizio: 1, emily: 0, draws: 0 });
  });
});
