import { describe, it, expect } from 'vitest';
import { sql } from './helpers';

describe('schema delle skin', () => {
  it('semina esattamente le 8 skin attese, a 50 monete ciascuna', async () => {
    const rows = await sql<{ key: string; cost: number }>(
      `select key, cost from item_prices where key like 'skin_%' order by key`,
    );
    expect(rows).toEqual([
      { key: 'skin_charcoal', cost: 50 },
      { key: 'skin_forest', cost: 50 },
      { key: 'skin_gold', cost: 50 },
      { key: 'skin_mint', cost: 50 },
      { key: 'skin_ocean', cost: 50 },
      { key: 'skin_rose', cost: 50 },
      { key: 'skin_sunset', cost: 50 },
      { key: 'skin_violet', cost: 50 },
    ]);
  });

  it('ogni skin ha un\'etichetta non vuota', async () => {
    const rows = await sql(
      `select 1 from item_prices where key like 'skin_%' and trim(label) = ''`,
    );
    expect(rows).toHaveLength(0);
  });

  it('pets ha la colonna active_skin, nullable', async () => {
    const rows = await sql<{ is_nullable: string }>(`
      select is_nullable from information_schema.columns
      where table_name = 'pets' and column_name = 'active_skin'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].is_nullable).toBe('YES');
  });
});
