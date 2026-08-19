import { describe, it, expect } from 'vitest';
import { SKINS, skinFilterFor } from './skins';

describe('catalogo delle skin', () => {
  it('contiene esattamente 8 skin', () => {
    expect(SKINS).toHaveLength(8);
  });

  it('ha chiavi tutte diverse', () => {
    expect(new Set(SKINS.map((s) => s.key)).size).toBe(SKINS.length);
  });

  it('ogni skin ha un filtro CSS e uno swatch non vuoti', () => {
    for (const skin of SKINS) {
      expect(skin.filter.trim().length).toBeGreaterThan(0);
      expect(skin.swatch.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('skinFilterFor', () => {
  it('ritorna il filtro della skin attiva', () => {
    expect(skinFilterFor('skin_gold')).toBe(SKINS[0].filter);
  });

  it('ritorna undefined per null/undefined/chiave sconosciuta', () => {
    expect(skinFilterFor(null)).toBeUndefined();
    expect(skinFilterFor(undefined)).toBeUndefined();
    expect(skinFilterFor('nope')).toBeUndefined();
  });
});
