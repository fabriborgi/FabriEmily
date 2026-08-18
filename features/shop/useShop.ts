'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';
import { fetchShopState, type ShopState } from './queries';

export function useShop(options: { client?: SupabaseClient } = {}) {
  return useRealtimeQuery<ShopState>({
    tables: ['item_prices', 'owned_items', 'couple_state'],
    client: options.client,
    fetcher: () => fetchShopState(options.client),
  });
}
