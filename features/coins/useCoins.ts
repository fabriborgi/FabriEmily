'use client';

import { getSupabase } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';

/** Saldo monete condiviso, live: cambia anche quando è l'altro a guadagnare. */
export function useCoins(): number | null {
  const { data } = useRealtimeQuery<number>({
    tables: ['couple_state'],
    fetcher: async () => {
      const { data, error } = await getSupabase()
        .from('couple_state')
        .select('coins')
        .eq('id', 1)
        .single();
      if (error) throw new Error(error.message);
      return data.coins;
    },
  });
  return data;
}
