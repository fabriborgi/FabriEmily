import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { call } from '@/lib/rpc';
import type { Database } from '@/lib/types';
import type { Person } from '@/features/auth/identity';
import type { Pet } from './care';
import type { PetKind } from './species';

export type PetsState = {
  /** item_prices per le chiavi pet_ / plant_ / skin_: costo di sblocco. */
  prices: Record<string, number>;
  /** Specie sbloccate dalla coppia, con statistiche e nickname correnti. */
  pets: Pet[];
  /** Chiavi skin_* possedute dalla coppia. */
  ownedSkins: string[];
};

type Client = SupabaseClient<Database>;
const db = (client?: Client): Client => client ?? getSupabase();

export async function fetchPetsState(client?: Client): Promise<PetsState> {
  const c = db(client);

  const { data: prices, error: pricesError } = await c.from('item_prices').select('key, cost');
  if (pricesError) throw new Error(pricesError.message);

  const { data: pets, error: petsError } = await c.from('pets').select('*');
  if (petsError) throw new Error(petsError.message);

  const { data: ownedItems, error: ownedError } = await c
    .from('owned_items')
    .select('key')
    .like('key', 'skin_%');
  if (ownedError) throw new Error(ownedError.message);

  return {
    prices: Object.fromEntries((prices ?? []).map((p) => [p.key, p.cost])),
    pets: (pets ?? []) as Pet[],
    ownedSkins: (ownedItems ?? []).map((o) => o.key),
  };
}

export async function unlockPet(
  actor: Person,
  speciesKey: string,
  kind: PetKind,
  initialStats: Record<string, number>,
  client?: Client,
) {
  return call(
    db(client).rpc('unlock_pet', {
      p_actor: actor,
      p_species_key: speciesKey,
      p_kind: kind,
      p_initial_stats: initialStats,
    }),
  );
}

export async function careForPet(
  actor: Person,
  speciesKey: string,
  stats: Record<string, number>,
  client?: Client,
) {
  return call(
    db(client).rpc('care_for_pet', { p_actor: actor, p_species_key: speciesKey, p_stats: stats }),
  );
}

export async function renamePet(speciesKey: string, name: string, client?: Client) {
  return call(db(client).rpc('rename_pet', { p_species_key: speciesKey, p_name: name }));
}

export async function selectPetSkin(speciesKey: string, skinKey: string | null, client?: Client) {
  return call(
    db(client).rpc('select_pet_skin', { p_species_key: speciesKey, p_skin_key: skinKey }),
  );
}
