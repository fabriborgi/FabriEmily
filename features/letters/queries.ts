import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database } from '@/lib/types';
import type { Person } from '@/features/auth/identity';
import type { Stroke } from './strokes';

export type Letter = {
  id: string;
  author: Person;
  kind: 'text' | 'drawing';
  body: string | null;
  strokes: Stroke[] | null;
  created_at: string;
  read_at: string | null;
};

const COLUMNS = 'id, author, kind, body, strokes, created_at, read_at';

// Il parametro `client` esiste perché i test di integrazione girano in node con una
// sessione creata a mano; nell'app resta sempre il singleton.
export type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

// I tipi generati dichiarano `strokes: Json`. Qui lo restringiamo al nostro formato:
// la garanzia non viene dal tipo ma da assert_valid_strokes, che è l'unica via d'ingresso.
const asLetter = (row: unknown): Letter => row as Letter;

export async function fetchLetters(client?: Client): Promise<Letter[]> {
  const { data, error } = await db(client)
    .from('letters')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(asLetter);
}

export async function fetchLetter(id: string, client?: Client): Promise<Letter | null> {
  const { data, error } = await db(client)
    .from('letters')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asLetter(data) : null;
}

export async function sendText(author: Person, body: string, client?: Client) {
  const { data, error } = await call(
    db(client)
      .rpc('create_letter', { p_author: author, p_kind: 'text', p_body: body })
      .single(),
  );
  return { data: data ? asLetter(data) : null, error };
}

export async function sendDrawing(author: Person, strokes: Stroke[], client?: Client) {
  const { data, error } = await call(
    db(client)
      .rpc('create_letter', {
        p_author: author,
        p_kind: 'drawing',
        p_strokes: strokes,
      })
      .single(),
  );
  return { data: data ? asLetter(data) : null, error };
}

export async function markRead(id: string, reader: Person, client?: Client) {
  const { error } = await call(db(client).rpc('mark_letter_read', { p_id: id, p_reader: reader }));
  return { error };
}
