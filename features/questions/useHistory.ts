'use client';

import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchHistory, type ClosedRound } from './queries';

export function useHistory() {
  return useRealtimeQuery<ClosedRound[]>({
    tables: ['question_rounds', 'question_answers'],
    fetcher: () => fetchHistory(),
  });
}
