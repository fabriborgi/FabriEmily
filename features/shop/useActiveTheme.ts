'use client';

import { getSupabase } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/useRealtimeQuery';

/** Il tema attivo, condiviso dalla coppia e live: cambia anche quando è l'altro ad attivarlo. */
export function useActiveTheme(): string | null {
  const { data } = useRealtimeQuery<string>({
    tables: ['couple_state'],
    fetcher: async () => {
      const { data, error } = await getSupabase()
        .from('couple_state')
        .select('theme')
        .eq('id', 1)
        .single();
      if (error) throw new Error(error.message);
      return data.theme;
    },
  });
  return data;
}
