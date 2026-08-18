'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { sendText } from '@/features/letters/queries';
import styles from '@/features/letters/letters.module.css';

// Deve restare allineato a coin_rules.min_units per 'letter_written': questa
// costante è duplicata dal valore che vive nel database e serve qui solo per
// la copy dell'interfaccia. Se la regola cambia nel database, va cambiata anche qui.
const REWARD_MIN_CHARS = 40;
const REWARD_COINS = 15;

export default function NewLetterPage() {
  const { who } = useIdentity();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Guardia SINCRONA contro il doppio invio. Il `disabled` del pulsante non
  // basta: dipende da un re-render, e fra due tocchi molto ravvicinati React
  // puo' non averlo ancora eseguito. Senza questa riga un doppio tocco manda
  // due lettere identiche, e nell'app non esiste modo di cancellarne una.
  const sending = useRef(false);

  const trimmed = body.trim();
  const missing = REWARD_MIN_CHARS - trimmed.length;

  async function send() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await sendText(who, body);
    setBusy(false);
    if (failure) {
      // Il testo resta nel campo: una lettera lunga non si perde per una tacca
      // di segnale. E si torna disponibili, cosi' si puo' riprovare.
      sending.current = false;
      return setError(failure);
    }
    // Svuotato prima di navigare: tornando indietro col gesto del browser,
    // Next puo' riusare questa istanza del componente, e ritrovarsi il testo
    // gia' spedito nel campo invita a rimandarlo per sbaglio.
    setBody('');
    router.push('/letters');
  }

  return (
    <div className={styles.composer}>
      <textarea
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tell them about your day…"
        aria-label="Your letter"
        autoFocus
      />
      <p className={styles.counter}>
        {missing > 0
          ? `${missing} more character${missing === 1 ? '' : 's'} to earn coins`
          : `This one is worth ${REWARD_COINS} coins`}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className={styles.send}
        onClick={send}
        disabled={busy || trimmed.length === 0}
      >
        {busy ? 'Sending…' : 'Send it'}
      </button>
    </div>
  );
}
