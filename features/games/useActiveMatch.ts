'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchActiveMatch } from './queries';
import type { GameType, Match } from './types';

export function useActiveMatch(gameType: GameType, options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<Match | null>({
    tables: ['game_matches'],
    client: options.client,
    fetcher: () => fetchActiveMatch(gameType, options.client),
  });
}
