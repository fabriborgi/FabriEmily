import { isStrokeArray, type Stroke } from './strokes';

export const DRAFT_KEY = 'fe.draft';

/**
 * Bozza LOCALE, non sul server. Serve a un caso concreto: iOS scarica dalla memoria
 * una PWA in background, e senza questo dieci minuti di disegno svanirebbero.
 *
 * localStorage può lanciare per davvero (Safari in navigazione privata, quota
 * esaurita — stesso motivo di features/auth/identity.ts): la bozza non è un dato
 * critico, quindi ogni accesso qui è protetto e fallisce in silenzio piuttosto
 * che impedire l'apertura dell'editor.
 */
export function saveDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, strokes: Stroke[]): void {
  try {
    if (strokes.length === 0) return storage.removeItem(DRAFT_KEY);
    storage.setItem(DRAFT_KEY, JSON.stringify(strokes));
  } catch {
    // Vedi commento sopra: la bozza non si è salvata, al più si perde il disegno in corso.
  }
}

export function loadDraft(storage: Pick<Storage, 'getItem'>): Stroke[] {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isStrokeArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDraft(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // idem
  }
}
