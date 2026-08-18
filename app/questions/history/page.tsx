'use client';

import Link from 'next/link';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { useHistory } from '@/features/questions/useHistory';
import { HistoryEntry } from '@/features/questions/HistoryEntry';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/questions/questions.module.css';

export default function QuestionsHistoryPage() {
  const { who } = useIdentity();
  const { data, loading, offline, error } = useHistory();
  const rounds = data ?? [];

  return (
    <>
      {offline && <OfflineStrip />}
      <Link href="/questions" className={styles.historyLink}>
        ← Back to today&rsquo;s question
      </Link>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {loading && rounds.length === 0 && <p className={styles.muted}>Opening the archive…</p>}
      {!loading && !error && rounds.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          body="Answer your first question together to start the archive."
        />
      )}
      <div className={styles.historyList}>
        {rounds.map((r) => (
          <HistoryEntry key={r.round.id} round={r} who={who} />
        ))}
      </div>
    </>
  );
}
