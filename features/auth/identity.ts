export type Person = 'fabrizio' | 'emily';

export const IDENTITY_KEY = 'fe.who';
export const PEOPLE: readonly Person[] = ['fabrizio', 'emily'];

const isPerson = (value: unknown): value is Person =>
  value === 'fabrizio' || value === 'emily';

/**
 * L'identità è una preferenza locale, non una credenziale: chi ha la password
 * condivisa può presentarsi come entrambi. La validazione qui serve solo a non
 * fidarsi di un localStorage manomesso o rimasto da una versione precedente.
 *
 * localStorage può lanciare per davvero — Safari in navigazione privata
 * rifiuta setItem con QuotaExceededError, e in alcuni ambienti anche
 * getItem/removeItem possono sollevare. Dato che l'identità non è un dato
 * critico (nel peggiore dei casi l'app la richiede di nuovo alla prossima
 * apertura), ogni accesso qui dentro è protetto: deve fallire in silenzio
 * piuttosto che impedire l'uso della sessione corrente.
 */
export function readIdentity(storage: Pick<Storage, 'getItem'>): Person | null {
  try {
    const raw = storage.getItem(IDENTITY_KEY);
    return isPerson(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeIdentity(storage: Pick<Storage, 'setItem'>, who: Person): void {
  try {
    storage.setItem(IDENTITY_KEY, who);
  } catch {
    // Vedi commento sopra: l'identità non si è salvata, l'app la richiederà
    // di nuovo. Non c'è nient'altro di corretto da fare qui.
  }
}

export function clearIdentity(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(IDENTITY_KEY);
  } catch {
    // idem
  }
}

export const partnerOf = (who: Person): Person => (who === 'emily' ? 'fabrizio' : 'emily');

export const displayName = (who: Person): string => (who === 'emily' ? 'Emily' : 'Fabrizio');
