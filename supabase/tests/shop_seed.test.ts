import { describe, it, expect } from 'vitest';
import { sql } from './helpers';

describe('catalogo dei temi', () => {
  it('contiene i 4 temi acquistabili a 100 monete ciascuno', async () => {
    const rows = await sql<{ key: string; cost: number }>(
      `select key, cost from item_prices where key like 'theme_%' order by key`,
    );
    expect(rows).toEqual([
      { key: 'theme_forest', cost: 100 },
      { key: 'theme_night', cost: 100 },
      { key: 'theme_ocean', cost: 100 },
      { key: 'theme_sunset', cost: 100 },
    ]);
  });

  it('ogni tema ha un\'etichetta non vuota', async () => {
    const rows = await sql(
      `select 1 from item_prices where key like 'theme_%' and trim(label) = ''`,
    );
    expect(rows).toHaveLength(0);
  });
});
