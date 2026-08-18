import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql, signedInClient, resetData, cleanupItems } from './helpers';

const price = (key: string, cost: number) =>
  sql('insert into item_prices (key, cost, label) values ($1, $2, $3)', [key, cost, key]);
const setCoins = (n: number) => sql('update couple_state set coins = $1 where id = 1', [n]);
const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;
const owns = async (key: string) =>
  (await sql('select 1 from owned_items where key = $1', [key])).length > 0;

const purchase = (actor: string, key: string) =>
  sql('select purchase_item($1::person, $2)', [actor, key]);

beforeEach(async () => {
  await resetData();
  await price('theme_test', 100);
});

afterEach(() => cleanupItems(['theme_test']));

describe('purchase_item', () => {
  it('scala le monete e registra il possesso', async () => {
    await setCoins(150);
    await purchase('emily', 'theme_test');
    expect(await coins()).toBe(50);
    expect(await owns('theme_test')).toBe(true);
  });

  it('rifiuta un secondo acquisto dello stesso oggetto', async () => {
    await setCoins(500);
    await purchase('emily', 'theme_test');
    await expect(purchase('fabrizio', 'theme_test')).rejects.toThrow(/already_owned/);
    expect(await coins()).toBe(400); // solo il primo acquisto ha pagato
  });

  it('propaga insufficient_funds senza registrare il possesso', async () => {
    await setCoins(50);
    await expect(purchase('emily', 'theme_test')).rejects.toThrow(/insufficient_funds/);
    expect(await owns('theme_test')).toBe(false);
    expect(await coins()).toBe(50);
  });

  it('propaga unknown_item per una chiave inesistente', async () => {
    await setCoins(1000);
    await expect(purchase('emily', 'does_not_exist')).rejects.toThrow(/unknown_item/);
  });

  it('due acquisti simultanei dello stesso oggetto: uno solo riesce', async () => {
    await setCoins(1000);
    const clientA = await signedInClient();
    const clientB = await signedInClient();
    await clientA.from('item_prices').select('key').limit(1);
    await clientB.from('item_prices').select('key').limit(1);

    const [a, b] = await Promise.all([
      clientA.rpc('purchase_item', { p_actor: 'emily', p_item_key: 'theme_test' }),
      clientB.rpc('purchase_item', { p_actor: 'fabrizio', p_item_key: 'theme_test' }),
    ]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/already_owned/);
    expect(await coins()).toBe(900); // una sola spesa è passata
    expect(await sql('select 1 from owned_items where key = $1', ['theme_test'])).toHaveLength(1);
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.purchase_item(person, text)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.purchase_item(person, text)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
