const KEY = 'fe.answered-round';

/**
 * Ricorda, sul dispositivo, l'ultimo round a cui questa persona ha già
 * risposto. Le RLS nascondono la risposta finché il round non si chiude,
 * quindi non c'è altro modo per il client di saperlo se non ricordandolo da
 * sé. Se il dato si perde, l'unico effetto è dover riscrivere la risposta,
 * che verrebbe comunque rifiutata come already_answered — la UI si
 * riprenderebbe da lì, non un guasto silenzioso.
 */
export function rememberAnswered(storage: Pick<Storage, 'setItem'>, roundId: string): void {
  try {
    storage.setItem(KEY, roundId);
  } catch {
    // Non critico: vedi commento sopra.
  }
}

export function hasAnsweredLocally(storage: Pick<Storage, 'getItem'>, roundId: string): boolean {
  try {
    return storage.getItem(KEY) === roundId;
  } catch {
    return false;
  }
}
