import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql, signedInClient, anonClient, resetData, cleanupItems } from './helpers';

const price = (key: string, cost: number) =>
  sql('insert into item_prices (key, cost, label) values ($1, $2, $3)', [key, cost, key]);

beforeEach(async () => {
  await resetData();
  await price('theme_test', 100);
});

afterEach(() => cleanupItems(['theme_test']));

describe('schema owned_items — vincoli e permessi', () => {
  it('impedisce di possedere due volte la stessa chiave', async () => {
    await sql(`insert into owned_items (key) values ('theme_test')`);
    await expect(sql(`insert into owned_items (key) values ('theme_test')`)).rejects.toThrow();
  });

  it('rifiuta una chiave che non esiste in item_prices', async () => {
    await expect(
      sql(`insert into owned_items (key) values ('does_not_exist')`),
    ).rejects.toThrow();
  });

  it('un client autenticato legge i posseduti', async () => {
    await sql(`insert into owned_items (key) values ('theme_test')`);
    const client = await signedInClient();
    const { data, error } = await client.from('owned_items').select('key');
    expect(error).toBeNull();
    expect(data).toEqual([{ key: 'theme_test' }]);
  });

  it('un client anonimo non legge i posseduti', async () => {
    await sql(`insert into owned_items (key) values ('theme_test')`);
    const { data, error } = await anonClient().from('owned_items').select('key');
    expect(data ?? []).toHaveLength(0);
    expect(error ?? { message: '' }).toBeTruthy();
  });

  it('un client autenticato non scrive direttamente', async () => {
    const client = await signedInClient();
    const { error } = await client.from('owned_items').insert({ key: 'theme_test' });
    expect(error).not.toBeNull();
  });

  it('owned_items è pubblicata su Realtime', async () => {
    const rows = await sql<{ tablename: string }>(`
      select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'owned_items'
    `);
    expect(rows).toHaveLength(1);
  });
});
