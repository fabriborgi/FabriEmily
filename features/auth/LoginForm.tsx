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

/**
 * signInWithPassword non traduce codici applicativi come toUserMessage fa per
 * le funzioni Postgres: un rifiuto delle credenziali arriva come un errore
 * generico ("Invalid login credentials"), che toUserMessage non riconosce e
 * tradurrebbe con il messaggio generico "Something went wrong...". Qui l'unica
 * distinzione che conta è "è un problema di rete?" — se sì, il messaggio di
 * rete; altrimenti (comprese le vere credenziali sbagliate) il messaggio
 * specifico della password, perché su questo form è l'unica spiegazione
 * plausibile per chi lo legge.
 *
 * Verificato con un client supabase-js reale (fetch che lancia e host
 * irraggiungibile con fetch nativo): signInWithPassword non rilancia mai per
 * un fallimento di rete, lo risolve come { error }. Gestiamo comunque anche
 * il caso in cui lanciasse, perché costa poco e non dipende da un dettaglio
 * implementativo della libreria che potrebbe cambiare.
 */
function describeAuthError(error: unknown): string {
  return toUserMessage(error) === NETWORK_MESSAGE ? NETWORK_MESSAGE : WRONG_PASSWORD_MESSAGE;
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
