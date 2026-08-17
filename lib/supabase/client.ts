import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/lib/types';

let client: SupabaseClient<Database> | null = null;

/**
 * Un solo client per tutta l'app: apre una sola connessione Realtime e condivide
 * la sessione. `persistSession` in localStorage è ciò che rende il login
 * una cosa da fare una volta per telefono.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}

export const coupleEmail = () =>
  requireEnv('NEXT_PUBLIC_COUPLE_EMAIL', process.env.NEXT_PUBLIC_COUPLE_EMAIL);
