import { describe, it, expect } from 'vitest';
import {
  IDENTITY_KEY,
  readIdentity,
  writeIdentity,
  clearIdentity,
  partnerOf,
  displayName,
} from './identity';

const fakeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    read: () => Object.fromEntries(map),
  };
};

describe('identity', () => {
  it('usa la chiave fe.who', () => {
    expect(IDENTITY_KEY).toBe('fe.who');
  });

  it('non restituisce identità quando non è stata scelta', () => {
    expect(readIdentity(fakeStorage())).toBeNull();
  });

  it('rilegge l’identità appena scritta', () => {
    const storage = fakeStorage();
    writeIdentity(storage, 'emily');
    expect(readIdentity(storage)).toBe('emily');
  });

  it('ignora un valore non valido invece di fidarsi', () => {
    expect(readIdentity(fakeStorage({ [IDENTITY_KEY]: 'gandalf' }))).toBeNull();
  });

  it('dimentica l’identità', () => {
    const storage = fakeStorage({ [IDENTITY_KEY]: 'fabrizio' });
    clearIdentity(storage);
    expect(readIdentity(storage)).toBeNull();
  });

  it('conosce il partner di ciascuno', () => {
    expect(partnerOf('fabrizio')).toBe('emily');
    expect(partnerOf('emily')).toBe('fabrizio');
  });

  it('mostra i nomi con l’iniziale maiuscola', () => {
    expect(displayName('fabrizio')).toBe('Fabrizio');
    expect(displayName('emily')).toBe('Emily');
  });

  // localStorage può lanciare per davvero: Safari in navigazione privata
  // rifiuta setItem con QuotaExceededError, e alcuni ambienti bloccano anche
  // removeItem/getItem. L'identità è una preferenza locale, non un dato
  // critico — se non si salva, l'app la richiederà alla prossima apertura,
  // ma non deve mai impedire l'uso della sessione corrente.
  it('non lancia quando la scrittura fallisce (quota esaurita o navigazione privata)', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => writeIdentity(throwingStorage, 'fabrizio')).not.toThrow();
    expect(() => clearIdentity(throwingStorage)).not.toThrow();
  });

  it('non lancia quando la lettura fallisce, e si comporta come se non ci fosse identità', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => readIdentity(throwingStorage)).not.toThrow();
    expect(readIdentity(throwingStorage)).toBeNull();
  });
});
