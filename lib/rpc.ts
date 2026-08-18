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
  ['round_already_open', "There's already a question waiting for an answer."],
  ['empty_answer', 'Write an answer first.'],
  ['round_already_closed', 'That question was already resolved. Refreshing…'],
  ['already_answered', "You've already answered this one."],
  ['no_questions_available', "There are no questions in that category yet."],
  ['already_owned', 'You already own that.'],
  ['theme_not_owned', "You don't own that theme yet."],
];

const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = 'No connection. Your work is still here — try again.';

// Firme testuali specifiche dei fallimenti di fetch nei browser che contano per
// questo progetto (due telefoni, uno in Italia e uno a Buffalo) più l'ambiente
// Node in cui girano i test. Deliberatamente NON generiche: parole come
// "connection" o "offline" comparirebbero anche in guasti lato server Postgres
// reali (es. "remaining connection slots are reserved...", "terminating
// connection due to administrator command", "SSL connection has been closed
// unexpectedly") che non hanno nulla a che fare col telefono dell'utente.
const NETWORK_SIGNATURES = [
  'failed to fetch', // Chrome e derivati
  'fetch failed', // quello che produce davvero postgrest-js (vedi sotto)
  'networkerror', // Firefox
  'load failed', // WebKit: ogni browser su iPhone dice questo, non "fetch"/"network"
  'network request failed',
  'err_internet_disconnected',
  // WebKit prima di Safari 15.4: iPhone non aggiornati, popolazione residua
  // ma esattamente il tipo di device che resta in giro per anni.
  'the internet connection appears to be offline',
  'network connection was lost',
];

/**
 * Riconosce se un testo di errore è la firma di un fallimento di rete (fetch
 * caduto), non un guasto qualunque che nomini genericamente "connection".
 *
 * Vive qui, condivisa fra i due punti che la usano, perché il comportamento di
 * postgrest-js è controintuitivo: quando throwOnError non è attivo — e call()
 * non lo attiva mai — la libreria intercetta i fallimenti di fetch e li
 * RISOLVE come { data: null, error } invece di farli rigettare. Un client
 * supabase-js reale puntato su un host irraggiungibile non lancia mai: passa
 * dal ramo "error" di toUserMessage, non dal catch di call(). Se il
 * riconoscimento vivesse solo nel catch, sarebbe irraggiungibile per ogni
 * chiamata .rpc() — esattamente il bug di questo rilievo. Chi tocca questo
 * codice fra sei mesi, vedendo solo il catch, rifarebbe lo stesso errore:
 * per questo il controllo sta dentro toUserMessage, dove copre sia l'errore
 * risolto come valore sia quello (più raro) lanciato come eccezione.
 */
function isNetworkFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return NETWORK_SIGNATURES.some((signature) => lower.includes(signature));
}

/**
 * navigator può non esistere (il modulo è valutabile anche fuori dal browser),
 * quindi l'accesso va protetto. onLine === false è un segnale diretto e
 * affidabile in negativo, ma non sostituisce il controllo sul messaggio:
 * può restituire true anche quando la rete c'è ma non porta da nessuna parte
 * (per esempio dietro un captive portal), quindi resta solo un segnale in più.
 */
function isDeclaredOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * È un confine: qualunque cosa riceva, anche un oggetto malformato costruito
 * a mano altrove, deve restituire una stringa o null, mai lanciare. È esportata
 * e può essere invocata da sola, fuori dal try/catch di call(), quindi non può
 * contare su nessuno che la protegga da input inattesi.
 */
export function toUserMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  let message: unknown;
  try {
    message = typeof error === 'object' ? (error as { message?: unknown }).message : undefined;
  } catch {
    // Caso di laboratorio: un getter su "message" che solleva. Nessuna libreria
    // reale lo fa, ma il contratto è "non lancia mai, qualunque input".
    return GENERIC;
  }
  // Un message assente o non stringa (numero, null, ...) non è un codice noto:
  // ricade nel messaggio generico invece di far esplodere la .includes() sotto.
  if (typeof message !== 'string') return GENERIC;
  // I codici noti vengono PRIMA dei segnali di rete, e l'ordine e' sostanziale.
  // Un errore che porta un codice applicativo e' la prova che la richiesta ha
  // fatto andata e ritorno: il server ha risposto. navigator.onLine, letto in
  // quell'istante, puo' dire false per un falso negativo transitorio (il
  // passaggio da WiFi a rete cellulare e' il caso tipico) e coprirebbe
  // "non hai abbastanza monete" con "sei offline, riprova" - un messaggio che
  // manda la persona a fare la cosa sbagliata.
  const found = MESSAGES.find(([code]) => message.includes(code));
  if (found) return found[1];
  if (isNetworkFailureMessage(message) || isDeclaredOffline()) return OFFLINE;
  return GENERIC;
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
    const isOffline = isNetworkFailureMessage(message) || isDeclaredOffline();
    return { data: null, error: isOffline ? OFFLINE : GENERIC };
  }
}
