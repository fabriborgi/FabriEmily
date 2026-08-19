import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

const setCoins = (n: number) => sql('update couple_state set coins = $1 where id = 1', [n]);
const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

type PetRow = {
  species_key: string;
  kind: string;
  nickname: string | null;
  stats: Record<string, number>;
  updated_at: string;
};

const pet = async (key: string): Promise<PetRow | undefined> =>
  (await sql<PetRow>('select * from pets where species_key = $1', [key]))[0];

const unlock = (actor: string, key: string, kind: string, stats: object) =>
  sql('select unlock_pet($1::person, $2, $3::pet_kind, $4::jsonb)', [
    actor,
    key,
    kind,
    JSON.stringify(stats),
  ]);

const care = (actor: string, key: string, stats: object) =>
  sql('select care_for_pet($1::person, $2, $3::jsonb)', [actor, key, JSON.stringify(stats)]);

const rename = (key: string, name: string) => sql('select rename_pet($1, $2)', [key, name]);

beforeEach(resetData);

describe('unlock_pet', () => {
  it('scala le monete e crea la riga con le statistiche iniziali', async () => {
    await setCoins(100);
    await unlock('emily', 'pet_dog', 'animal', { hunger: 100, cleanliness: 100, affection: 100 });
    expect(await coins()).toBe(65); // 100 - 35 (costo pet_dog)
    const row = await pet('pet_dog');
    expect(row?.kind).toBe('animal');
    expect(row?.stats).toEqual({ hunger: 100, cleanliness: 100, affection: 100 });
    expect(row?.nickname).toBeNull();
  });

  it('rifiuta un secondo sblocco della stessa specie', async () => {
    await setCoins(200);
    await unlock('emily', 'pet_dog', 'animal', { hunger: 100, cleanliness: 100, affection: 100 });
    await expect(
      unlock('fabrizio', 'pet_dog', 'animal', { hunger: 100, cleanliness: 100, affection: 100 }),
    ).rejects.toThrow(/already_unlocked/);
    expect(await coins()).toBe(165); // solo il primo sblocco ha pagato
  });

  it('propaga insufficient_funds senza creare la riga', async () => {
    await setCoins(10);
    await expect(
      unlock('emily', 'pet_dog', 'animal', { hunger: 100, cleanliness: 100, affection: 100 }),
    ).rejects.toThrow(/insufficient_funds/);
    expect(await pet('pet_dog')).toBeUndefined();
  });

  it('propaga unknown_item per una chiave non seminata in item_prices', async () => {
    await setCoins(1000);
    await expect(
      unlock('emily', 'pet_does_not_exist', 'animal', { hunger: 100 }),
    ).rejects.toThrow(/unknown_item/);
  });
});

describe('care_for_pet', () => {
  beforeEach(async () => {
    await setCoins(1000);
    await unlock('emily', 'pet_dog', 'animal', { hunger: 40, cleanliness: 100, affection: 100 });
    await unlock('emily', 'plant_fern', 'plant', { water: 40, light: 100 });
  });

  it('aggiorna le statistiche e assegna pet_care_action per un animale', async () => {
    const before = await coins();
    await care('fabrizio', 'pet_dog', { hunger: 80, cleanliness: 100, affection: 100 });
    const row = await pet('pet_dog');
    expect(row?.stats.hunger).toBe(80);
    expect(await coins()).toBe(before + 2); // coin_rules.pet_care_action
  });

  it('assegna plant_watered per una pianta', async () => {
    const before = await coins();
    await care('fabrizio', 'plant_fern', { water: 80, light: 100 });
    expect(await coins()).toBe(before + 3); // coin_rules.plant_watered
  });

  it('rispetta il cap giornaliero già seminato in coin_rules', async () => {
    const before = await coins();
    for (let i = 0; i < 35; i++) {
      await care('fabrizio', 'pet_dog', { hunger: 80, cleanliness: 100, affection: 100 });
    }
    // cap 30/giorno a persona: solo 30 delle 35 chiamate pagano
    expect(await coins()).toBe(before + 30 * 2);
  });

  it('propaga pet_not_found per una specie non sbloccata', async () => {
    await expect(care('fabrizio', 'pet_cat', { hunger: 80 })).rejects.toThrow(/pet_not_found/);
  });
});

describe('rename_pet', () => {
  beforeEach(async () => {
    await setCoins(1000);
    await unlock('emily', 'pet_dog', 'animal', { hunger: 100, cleanliness: 100, affection: 100 });
  });

  it('imposta il nickname', async () => {
    await rename('pet_dog', 'Rex');
    expect((await pet('pet_dog'))?.nickname).toBe('Rex');
  });

  it('rifiuta un nome vuoto', async () => {
    await expect(rename('pet_dog', '   ')).rejects.toThrow(/invalid_pet_name/);
  });

  it('rifiuta un nome oltre 40 caratteri', async () => {
    await expect(rename('pet_dog', 'x'.repeat(41))).rejects.toThrow(/invalid_pet_name/);
  });

  it('propaga pet_not_found per una specie non sbloccata', async () => {
    await expect(rename('pet_cat', 'Whiskers')).rejects.toThrow(/pet_not_found/);
  });
});
