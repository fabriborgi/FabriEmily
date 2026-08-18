'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchCurrentRound, fetchAnswers, type CurrentRound, type Answer } from './queries';

export type ActiveRoundState = { current: CurrentRound | null; answers: Answer[] };

export function useActiveRound(options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<ActiveRoundState>({
    tables: ['question_rounds', 'question_answers'],
    client: options.client,
    fetcher: async () => {
      const current = await fetchCurrentRound();
      if (!current || current.round.closed_reason !== 'answered') {
        return { current, answers: [] };
      }
      const answers = await fetchAnswers(current.round.id);
      return { current, answers };
    },
  });
}
