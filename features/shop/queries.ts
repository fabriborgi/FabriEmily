import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database } from '@/lib/types';
import type { Person } from '@/features/auth/identity';

export type ShopState = {
  /** Chiave item_prices → costo. Solo le chiavi che iniziano con "theme_". */
  prices: Record<string, number>;
  /** Chiavi possedute dalla coppia. */
  owned: string[];
  /** couple_state.theme corrente. */
  activeTheme: string;
};

type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

export async function fetchShopState(client?: Client): Promise<ShopState> {
  const c = db(client);

  const { data: prices, error: pricesError } = await c
    .from('item_prices')
    .select('key, cost')
    .like('key', 'theme_%');
  if (pricesError) throw new Error(pricesError.message);

  const { data: owned, error: ownedError } = await c.from('owned_items').select('key');
  if (ownedError) throw new Error(ownedError.message);

  const { data: state, error: stateError } = await c
    .from('couple_state')
    .select('theme')
    .eq('id', 1)
    .single();
  if (stateError) throw new Error(stateError.message);

  return {
    prices: Object.fromEntries((prices ?? []).map((p) => [p.key, p.cost])),
    owned: (owned ?? []).map((o) => o.key),
    activeTheme: state.theme,
  };
}

export async function purchaseItem(person: Person, key: string, client?: Client) {
  return call(db(client).rpc('purchase_item', { p_actor: person, p_item_key: key }));
}

export async function activateTheme(key: string, client?: Client) {
  return call(db(client).rpc('select_theme', { p_theme_key: key }));
}
