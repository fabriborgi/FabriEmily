'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { useActiveRound } from '@/features/questions/useActiveRound';
import { CategoryPicker } from '@/features/questions/CategoryPicker';
import { QuestionCard } from '@/features/questions/QuestionCard';
import { RevealedAnswers } from '@/features/questions/RevealedAnswers';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/questions/questions.module.css';

export default function QuestionsPage() {
  const { who } = useIdentity();
  const { data, loading, offline, error } = useActiveRound();
  const current = data?.current ?? null;

  if (loading && !data) return <p className={styles.muted}>Opening…</p>;

  // Un round skippato non ha nulla da mostrare: si comporta come "nessun
  // round", pronto per pescarne uno nuovo.
  const hasContent = current !== null && current.round.closed_reason !== 'skipped';

  return (
    <>
      {offline && <OfflineStrip />}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!hasContent && <CategoryPicker who={who} />}

      {hasContent && current!.round.closed_at === null && (
        <QuestionCard round={current!} who={who} />
      )}

      {hasContent && current!.round.closed_reason === 'answered' && (
        <>
          <RevealedAnswers answers={data?.answers ?? []} who={who} />
          <CategoryPicker who={who} />
        </>
      )}
    </>
  );
}
