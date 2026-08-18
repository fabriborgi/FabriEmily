'use client';

import { useState, type FormEvent } from 'react';
import { getSupabase, coupleEmail } from '@/lib/supabase/client';
import { toUserMessage } from '@/lib/rpc';
import styles from './auth.module.css';

// Testo esatto restituito da toUserMessage per un fallimento di rete (vedi
// lib/rpc.ts). Confrontato per valore invece di reimplementare qui il
// riconoscimento delle firme di rete: toUserMessage è già il confine
// condiviso, e duplicare quella logica qui creerebbe due posti da tenere
// allineati.
const NETWORK_MESSAGE = 'No connection. Your work is still here — try again.';
const WRONG_PASSWORD_MESSAGE = 'That’s not the password. Try again?';
// Il rate limit fa danno attivo se presentato come password sbagliata: chi lo
// legge ritenta subito, aggravando esattamente il blocco che sta subendo.
const RATE_LIMIT_MESSAGE = 'Too many attempts. Wait a minute, then try again.';
// Tutto ciò che non è né un problema di rete né un rifiuto esplicito delle
// credenziali (rate limit escluso): un guasto lato server, "Email not
// confirmed", o qualunque altra cosa che signInWithPassword non traduce.
// Non deve incolpare la password, perché non è detto che sia quello il problema.
const GENERIC_AUTH_MESSAGE = 'Something went wrong signing in. Please try again in a moment.';

// Testo esatto che signInWithPassword restituisce per un rifiuto delle
// credenziali (verificato con un client supabase-js reale). Riconosciuto in
// modo esplicito — non è più il caso "tutto il resto" del binario precedente,
// che ci faceva chiamare password sbagliata anche un rate limit o un
// "Email not confirmed".
const INVALID_CREDENTIALS_MESSAGE = 'Invalid login credentials';

/** Legge error.message solo se l'oggetto lo espone come stringa, senza mai lanciare. */
function rawMessage(error: unknown): string | null {
  if (error === null || typeof error !== 'object') return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

/** Legge error.status solo se l'oggetto lo espone come numero, senza mai lanciare. */
function rawStatus(error: unknown): number | null {
  if (error === null || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

/**
 * Il rate limit di Supabase arriva con status 429 e un messaggio che contiene
 * "rate limit" (es. "Request rate limit reached"). Va riconosciuto prima del
 * resto perché è il caso in cui il messaggio sbagliato fa danno attivo.
 */
function isRateLimitError(error: unknown): boolean {
  const message = rawMessage(error);
  const isRateLimitMessage = message !== null && message.toLowerCase().includes('rate limit');
  return rawStatus(error) === 429 && isRateLimitMessage;
}

/**
 * signInWithPassword non traduce codici applicativi come toUserMessage fa per
 * le funzioni Postgres: un errore arriva sempre come messaggio grezzo del
 * server ("Invalid login credentials", "Email not confirmed", "Request rate
 * limit reached", ...). Prima si distinguevano solo due esiti — rete o
 * password sbagliata — e qualunque errore non di rete ricadeva su "password
 * sbagliata" per esclusione: un rate limit o un'email non confermata
 * venivano presentati come credenziali sbagliate, spingendo a ritentare
 * invece che, per esempio, aspettare. Qui gli esiti sono quattro, ciascuno
 * riconosciuto in modo esplicito:
 * - problema di rete → messaggio di rete (toUserMessage lo riconosce già);
 * - rate limit → messaggio che invita ad aspettare;
 * - credenziali esplicitamente rifiutate → messaggio della password;
 * - tutto il resto → messaggio generico che non incolpa la password.
 *
 * Verificato con un client supabase-js reale (fetch che lancia e host
 * irraggiungibile con fetch nativo): signInWithPassword non rilancia mai per
 * un fallimento di rete, lo risolve come { error }. Gestiamo comunque anche
 * il caso in cui lanciasse, perché costa poco e non dipende da un dettaglio
 * implementativo della libreria che potrebbe cambiare.
 */
function describeAuthError(error: unknown): string {
  if (toUserMessage(error) === NETWORK_MESSAGE) return NETWORK_MESSAGE;
  if (isRateLimitError(error)) return RATE_LIMIT_MESSAGE;
  if (rawMessage(error) === INVALID_CREDENTIALS_MESSAGE) return WRONG_PASSWORD_MESSAGE;
  return GENERIC_AUTH_MESSAGE;
}

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // Il campo NON viene svuotato in caso di errore: si riprova correggendo.
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email: coupleEmail(),
        password,
      });
      if (authError) {
        setError(describeAuthError(authError));
        return;
      }
      onSuccess();
    } catch (thrown) {
      setError(describeAuthError(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.gate}>
      <h1 className={styles.title}>Fabrizio &amp; Emily</h1>
      <form onSubmit={submit} className={styles.form}>
        <label className={styles.label} htmlFor="password">
          Our password
        </label>
        <input
          id="password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.submit} disabled={busy || password.length === 0}>
          {busy ? 'Opening…' : 'Come in'}
        </button>
      </form>
    </main>
  );
}
