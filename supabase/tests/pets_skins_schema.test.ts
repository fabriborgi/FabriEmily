import { describe, it, expect } from 'vitest';
import { sql } from './helpers';

describe('schema delle skin', () => {
  it('semina esattamente 8 skin in item_prices', async () => {
    const rows = await sql<{ count: string }>(
      `select count(*) from item_prices where key like 'skin_%'`,
    );
    expect(Number(rows[0].count)).toBe(8);
  });

  it('applica il costo uniforme di 50 monete', async () => {
    const rows = await sql<{ cost: number }>(`select cost from item_prices where key like 'skin_%'`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.cost === 50)).toBe(true);
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
