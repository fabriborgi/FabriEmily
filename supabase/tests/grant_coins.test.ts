import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

const grant = async (actor: string, reason: string, units = 0) =>
  (
    await sql<{ grant_coins: number }>(
      'select grant_coins($1::person, $2, null, $3) as grant_coins',
      [actor, reason, units],
    )
  )[0].grant_coins;

/** Inizio della giornata a Buffalo, come lo calcola grant_coins. */
const DAY_START = `date_trunc('day', now() at time zone 'America/New_York')
                     at time zone 'America/New_York'`;

describe('grant_coins', () => {
  beforeEach(resetData);

  it('accredita l’importo della regola e ritorna il nuovo saldo', async () => {
    const balance = await grant('fabrizio', 'game_win');
    expect(balance).toBe(20);
    expect(await coins()).toBe(20);
  });

  it('scrive una riga di ledger con attore, importo e motivo', async () => {
    await grant('emily', 'game_win');
    const rows = await sql<{ actor: string; amount: number; reason: string }>(
      'select actor, amount, reason from coin_ledger',
    );
    expect(rows).toEqual([{ actor: 'emily', amount: 20, reason: 'game_win' }]);
  });

  it('solleva unknown_coin_reason per un motivo inesistente', async () => {
    await expect(grant('emily', 'nope')).rejects.toThrow(/unknown_coin_reason/);
  });

  it('non accredita sotto il minimo di unità, senza sollevare errori', async () => {
    const balance = await grant('emily', 'letter_written', 39);
    expect(balance).toBe(0);
    expect(await coins()).toBe(0);
    expect(await sql('select 1 from coin_ledger')).toHaveLength(0);
  });

  it('accredita esattamente al minimo di unità', async () => {
    expect(await grant('emily', 'letter_written', 40)).toBe(15);
  });

  it('ferma l’accredito al cap giornaliero', async () => {
    expect(await grant('emily', 'letter_written', 100)).toBe(15);
    expect(await grant('emily', 'letter_written', 100)).toBe(30);
    expect(await grant('emily', 'letter_written', 100)).toBe(45);
    expect(await grant('emily', 'letter_written', 100)).toBe(45); // quarta: niente
    expect(await sql('select 1 from coin_ledger')).toHaveLength(3);
  });

  it('applica il cap per persona, non per coppia', async () => {
    for (let i = 0; i < 3; i++) await grant('emily', 'letter_written', 100);
    expect(await grant('fabrizio', 'letter_written', 100)).toBe(60);
  });

  it('non applica alcun cap quando daily_cap è null', async () => {
    for (let i = 0; i < 6; i++) await grant('fabrizio', 'game_win');
    expect(await coins()).toBe(120);
  });

  it('ignora i movimenti precedenti a mezzanotte di Buffalo', async () => {
    // Tre lettere premiate "ieri": la giornata è nuova, il cap è libero.
    await sql(`
      insert into coin_ledger (actor, amount, reason, created_at)
      select 'emily', 15, 'letter_written', ${DAY_START} - interval '1 minute'
      from generate_series(1, 3)
    `);
    expect(await grant('emily', 'letter_written', 100)).toBeGreaterThan(0);
  });

  it('conta i movimenti successivi a mezzanotte di Buffalo', async () => {
    await sql(`
      insert into coin_ledger (actor, amount, reason, created_at)
      select 'emily', 15, 'letter_written', ${DAY_START} + interval '1 minute'
      from generate_series(1, 3)
    `);
    const before = await coins();
    expect(await grant('emily', 'letter_written', 100)).toBe(before);
  });

  it('conta solo lo stesso motivo, non tutti i movimenti della persona', async () => {
    for (let i = 0; i < 3; i++) await grant('emily', 'letter_written', 100);
    expect(await grant('emily', 'drawing_sent', 10)).toBe(65);
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.grant_coins(person, text, uuid, int)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.grant_coins(person, text, uuid, int)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
