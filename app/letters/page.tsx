'use client';

import Link from 'next/link';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { useLetters } from '@/features/letters/useLetters';
import { groupByMonth } from '@/features/letters/grouping';
import { LetterCard } from '@/features/letters/LetterCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/letters/letters.module.css';

export default function LettersPage() {
  const { who } = useIdentity();
  const { data, loading, offline, error } = useLetters();
  const letters = data ?? [];

  return (
    <>
      {offline && <OfflineStrip />}
      <div className={styles.actions}>
        <Link href="/letters/new" className={styles.primaryAction}>
          Write a letter
        </Link>
        <Link href="/letters/draw" className={styles.secondaryAction}>
          Draw something
        </Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading && letters.length === 0 && <p className={styles.muted}>Opening the archive…</p>}

      {/* Senza il controllo sull'errore, un primo caricamento fallito mostrava
          insieme il banner rosso e "Nothing here yet": due messaggi che si
          contraddicono, e il secondo fa credere che l'archivio sia vuoto quando
          semplicemente non e' stato possibile leggerlo. */}
      {!loading && !error && letters.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          body="Write the first letter, or draw something silly."
        />
      )}

      {groupByMonth(letters).map((group) => (
        <section key={group.label} className={styles.month}>
          <h2 className={styles.monthLabel}>{group.label}</h2>
          <div className={styles.list}>
            {group.letters.map((letter) => (
              <LetterCard key={letter.id} letter={letter} who={who} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
