import { describe, it, expect } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
  it('ritorna il valore quando è presente', () => {
    expect(requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost')).toBe('http://localhost');
  });

  it('nomina la variabile mancante nel messaggio di errore', () => {
    expect(() => requireEnv('NEXT_PUBLIC_COUPLE_EMAIL', undefined))
      .toThrow('Missing environment variable: NEXT_PUBLIC_COUPLE_EMAIL');
  });

  it('tratta la stringa vuota come mancante', () => {
    expect(() => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')).toThrow(/Missing/);
  });
});
