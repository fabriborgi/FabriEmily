'use client';

import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchLetter, type Letter } from './queries';

export function useLetter(id: string) {
  return useRealtimeQuery<Letter | null>({
    tables: ['letters'],
    fetcher: () => fetchLetter(id),
  });
}
