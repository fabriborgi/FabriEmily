import { describe, it, expect, beforeEach } from 'vitest';
import { Client } from 'pg';
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
  // Il regex è ristretto al "permission denied for table ..." specifico: un regex
  // più largo (solo /permission denied/) passerebbe anche se "set local role"
  // fallisse per un altro motivo (es. "permission denied to set role"), il che
  // farebbe passare il test per la ragione sbagliata.
  it('anon non può fare TRUNCATE su letters', async () => {
    await expect(
      sql(`begin; set local role anon; truncate letters; rollback;`),
    ).rejects.toThrow(/permission denied for table letters/);
  });

  it('authenticated non può fare TRUNCATE su couple_state', async () => {
    await expect(
      sql(`begin; set local role authenticated; truncate couple_state; rollback;`),
    ).rejects.toThrow(/permission denied for table couple_state/);
  });

  // Test guidato dai dati: per ogni tabella e ogni verbo di has_table_privilege,
  // anon non deve avere nulla e authenticated solo SELECT. Copre anche le tabelle
  // che verranno aggiunte in futuro, perché interroga il catalogo invece di
  // ripetere un caso per tabella.
  it('anon non ha alcun privilegio sulle tabelle, authenticated solo SELECT', async () => {
    const tables = ['couple_state', 'coin_rules', 'item_prices', 'coin_ledger', 'letters'];
    const verbs = [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
      'MAINTAIN',
    ];
    const rows = await sql<{ role: string; table_name: string; verb: string; has_it: boolean }>(
      `
      select role, table_name, verb,
             has_table_privilege(role, table_name, verb) as has_it
      from unnest($1::text[]) as role
      cross join unnest($2::text[]) as table_name
      cross join unnest($3::text[]) as verb
      `,
      [['anon', 'authenticated'], tables, verbs],
    );

    for (const row of rows) {
      const expected = row.role === 'authenticated' && row.verb === 'SELECT';
      expect(
        row.has_it,
        `${row.role} ${expected ? 'dovrebbe' : 'non dovrebbe'} avere ${row.verb} su ${row.table_name}`,
      ).toBe(expected);
    }

    // Anche la sequence del ledger: né anon né authenticated devono poterla usare.
    const seqVerbs = ['USAGE', 'SELECT', 'UPDATE'];
    const seqRows = await sql<{ role: string; verb: string; has_it: boolean }>(
      `
      select role, verb,
             has_sequence_privilege(role, 'coin_ledger_id_seq', verb) as has_it
      from unnest($1::text[]) as role
      cross join unnest($2::text[]) as verb
      `,
      [['anon', 'authenticated'], seqVerbs],
    );
    for (const row of seqRows) {
      expect(
        row.has_it,
        `${row.role} non dovrebbe avere ${row.verb} su coin_ledger_id_seq`,
      ).toBe(false);
    }
  });

  // Rilievo 1: una funzione security definer creata in public deve nascere
  // NON eseguibile da PUBLIC (e quindi da anon), a meno di una GRANT esplicita.
  // Senza "alter default privileges ... revoke execute on functions from public",
  // proacl resta NULL e has_function_privilege('anon', ...) risulta true: questo
  // test fallisce contro lo schema attuale, prima della correzione.
  it('una funzione appena creata in public non è eseguibile da anon per default', async () => {
    // begin/rollback devono avvenire sulla stessa sessione: usiamo un'unica
    // connessione dedicata (sql() ne apre una nuova per ogni chiamata) invece del
    // helper sql(), così la funzione di prova sparisce sempre, anche se
    // l'assertion fallisce.
    const client = new Client({ connectionString: process.env.DB_URL });
    await client.connect();
    try {
      await client.query('begin');
      await client.query(`
        create function public.__probe_default_privileges() returns void
          language sql security definer as $$ select 1 $$;
      `);
      const res = await client.query<{ can_execute: boolean }>(
        `select has_function_privilege('anon', 'public.__probe_default_privileges()', 'EXECUTE') as can_execute`,
      );
      expect(res.rows[0].can_execute).toBe(false);
    } finally {
      await client.query('rollback');
      await client.end();
    }
  });
});
