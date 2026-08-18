'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchHistoryTally } from './queries';
import type { GameType, GameTally } from './types';

export function useGameHistory(gameType: GameType, options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<GameTally>({
    tables: ['game_matches'],
    client: options.client,
    fetcher: () => fetchHistoryTally(gameType, options.client),
  });
}
