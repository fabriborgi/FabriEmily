import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const LONG = 'I miss you more than I know how to write down, but I am trying anyway.'; // 69 char

const writeText = async (author: string, body: string) =>
  (
    await sql<{ id: string; author: string; kind: string; body: string }>(
      `select * from create_letter($1::person, 'text'::letter_kind, $2, null)`,
      [author, body],
    )
  )[0];

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

describe('create_letter — testo', () => {
  beforeEach(resetData);

  it('inserisce la lettera e ne ritorna la riga', async () => {
    const letter = await writeText('fabrizio', LONG);
    expect(letter.author).toBe('fabrizio');
    expect(letter.kind).toBe('text');
    expect(letter.body).toBe(LONG);
    expect(letter.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('nasce non letta', async () => {
    const letter = await writeText('fabrizio', LONG);
    const rows = await sql<{ read_at: string | null }>(
      'select read_at from letters where id = $1',
      [letter.id],
    );
    expect(rows[0].read_at).toBeNull();
  });

  it('accredita 15 monete per una lettera di almeno 40 caratteri', async () => {
    await writeText('emily', LONG);
    expect(await coins()).toBe(15);
  });

  it('collega il movimento alla lettera tramite ref_id', async () => {
    const letter = await writeText('emily', LONG);
    const rows = await sql<{ ref_id: string; reason: string }>(
      'select ref_id, reason from coin_ledger',
    );
    expect(rows).toEqual([{ ref_id: letter.id, reason: 'letter_written' }]);
  });

  it('salva ma non paga una lettera troppo corta', async () => {
    const letter = await writeText('emily', 'ti amo');
    expect(letter.body).toBe('ti amo');
    expect(await coins()).toBe(0);
  });

  it('conta i caratteri senza gli spazi ai bordi', async () => {
    await writeText('emily', `   ${'a'.repeat(39)}   `);
    expect(await coins()).toBe(0);
  });

  it('salva ma non paga la quarta lettera della giornata', async () => {
    for (let i = 0; i < 3; i++) await writeText('emily', LONG);
    expect(await coins()).toBe(45);
    await writeText('emily', LONG);
    expect(await coins()).toBe(45);
    expect(await sql('select 1 from letters')).toHaveLength(4);
  });

  it('rifiuta un corpo vuoto senza inserire nulla', async () => {
    await expect(writeText('emily', '   ')).rejects.toThrow(/empty_letter/);
    expect(await sql('select 1 from letters')).toHaveLength(0);
  });

  it('ignora i tratti passati a una lettera di testo', async () => {
    const rows = await sql<{ strokes: unknown }>(
      `select strokes from create_letter('emily'::person, 'text'::letter_kind, $1, '[]'::jsonb)`,
      [LONG],
    );
    expect(rows[0].strokes).toBeNull();
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [{ can_authenticated, can_anon }] = await sql<{
      can_authenticated: boolean;
      can_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated', 'public.create_letter(person, letter_kind, text, jsonb)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon',           'public.create_letter(person, letter_kind, text, jsonb)', 'EXECUTE') as can_anon
    `);
    expect(can_authenticated).toBe(true);
    expect(can_anon).toBe(false);
  });
});
