import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const insert = async (author: string) =>
  (
    await sql<{ id: string }>(
      `insert into letters (author, kind, body) values ($1::person, 'text', $2) returning id`,
      [author, 'x'.repeat(50)],
    )
  )[0].id;

const readAt = async (id: string) =>
  (await sql<{ read_at: string | null }>('select read_at from letters where id = $1', [id]))[0]
    .read_at;

const markRead = (id: string, reader: string) =>
  sql('select mark_letter_read($1::uuid, $2::person)', [id, reader]);

describe('mark_letter_read', () => {
  beforeEach(resetData);

  it('il destinatario segna la lettera come letta', async () => {
    const id = await insert('fabrizio');
    await markRead(id, 'emily');
    expect(await readAt(id)).not.toBeNull();
  });

  it("l'autore non può segnare come letta la propria lettera", async () => {
    const id = await insert('fabrizio');
    await markRead(id, 'fabrizio');
    expect(await readAt(id)).toBeNull();
  });

  it('la seconda chiamata non cambia il momento della lettura', async () => {
    const id = await insert('fabrizio');
    await markRead(id, 'emily');
    const first = await readAt(id);
    await markRead(id, 'emily');
    expect(await readAt(id)).toEqual(first);
  });

  it('un id inesistente non solleva errori', async () => {
    await expect(
      markRead('00000000-0000-0000-0000-000000000000', 'emily'),
    ).resolves.toBeDefined();
  });

  it('authenticated ha il privilegio EXECUTE sulla funzione', async () => {
    const result = await sql<{ has_privilege: boolean }>(
      `select has_function_privilege('authenticated', 'mark_letter_read(uuid, person)', 'EXECUTE') as has_privilege`
    );
    expect(result[0].has_privilege).toBe(true);
  });

  it('anon non ha il privilegio EXECUTE sulla funzione', async () => {
    const result = await sql<{ has_privilege: boolean }>(
      `select has_function_privilege('anon', 'mark_letter_read(uuid, person)', 'EXECUTE') as has_privilege`
    );
    expect(result[0].has_privilege).toBe(false);
  });
});
