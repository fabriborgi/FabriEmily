import { describe, it, expect } from 'vitest';
import { sql } from './helpers';

describe('schema di pets e catalogo prezzi', () => {
  it('semina esattamente 47 specie in item_prices', async () => {
    const rows = await sql<{ count: string }>(
      `select count(*) from item_prices where key like 'pet_%' or key like 'plant_%'`,
    );
    expect(Number(rows[0].count)).toBe(47);
  });

  it('applica i costi per categoria dalla spec', async () => {
    const rows = await sql<{ key: string; cost: number }>(
      `select key, cost from item_prices where key in ('pet_dog', 'pet_koala', 'pet_unicorn', 'plant_fern')`,
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.cost]));
    expect(byKey.pet_dog).toBe(35);
    expect(byKey.pet_koala).toBe(70);
    expect(byKey.pet_unicorn).toBe(140);
    expect(byKey.plant_fern).toBe(25);
  });

  it('la tabella pets è leggibile da authenticated ma non scrivibile direttamente', async () => {
    const [row] = await sql<{
      can_select_authenticated: boolean;
      can_select_anon: boolean;
      can_insert_authenticated: boolean;
    }>(`
      select
        has_table_privilege('authenticated', 'public.pets', 'SELECT') as can_select_authenticated,
        has_table_privilege('anon', 'public.pets', 'SELECT') as can_select_anon,
        has_table_privilege('authenticated', 'public.pets', 'INSERT') as can_insert_authenticated
    `);
    expect(row.can_select_authenticated).toBe(true);
    expect(row.can_select_anon).toBe(false);
    expect(row.can_insert_authenticated).toBe(false);
  });
});
