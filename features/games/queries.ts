import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database, Json } from '@/lib/types';
import type { Person } from '@/features/auth/identity';
import type { GameType, Match, GameTally } from './types';

type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

const COLUMNS = 'id, game_type, state, started_by, current_turn, winner, created_at, closed_at';

/** La partita aperta di quel gioco, se esiste. */
export async function fetchActiveMatch(gameType: GameType, client?: Client): Promise<Match | null> {
  const { data, error } = await db(client)
    .from('game_matches')
    .select(COLUMNS)
    .eq('game_type', gameType)
    .is('closed_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Match | null;
}

/** Vittorie/pareggi di quel gioco, contati sulle partite chiuse — nessuna tabella di riepilogo da tenere sincronizzata. */
export async function fetchHistoryTally(gameType: GameType, client?: Client): Promise<GameTally> {
  const { data, error } = await db(client)
    .from('game_matches')
    .select('winner')
    .eq('game_type', gameType)
    .not('closed_at', 'is', null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ winner: Person | null }>;
  return {
    fabrizio: rows.filter((r) => r.winner === 'fabrizio').length,
    emily: rows.filter((r) => r.winner === 'emily').length,
    draws: rows.filter((r) => r.winner === null).length,
  };
}

export async function createMatch(
  gameType: GameType,
  person: Person,
  initialState: unknown,
  client?: Client,
) {
  return call<Match>(
    db(client)
      .rpc('create_match', { p_game_type: gameType, p_person: person, p_initial_state: initialState as Json })
      .single(),
  );
}

export async function makeMove(
  matchId: string,
  person: Person,
  state: unknown,
  result: 'win' | 'draw' | null,
  winner: Person | null,
  client?: Client,
) {
  // p_result/p_winner sono parametri opzionali con default nel database: i
  // tipi generati li tipano come `?` (assente o valore valido), non
  // nullable — stessa lezione di F5, `null` esplicito viola il tipo.
  return call<Match>(
    db(client)
      .rpc('make_move', {
        p_match_id: matchId,
        p_person: person,
        p_state: state as Json,
        p_result: result ?? undefined,
        p_winner: winner ?? undefined,
      })
      .single(),
  );
}
