import { describe, it, expect } from 'vitest';
import { SPECIES } from './species';

describe('catalogo delle specie', () => {
  it('contiene esattamente 47 specie', () => {
    expect(SPECIES).toHaveLength(47);
  });

  it('ha chiavi tutte diverse', () => {
    const keys = SPECIES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('32 animali e 15 piante', () => {
    expect(SPECIES.filter((s) => s.kind === 'animal')).toHaveLength(32);
    expect(SPECIES.filter((s) => s.kind === 'plant')).toHaveLength(15);
  });

  it('gli animali hanno hunger/cleanliness/affection, le piante water/light', () => {
    for (const species of SPECIES) {
      const stats = Object.keys(species.decayPerHour).sort();
      if (species.kind === 'animal') {
        expect(stats).toEqual(['affection', 'cleanliness', 'hunger']);
      } else {
        expect(stats).toEqual(['light', 'water']);
      }
    }
  });

  it('ogni tasso di decadimento è positivo', () => {
    for (const species of SPECIES) {
      for (const rate of Object.values(species.decayPerHour)) {
        expect(rate).toBeGreaterThan(0);
      }
    }
  });

  it('ogni specie ha una curiosità non vuota', () => {
    for (const species of SPECIES) {
      expect(species.curiosity.trim().length).toBeGreaterThan(0);
    }
  });
});
