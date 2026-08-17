import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, anonClient, serviceClient, resetData } from './helpers';

describe('schema e permessi', () => {
  beforeEach(resetData);

  it('couple_state ha esattamente una riga, con id 1', async () => {
    const rows = await sql<{ id: number; coins: number }>('select id, coins from couple_state');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });

  it('impedisce una seconda riga in couple_state', async () => {
    await expect(sql('insert into couple_state (id) values (2)')).rejects.toThrow();
  });

  it('rifiuta una lettera di testo senza corpo', async () => {
    await expect(
      sql(`insert into letters (author, kind) values ('emily', 'text')`),
    ).rejects.toThrow(/letters_payload_matches_kind/);
  });

  it('rifiuta un disegno che porta anche del testo', async () => {
    await expect(
      sql(`insert into letters (author, kind, body, strokes)
           values ('emily', 'drawing', 'ciao', '[]'::jsonb)`),
    ).rejects.toThrow(/letters_payload_matches_kind/);
  });

  it('rifiuta una lettera di testo di soli spazi', async () => {
    await expect(
      sql(`insert into letters (author, kind, body) values ('emily', 'text', '   ')`),
    ).rejects.toThrow(/letters_text_not_blank/);
  });

  it('un client autenticato legge le lettere', async () => {
    await sql(`insert into letters (author, kind, body) values ('emily', 'text', 'hello there')`);
    const client = await signedInClient();
    const { data, error } = await client.from('letters').select('id, body');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('un client anonimo NON legge le lettere', async () => {
    await sql(`insert into letters (author, kind, body) values ('emily', 'text', 'hello there')`);
    const { data, error } = await anonClient().from('letters').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error ?? { message: '' }).toBeTruthy();
  });

  it('un client autenticato NON scrive sulle lettere', async () => {
    const client = await signedInClient();
    const { error } = await client
      .from('letters')
      .insert({ author: 'emily', kind: 'text', body: 'x'.repeat(50) });
    expect(error).not.toBeNull();
  });

  it('un client autenticato NON modifica il saldo monete', async () => {
    const client = await signedInClient();
    const { error } = await client.from('couple_state').update({ coins: 99999 }).eq('id', 1);
    expect(error).not.toBeNull();
    const rows = await sql<{ coins: number }>('select coins from couple_state where id = 1');
    expect(rows[0].coins).toBe(0);
  });

  it('letters e couple_state sono pubblicate su Realtime', async () => {
    const rows = await sql<{ tablename: string }>(`
      select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' order by tablename
    `);
    const names = rows.map((r) => r.tablename);
    expect(names).toContain('letters');
    expect(names).toContain('couple_state');
  });

  it('il saldo monete non può diventare negativo', async () => {
    const admin = serviceClient();
    const { error } = await admin.from('couple_state').update({ coins: -1 }).eq('id', 1);
    expect(error).not.toBeNull();
  });

  // Regressione: RLS non copre TRUNCATE. Senza una REVOKE ALL esplicita su tabelle
  // e sequence, anon e authenticated mantengono i privilegi di default (TRUNCATE,
  // REFERENCES, TRIGGER, MAINTAIN) e possono svuotare qualunque tabella nonostante
  // le policy di sola lettura. Ripetiamo qui esattamente il repro della review.
  it('anon non può fare TRUNCATE su letters', async () => {
    await expect(
      sql(`begin; set local role anon; truncate letters; rollback;`),
    ).rejects.toThrow(/permission denied/);
  });

  it('authenticated non può fare TRUNCATE su couple_state', async () => {
    await expect(
      sql(`begin; set local role authenticated; truncate couple_state; rollback;`),
    ).rejects.toThrow(/permission denied/);
  });
});
