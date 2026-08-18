import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql, signedInClient, resetData, cleanupItems } from './helpers';

const setCoins = (n: number) =>
  sql('update couple_state set coins = $1 where id = 1', [n]);

const price = (key: string, cost: number) =>
  sql('insert into item_prices (key, cost, label) values ($1, $2, $3)', [key, cost, key]);

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

const spend = async (actor: string, key: string) =>
  (
    await sql<{ spend_coins: number }>('select spend_coins($1::person, $2) as spend_coins', [
      actor,
      key,
    ])
  )[0].spend_coins;

describe('spend_coins', () => {
  beforeEach(async () => {
    await resetData();
    await price('pet:koala', 150);
  });

  afterEach(() => cleanupItems(['pet:koala']));

  it('scala il costo e ritorna il nuovo saldo', async () => {
    await setCoins(200);
    expect(await spend('emily', 'pet:koala')).toBe(50);
    expect(await coins()).toBe(50);
  });

  it('registra la spesa nel ledger come importo negativo', async () => {
    await setCoins(200);
    await spend('emily', 'pet:koala');
    const rows = await sql<{ actor: string; amount: number; reason: string }>(
      'select actor, amount, reason from coin_ledger',
    );
    expect(rows).toEqual([{ actor: 'emily', amount: -150, reason: 'spend:pet:koala' }]);
  });

  it('accetta una spesa che azzera esattamente il saldo', async () => {
    await setCoins(150);
    expect(await spend('emily', 'pet:koala')).toBe(0);
  });

  it('rifiuta con insufficient_funds e lascia il saldo intatto', async () => {
    await setCoins(149);
    await expect(spend('emily', 'pet:koala')).rejects.toThrow(/insufficient_funds/);
    expect(await coins()).toBe(149);
    expect(await sql('select 1 from coin_ledger')).toHaveLength(0);
  });

  it('rifiuta una chiave inesistente', async () => {
    await setCoins(1000);
    await expect(spend('emily', 'pet:dragon')).rejects.toThrow(/unknown_item/);
    expect(await coins()).toBe(1000);
  });

  it('con due acquisti simultanei uno solo passa, e il saldo non va sotto zero', async () => {
    await setCoins(150);
    // Le due connessioni si autenticano IN SEQUENZA (due login concorrenti sullo
    // stesso account sono un'altra fonte di intermittenza, indipendente dal bug
    // che vogliamo dimostrare) e solo dopo lanciano le due RPC insieme, come due
    // schede dello stesso browser dopo un doppio tocco sul pulsante.
    const clientA = await signedInClient();
    const clientB = await signedInClient();
    // "Scalda" entrambe le connessioni HTTP con una select innocua prima della
    // corsa: senza questo, il round-trip TCP/TLS della prima richiesta su una
    // connessione la sfalsa rispetto all'altra e la finestra di corsa si perde.
    await Promise.all([
      clientA.from('coin_rules').select('reason').limit(1),
      clientB.from('coin_rules').select('reason').limit(1),
    ]);
    const [a, b] = await Promise.all([
      clientA.rpc('spend_coins', { p_actor: 'emily', p_item_key: 'pet:koala' }),
      clientB.rpc('spend_coins', { p_actor: 'fabrizio', p_item_key: 'pet:koala' }),
    ]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/insufficient_funds/);
    expect(await coins()).toBe(0);
  });

  it('è invocabile da un client autenticato', async () => {
    await setCoins(200);
    const client = await signedInClient();
    const { data, error } = await client.rpc('spend_coins', {
      p_actor: 'emily',
      p_item_key: 'pet:koala',
    });
    expect(error).toBeNull();
    expect(data).toBe(50);
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.spend_coins(person, text)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.spend_coins(person, text)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
