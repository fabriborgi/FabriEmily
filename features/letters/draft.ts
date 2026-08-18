import { isStrokeArray, type Stroke } from './strokes';

export const DRAFT_KEY = 'fe.draft';

/**
 * Bozza LOCALE, non sul server. Serve a un caso concreto: iOS scarica dalla memoria
 * una PWA in background, e senza questo dieci minuti di disegno svanirebbero.
 */
export function saveDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, strokes: Stroke[]): void {
  if (strokes.length === 0) return storage.removeItem(DRAFT_KEY);
  storage.setItem(DRAFT_KEY, JSON.stringify(strokes));
}

export function loadDraft(storage: Pick<Storage, 'getItem'>): Stroke[] {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStrokeArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDraft(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(DRAFT_KEY);
}
