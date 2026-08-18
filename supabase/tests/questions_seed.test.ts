import { describe, it, expect } from 'vitest';
import { sql } from './helpers';

describe('seme delle 300 domande', () => {
  it('contiene esattamente 300 domande', async () => {
    const [{ count }] = await sql<{ count: string }>('select count(*) from questions');
    expect(Number(count)).toBe(300);
  });

  it('60 domande per ciascuna delle cinque categorie', async () => {
    // Postgres ordina i valori di un enum secondo l'ordine di dichiarazione
    // nel tipo (deep, spicy, about_us, hypothetical, fun), non alfabetico:
    // il cast a testo rende l'ordinamento prevedibile per chi legge il test.
    const rows = await sql<{ category: string; count: string }>(
      'select category, count(*) from questions group by category order by category::text',
    );
    expect(rows).toEqual([
      { category: 'about_us', count: '60' },
      { category: 'deep', count: '60' },
      { category: 'fun', count: '60' },
      { category: 'hypothetical', count: '60' },
      { category: 'spicy', count: '60' },
    ]);
  });

  it('nessun testo duplicato', async () => {
    const [{ total, unique }] = await sql<{ total: string; unique: string }>(
      'select count(*) as total, count(distinct body) as unique from questions',
    );
    expect(total).toBe(unique);
  });

  it('nessuna domanda vuota', async () => {
    const rows = await sql('select 1 from questions where trim(body) = \'\'');
    expect(rows).toHaveLength(0);
  });
});
