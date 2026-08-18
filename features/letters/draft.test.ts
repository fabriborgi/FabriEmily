import { describe, it, expect } from 'vitest';
import { DRAFT_KEY, saveDraft, loadDraft, clearDraft } from './draft';
import type { Stroke } from './strokes';

const fakeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

const strokes: Stroke[] = [{ c: 2, w: 1, p: [10, 10, 50, 50] }];

describe('bozza locale del disegno', () => {
  it('usa la chiave fe.draft', () => {
    expect(DRAFT_KEY).toBe('fe.draft');
  });

  it('salva e rilegge i tratti identici', () => {
    const storage = fakeStorage();
    saveDraft(storage, strokes);
    expect(loadDraft(storage)).toEqual(strokes);
  });

  it('senza bozza restituisce una lista vuota', () => {
    expect(loadDraft(fakeStorage())).toEqual([]);
  });

  it('scarta una bozza illeggibile invece di far crashare l’editor', () => {
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: '{{{' }))).toEqual([]);
  });

  it('scarta una bozza dal formato non valido', () => {
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: '[{"c":99,"w":0,"p":[1,1]}]' }))).toEqual([]);
  });

  it('cancella la bozza', () => {
    const storage = fakeStorage();
    saveDraft(storage, strokes);
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual([]);
  });

  it('salvare una tela vuota equivale a cancellare la bozza', () => {
    const storage = fakeStorage();
    saveDraft(storage, strokes);
    saveDraft(storage, []);
    // Verifica diretta sullo storage, non tramite loadDraft: loadDraft restituisce
    // [] anche per altri motivi (bozza assente, illeggibile, formato invalido), quindi
    // da sola non prova che la chiave sia stata rimossa — servirebbe una chiave
    // fantasma scritta per sempre.
    expect(storage.getItem(DRAFT_KEY)).toBeNull();
  });

  // localStorage può lanciare per davvero (Safari in navigazione privata, quota
  // esaurita — stesso motivo di features/auth/identity.ts): la bozza non è un dato
  // critico, quindi ogni funzione deve fallire in silenzio piuttosto che impedire
  // l'apertura dell'editor.
  it('non lancia quando lo storage fallisce (quota esaurita o navigazione privata)', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => saveDraft(throwingStorage, strokes)).not.toThrow();
    expect(() => saveDraft(throwingStorage, [])).not.toThrow();
    expect(() => clearDraft(throwingStorage)).not.toThrow();
    expect(() => loadDraft(throwingStorage)).not.toThrow();
    expect(loadDraft(throwingStorage)).toEqual([]);
  });
});
