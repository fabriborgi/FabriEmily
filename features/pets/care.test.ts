import { describe, it, expect } from 'vitest';
import {
  initialStatsFor, projectStats, applyCareAction, needsAttention,
  CARE_BOOST, NEEDS_ATTENTION_THRESHOLD, type Pet,
} from './care';
import type { Species } from './species';

const dog: Species = {
  key: 'pet_dog', kind: 'animal', name: 'Dog', emoji: '🐶', curiosity: 'x',
  decayPerHour: { hunger: 5, cleanliness: 4.5, affection: 7.5 },
};

const fern: Species = {
  key: 'plant_fern', kind: 'plant', name: 'Fern', emoji: '🌿', curiosity: 'x',
  decayPerHour: { water: 3.33, light: 1.94 },
};

const petAt = (stats: Record<string, number>, updated_at: string): Pet => ({
  species_key: 'pet_dog', kind: 'animal', nickname: null, stats, updated_at, unlocked_at: updated_at,
  active_skin: null,
});

describe('initialStatsFor', () => {
  it('parte da 100 per ogni statistica della specie', () => {
    expect(initialStatsFor(dog)).toEqual({ hunger: 100, cleanliness: 100, affection: 100 });
    expect(initialStatsFor(fern)).toEqual({ water: 100, light: 100 });
  });
});

describe('projectStats', () => {
  it('non cambia nulla a zero tempo trascorso', () => {
    const pet = petAt({ hunger: 80, cleanliness: 80, affection: 80 }, '2026-08-23T10:00:00Z');
    const now = new Date('2026-08-23T10:00:00Z');
    expect(projectStats(pet, dog, now)).toEqual({ hunger: 80, cleanliness: 80, affection: 80 });
  });

  it('fa decadere ogni statistica al proprio tasso dopo 2 ore', () => {
    const pet = petAt({ hunger: 80, cleanliness: 80, affection: 80 }, '2026-08-23T10:00:00Z');
    const now = new Date('2026-08-23T12:00:00Z');
    const result = projectStats(pet, dog, now);
    expect(result.hunger).toBeCloseTo(70, 5); // 80 - 5*2
    expect(result.cleanliness).toBeCloseTo(71, 5); // 80 - 4.5*2
    expect(result.affection).toBeCloseTo(65, 5); // 80 - 7.5*2
  });

  it('non scende mai sotto zero', () => {
    const pet = petAt({ hunger: 5, cleanliness: 5, affection: 5 }, '2026-08-23T10:00:00Z');
    const now = new Date('2026-08-24T10:00:00Z'); // 24h dopo
    const result = projectStats(pet, dog, now);
    expect(result.hunger).toBe(0);
    expect(result.cleanliness).toBe(0);
    expect(result.affection).toBe(0);
  });
});

describe('applyCareAction', () => {
  it(`alza la statistica di ${CARE_BOOST} punti`, () => {
    expect(applyCareAction({ hunger: 40, cleanliness: 80, affection: 80 }, 'hunger')).toEqual({
      hunger: 80, cleanliness: 80, affection: 80,
    });
  });

  it('clampa a 100', () => {
    expect(applyCareAction({ hunger: 90, cleanliness: 80, affection: 80 }, 'hunger').hunger).toBe(100);
  });
});

describe('needsAttention', () => {
  it(`è vero se una statistica è sotto ${NEEDS_ATTENTION_THRESHOLD}`, () => {
    expect(needsAttention({ hunger: 29, cleanliness: 100, affection: 100 })).toBe(true);
  });

  it('è falso se tutte le statistiche sono alla soglia o sopra', () => {
    expect(needsAttention({ hunger: 30, cleanliness: 100, affection: 100 })).toBe(false);
  });
});
