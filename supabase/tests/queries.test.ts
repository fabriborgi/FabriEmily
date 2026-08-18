import { describe, it, expect, beforeEach } from 'vitest';
import { resetData, signedInClient, sql } from './helpers';
import {
  fetchLetters,
  fetchLetter,
  sendText,
  sendDrawing,
  markRead,
} from '@/features/letters/queries';

const LONG = 'This is long enough to earn the fifteen coins it deserves, I promise.';
const STROKES = Array.from({ length: 5 }, (_, i) => ({ c: i, w: 1, p: [10, 10, 40, 40] }));

describe('queries delle lettere contro il database reale', () => {
  beforeEach(resetData);

  it('sendText usa i nomi di parametro giusti e ritorna la lettera', async () => {
    const client = await signedInClient();
    const { data, error } = await sendText('fabrizio', LONG, client);
    expect(error).toBeNull();
    expect(data?.author).toBe('fabrizio');
    expect(data?.kind).toBe('text');
  });

  it('sendDrawing salva i tratti', async () => {
    const client = await signedInClient();
    const { data, error } = await sendDrawing('emily', STROKES, client);
    expect(error).toBeNull();
    expect(data?.strokes).toEqual(STROKES);
  });

  it('traduce l’errore di una lettera vuota', async () => {
    const client = await signedInClient();
    const { data, error } = await sendText('emily', '   ', client);
    expect(data).toBeNull();
    expect(error).toBe('Write something first.');
  });

  it('traduce l’errore di un disegno malformato', async () => {
    const client = await signedInClient();
    const { error } = await sendDrawing('emily', [{ c: 99, w: 0, p: [1, 1] }], client);
    expect(error).toBe("That drawing couldn't be saved. Try drawing it again.");
  });

  it('fetchLetters ritorna dalla più recente', async () => {
    const client = await signedInClient();
    await sendText('emily', `${LONG} uno`, client);
    await sendText('emily', `${LONG} due`, client);
    const letters = await fetchLetters(client);
    expect(letters[0].body).toContain('due');
    expect(letters).toHaveLength(2);
  });

  it('fetchLetter trova una lettera per id, e null per un id inesistente', async () => {
    const client = await signedInClient();
    const { data } = await sendText('emily', LONG, client);
    expect((await fetchLetter(data!.id, client))?.body).toBe(LONG);
    expect(await fetchLetter('00000000-0000-0000-0000-000000000000', client)).toBeNull();
  });

  it('markRead segna la lettera come letta dal destinatario', async () => {
    const client = await signedInClient();
    const { data } = await sendText('emily', LONG, client);
    const { error } = await markRead(data!.id, 'fabrizio', client);
    expect(error).toBeNull();
    expect((await fetchLetter(data!.id, client))?.read_at).not.toBeNull();
  });

  it('il saldo monete si muove come previsto', async () => {
    const client = await signedInClient();
    await sendText('emily', LONG, client);
    await sendDrawing('emily', STROKES, client);
    const rows = await sql<{ coins: number }>('select coins from couple_state where id = 1');
    expect(rows[0].coins).toBe(35);
  });
});
