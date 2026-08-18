'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchShopState, type ShopState } from './queries';

export function useShop(options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<ShopState>({
    // item_prices non è fra le tabelle osservate: è seme statico, i prezzi
    // dei temi cambiano solo via migrazione + deploy, mai a runtime, quindi
    // non esiste un evento realtime da ascoltare per quella tabella.
    // owned_items e couple_state bastano da sole a innescare i refetch che
    // contano davvero: un acquisto o un'attivazione.
    tables: ['owned_items', 'couple_state'],
    client: options.client,
    fetcher: () => fetchShopState(options.client),
  });
}
