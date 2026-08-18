import { describe, it, expect } from 'vitest';
import { rememberAnswered, hasAnsweredLocally } from './answeredLocally';

const fakeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};

describe('answeredLocally', () => {
  it('non ricorda nulla per un round mai risposto', () => {
    expect(hasAnsweredLocally(fakeStorage(), 'round-1')).toBe(false);
  });

  it('ricorda un round dopo averlo segnato', () => {
    const storage = fakeStorage();
    rememberAnswered(storage, 'round-1');
    expect(hasAnsweredLocally(storage, 'round-1')).toBe(true);
  });

  it('non confonde round diversi', () => {
    const storage = fakeStorage();
    rememberAnswered(storage, 'round-1');
    expect(hasAnsweredLocally(storage, 'round-2')).toBe(false);
  });

  it('non lancia se lo storage lancia', () => {
    const throwing = {
      getItem: () => {
        throw new Error('boom');
      },
      setItem: () => {
        throw new Error('boom');
      },
    };
    expect(() => rememberAnswered(throwing, 'round-1')).not.toThrow();
    expect(hasAnsweredLocally(throwing, 'round-1')).toBe(false);
  });
});
