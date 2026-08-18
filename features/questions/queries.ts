import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database } from '@/lib/types';
import type { Person } from '@/features/auth/identity';
import type { QuestionCategory } from './categories';

export type { QuestionCategory };

export type Question = { id: string; category: QuestionCategory; body: string };

export type Round = {
  id: string;
  question_id: string;
  drawn_by: Person;
  drawn_at: string;
  closed_at: string | null;
  closed_reason: 'answered' | 'skipped' | null;
  closed_by: Person | null;
};

export type Answer = { round_id: string; author: Person; body: string; answered_at: string };

export type CurrentRound = { round: Round; question: Question };

export type ClosedRound = { round: Round; question: Question; answers: Answer[] };

type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

const ROUND_COLUMNS = 'id, question_id, drawn_by, drawn_at, closed_at, closed_reason, closed_by';

/**
 * Il round più recente, aperto o appena chiuso: è ciò che la schermata
 * principale mostra. Non filtra su closed_at perché un round appena
 * risposto resta in vista — con le risposte rivelate — finché non se ne
 * pesca uno nuovo.
 */
export async function fetchCurrentRound(client?: Client): Promise<CurrentRound | null> {
  const c = db(client);
  const { data: round, error: roundError } = await c
    .from('question_rounds')
    .select(ROUND_COLUMNS)
    .order('drawn_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (roundError) throw new Error(roundError.message);
  if (!round) return null;

  const { data: question, error: questionError } = await c
    .from('questions')
    .select('id, category, body')
    .eq('id', round.question_id)
    .single();
  if (questionError) throw new Error(questionError.message);

  return { round: round as Round, question: question as Question };
}

/**
 * Le risposte di un round. Le RLS le nascondono finché closed_reason non è
 * 'answered': prima di allora questa funzione ritorna sempre un array vuoto,
 * anche per la propria risposta appena inserita. Non è un dettaglio del
 * client — è imposto dal database, perché l'identità non è verificata e
 * l'unica riservatezza applicabile è "nessuno vede niente" prima del
 * momento in cui entrambe le risposte esistono.
 */
export async function fetchAnswers(roundId: string, client?: Client): Promise<Answer[]> {
  const { data, error } = await db(client)
    .from('question_answers')
    .select('round_id, author, body, answered_at')
    .eq('round_id', roundId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Answer[];
}

/** Solo i round chiusi come 'answered': quelli skippati non hanno nulla da mostrare. */
export async function fetchHistory(client?: Client): Promise<ClosedRound[]> {
  const c = db(client);
  const { data: rounds, error: roundsError } = await c
    .from('question_rounds')
    .select(ROUND_COLUMNS)
    .eq('closed_reason', 'answered')
    .order('closed_at', { ascending: false });
  if (roundsError) throw new Error(roundsError.message);
  if (!rounds || rounds.length === 0) return [];

  const questionIds = [...new Set(rounds.map((r) => r.question_id))];
  const { data: questions, error: questionsError } = await c
    .from('questions')
    .select('id, category, body')
    .in('id', questionIds);
  if (questionsError) throw new Error(questionsError.message);

  const roundIds = rounds.map((r) => r.id);
  const { data: answers, error: answersError } = await c
    .from('question_answers')
    .select('round_id, author, body, answered_at')
    .in('round_id', roundIds);
  if (answersError) throw new Error(answersError.message);

  const questionById = new Map((questions ?? []).map((q) => [q.id, q as Question]));
  const answersByRound = new Map<string, Answer[]>();
  for (const a of (answers ?? []) as Answer[]) {
    const list = answersByRound.get(a.round_id) ?? [];
    list.push(a);
    answersByRound.set(a.round_id, list);
  }

  return (rounds as Round[]).map((r) => ({
    round: r,
    question: questionById.get(r.question_id)!,
    answers: answersByRound.get(r.id) ?? [],
  }));
}

export async function drawQuestion(
  person: Person,
  category: QuestionCategory | null,
  client?: Client,
) {
  // p_category è un parametro opzionale con default nel database: i tipi
  // generati lo tipano come `?` (assente o valore valido), non nullable.
  // "Surprise me" nell'interfaccia usa `null`, quindi va convertito qui.
  return call<Round>(
    db(client)
      .rpc('draw_question', { p_person: person, p_category: category ?? undefined })
      .single(),
  );
}

export async function answerQuestion(
  roundId: string,
  person: Person,
  body: string,
  client?: Client,
) {
  return call<Answer>(
    db(client)
      .rpc('answer_question', { p_round_id: roundId, p_person: person, p_body: body })
      .single(),
  );
}

export async function skipQuestion(roundId: string, person: Person, client?: Client) {
  // Niente .single(): quel metodo si aspetta una risposta a forma di riga di
  // tabella (come per drawQuestion/answerQuestion, che ritornano question_rounds
  // e question_answers). skip_question ritorna uno scalare (boolean), come già
  // mark_letter_read in F0+F1 (void) — stesso motivo per cui quella funzione non
  // lo usa: .single() applicato a una risposta scalare è un errore di categoria,
  // non solo di stile.
  return call<boolean>(
    db(client).rpc('skip_question', { p_round_id: roundId, p_person: person }),
  );
}
