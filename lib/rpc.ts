/**
 * Confine fra gli errori del database e ciò che legge una persona.
 * Le eccezioni delle funzioni Postgres arrivano come messaggi che contengono
 * il codice che abbiamo scelto noi; tutto il resto diventa un messaggio generico,
 * perché il testo grezzo di Postgres non va mai mostrato.
 */
const MESSAGES: Array<[string, string]> = [
  ['insufficient_funds', "You don't have enough coins for that yet."],
  ['invalid_strokes', "That drawing couldn't be saved. Try drawing it again."],
  ['empty_letter', 'Write something first.'],
  ['unknown_item', "That item doesn't exist anymore."],
  ['unknown_coin_reason', 'Something went wrong. Please try again.'],
];

const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = 'No connection. Your work is still here — try again.';

/**
 * È un confine: qualunque cosa riceva, anche un oggetto malformato costruito
 * a mano altrove, deve restituire una stringa o null, mai lanciare. È esportata
 * e può essere invocata da sola, fuori dal try/catch di call(), quindi non può
 * contare su nessuno che la protegga da input inattesi.
 */
export function toUserMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  const message = typeof error === 'object' ? (error as { message?: unknown }).message : undefined;
  // Un message assente o non stringa (numero, null, ...) non è un codice noto:
  // ricade nel messaggio generico invece di far esplodere la .includes() sotto.
  if (typeof message !== 'string') return GENERIC;
  const found = MESSAGES.find(([code]) => message.includes(code));
  return found ? found[1] : GENERIC;
}

type SupabaseResult<T> = { data: T | null; error: { message: string } | null };

/** Avvolge una chiamata Supabase: nessun throw, e l'errore è già leggibile. */
export async function call<T>(
  promise: PromiseLike<SupabaseResult<T>>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await promise;
    if (error) return { data: null, error: toUserMessage(error) };
    return { data, error: null };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : '';
    // Su iOS ogni browser è WebKit, e WebKit non dice "fetch" né "network" quando
    // la rete cade: dice "Load failed". Senza "load failed" (e "connection") il
    // messaggio rassicurante di OFFLINE non comparirebbe mai su telefono.
    const networkKeyword = /fetch|network|offline|load failed|connection/i.test(message);
    // navigator può non esistere (il modulo è valutabile anche fuori dal browser),
    // quindi l'accesso va protetto. onLine === false è un segnale diretto e
    // affidabile in negativo, ma non sostituisce il controllo sul messaggio:
    // può restituire true anche quando la rete c'è ma non porta da nessuna parte
    // (per esempio dietro un captive portal), quindi resta solo un segnale in più.
    const declaredOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { data: null, error: networkKeyword || declaredOffline ? OFFLINE : GENERIC };
  }
}
