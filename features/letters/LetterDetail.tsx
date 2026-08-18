'use client';

import { useEffect, useRef } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { markRead, type Letter } from './queries';
import { isUnread } from './grouping';
import { longDate } from './dates';
import { DrawingReplay } from './DrawingReplay';
import styles from './letters.module.css';

export function LetterDetail({ letter, who }: { letter: Letter; who: Person }) {
  const marked = useRef(false);

  useEffect(() => {
    // Una volta sola per montaggio: la funzione SQL è idempotente, ma non serve insistere.
    if (marked.current || !isUnread(letter, who)) return;
    marked.current = true;
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
