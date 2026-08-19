import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const setCoins = (n: number) => sql('update couple_state set coins = $1 where id = 1', [n]);

const unlock = (key: string, kind: string, stats: object) =>
  sql('select unlock_pet($1::person, $2, $3::pet_kind, $4::jsonb)', [
    'emily',
    key,
    kind,
    JSON.stringify(stats),
  ]);

const purchase = (key: string) => sql('select purchase_item($1::person, $2)', ['emily', key]);

const selectSkin = (speciesKey: string, skinKey: string | null) =>
  sql('select select_pet_skin($1, $2)', [speciesKey, skinKey]);

const pet = async (key: string) =>
  (await sql<{ active_skin: string | null }>('select * from pets where species_key = $1', [key]))[0];

beforeEach(async () => {
  await resetData();
  await setCoins(1000);
  await unlock('pet_dog', 'animal', { hunger: 100, cleanliness: 100, affection: 100 });
});

describe('select_pet_skin', () => {
  it('attiva una skin posseduta', async () => {
    await purchase('skin_gold');
    await selectSkin('pet_dog', 'skin_gold');
    expect((await pet('pet_dog')).active_skin).toBe('skin_gold');
  });

  it('rifiuta una skin non posseduta', async () => {
    await expect(selectSkin('pet_dog', 'skin_gold')).rejects.toThrow(/skin_not_owned/);
  });

  it('propaga pet_not_found per una specie non sbloccata', async () => {
    await expect(selectSkin('pet_cat', 'skin_gold')).rejects.toThrow(/pet_not_found/);
  });

  it('torna al colore naturale con null, sempre permesso', async () => {
    await purchase('skin_gold');
    await selectSkin('pet_dog', 'skin_gold');
    await selectSkin('pet_dog', null);
    expect((await pet('pet_dog')).active_skin).toBeNull();
  });

  it('è eseguibile da authenticated ma non da anon', async () => {
    const [row] = await sql<{ can_authenticated: boolean; can_anon: boolean }>(`
      select
        has_function_privilege('authenticated', 'public.select_pet_skin(text, text)', 'EXECUTE') as can_authenticated,
        has_function_privilege('anon', 'public.select_pet_skin(text, text)', 'EXECUTE') as can_anon
    `);
    expect(row.can_authenticated).toBe(true);
    expect(row.can_anon).toBe(false);
  });
});
