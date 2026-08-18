'use client';

import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchLetters, type Letter } from './queries';

export function useLetters() {
  return useRealtimeQuery<Letter[]>({ tables: ['letters'], fetcher: () => fetchLetters() });
}
