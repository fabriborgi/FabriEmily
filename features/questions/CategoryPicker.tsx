'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import { CATEGORIES } from './categories';
import { drawQuestion } from './queries';
import styles from './questions.module.css';

export function CategoryPicker({ who }: { who: Person }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona del composer delle lettere (F0+F1, Task 15): il
  // `disabled` da solo non basta fra due tocchi molto ravvicinati, perché
  // dipende da un re-render che React potrebbe non aver ancora eseguito.
  const drawing = useRef(false);

  async function draw(category: (typeof CATEGORIES)[number]['value'] | null) {
    if (drawing.current) return;
    drawing.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await drawQuestion(who, category);
    setBusy(false);
    drawing.current = false;
    // Non serve altro: la sottoscrizione realtime su question_rounds fa
    // comparire il nuovo round da sola, appena l'insert commit.
    if (failure) setError(failure);
  }

  return (
    <div className={styles.categories}>
      <button
        type="button"
        className={styles.surpriseButton}
        onClick={() => draw(null)}
        disabled={busy}
      >
        Surprise me
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          type="button"
          className={styles.categoryButton}
          onClick={() => draw(c.value)}
          disabled={busy}
        >
          {c.label}
        </button>
      ))}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
