'use client';

import { useEffect, useRef } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { markRead, type Letter } from './queries';
import { isUnread } from './grouping';
import { longDate } from './dates';
import { DrawingReplay } from './DrawingReplay';
import styles from './letters.module.css';

export function LetterDetail({ letter, who }: { letter: Letter; who: Person }) {
  // Memorizza l'id della lettera già marcata, non un booleano: un booleano resterebbe
  // vero per tutta la vita dell'istanza del componente, e se Next riusasse la stessa
  // istanza per due lettere diverse (navigazione fra segmenti che rendono lo stesso
  // componente nella stessa posizione, es. un futuro "lettera successiva") la seconda
  // lettera non verrebbe mai segnata come letta.
  const markedId = useRef<string | null>(null);

  useEffect(() => {
    // Una volta sola per lettera: la funzione SQL è idempotente, ma non serve insistere.
    if (markedId.current === letter.id || !isUnread(letter, who)) return;
    markedId.current = letter.id;
    void markRead(letter.id, who);
  }, [letter, who]);

  const mine = letter.author === who;

  return (
    <article className={styles.detail}>
      <header>
        <p className={styles.author}>{mine ? 'You' : displayName(letter.author)}</p>
        <p className={styles.detailMeta}>{longDate(letter.created_at)}</p>
      </header>

      {letter.kind === 'drawing' && letter.strokes ? (
        <DrawingReplay strokes={letter.strokes} />
      ) : (
        <p className={styles.detailBody}>{letter.body}</p>
      )}

      {mine && (
        <p className={styles.detailMeta}>
          {letter.read_at ? `Read on ${longDate(letter.read_at)}` : 'Not read yet'}
        </p>
      )}
    </article>
  );
}
