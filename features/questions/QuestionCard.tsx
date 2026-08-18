'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import { CATEGORY_LABELS } from './categories';
import type { CurrentRound } from './queries';
import { answerQuestion, skipQuestion } from './queries';
import { hasAnsweredLocally, rememberAnswered } from './answeredLocally';
import styles from './questions.module.css';

const ALREADY_ANSWERED_MESSAGE = "You've already answered this one.";

export function QuestionCard({ round, who }: { round: CurrentRound; who: Person }) {
  const [answered, setAnswered] = useState(() =>
    typeof window === 'undefined' ? false : hasAnsweredLocally(window.localStorage, round.round.id),
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  async function submit() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await answerQuestion(round.round.id, who, body);
    setBusy(false);
    sending.current = false;
    if (failure) {
      // "Hai già risposto" non è un fallimento da mostrare: significa che una
      // sottomissione precedente da questo dispositivo è andata a buon fine,
      // e lo stato locale che lo ricordava si è perso (per esempio dopo un
      // ricaricamento della pagina). Si passa all'attesa invece di far
      // sembrare che qualcosa sia andato storto.
      if (failure === ALREADY_ANSWERED_MESSAGE) {
        setAnswered(true);
        return;
      }
      return setError(failure);
    }
    rememberAnswered(window.localStorage, round.round.id);
    setAnswered(true);
  }

  async function skip() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    await skipQuestion(round.round.id, who);
    setBusy(false);
    sending.current = false;
    // Se lo skip è stato un no-op (l'altro aveva già risposto), la
    // sottoscrizione realtime aggiorna comunque lo schermo con lo stato
    // reale: non serve distinguere i due casi qui.
  }

  if (answered) {
    return <p className={styles.waiting}>Waiting for your partner…</p>;
  }

  const categoryLabel = CATEGORY_LABELS[round.question.category];

  return (
    <div className={styles.card}>
      <p className={styles.categoryLabel}>{categoryLabel}</p>
      <p className={styles.questionBody}>{round.question.body}</p>
      <div className={styles.answerForm}>
        <textarea
          className={styles.textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Your answer…"
          aria-label="Your answer"
          autoFocus
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.send}
            onClick={submit}
            disabled={busy || body.trim().length === 0}
          >
            {busy ? 'Sending…' : 'Answer'}
          </button>
          <button type="button" className={styles.skip} onClick={skip} disabled={busy}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
