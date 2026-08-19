'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchPetsState, type PetsState } from './queries';

export function usePets(options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<PetsState>({
    // item_prices non è osservata: è seme statico, come già per Shop (F6) —
    // i costi cambiano solo via migrazione + deploy.
    tables: ['pets'],
    client: options.client,
    fetcher: () => fetchPetsState(options.client),
  });
}
