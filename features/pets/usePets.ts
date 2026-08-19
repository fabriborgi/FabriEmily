'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchPetsState, type PetsState } from './queries';

export function usePets(options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<PetsState>({
    // item_prices non è osservata: è seme statico, come già per Shop (F6).
    // owned_items invece sì (F4.2): un acquisto di skin scrive lì, non in
    // pets, e deve comunque innescare un refetch che mostri il nuovo
    // colore disponibile nel picker.
    tables: ['pets', 'owned_items'],
    client: options.client,
    fetcher: () => fetchPetsState(options.client),
  });
}
