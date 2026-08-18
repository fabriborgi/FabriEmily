import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql, resetData, cleanupItems } from './helpers';

const price = (key: string, cost: number) =>
  sql('insert into item_prices (key, cost, label) values ($1, $2, $3)', [key, cost, key]);
const own = (key: string) => sql('insert into owned_items (key) values ($1)', [key]);
const activeTheme = async () =>
  (await sql<{ theme: string }>('select theme from couple_state where id = 1'))[0].theme;

const select = (key: string) => sql('select select_theme($1)', [key]);

beforeEach(async () => {
  await resetData();
  await price('theme_test', 100);
});

afterEach(() => cleanupItems(['theme_test']));

describe('select_theme', () => {
  it('attiva un tema posseduto', async () => {
    await own('theme_test');
    await select('theme_test');
    expect(await activeTheme()).toBe('theme_test');
  });

  it('rifiuta un tema non posseduto', async () => {
    await expect(select('theme_test')).rejects.toThrow(/theme_not_owned/);
    expect(await activeTheme()).toBe('default');
  });

  it('permette sempre di tornare al default, senza possederlo', async () => {
    await own('theme_test');
    await select('theme_test');
    await select('default');
    expect(await activeTheme()).toBe('default');
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.select_theme(text)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.select_theme(text)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
