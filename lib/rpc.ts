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

export function toUserMessage(error: { message: string } | null | undefined): string | null {
  if (!error) return null;
  const found = MESSAGES.find(([code]) => error.message.includes(code));
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
    return { data: null, error: /fetch|network|offline/i.test(message) ? OFFLINE : GENERIC };
  }
}
