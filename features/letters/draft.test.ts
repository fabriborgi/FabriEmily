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
    expect(loadDraft(storage)).toEqual([]);
  });
});
