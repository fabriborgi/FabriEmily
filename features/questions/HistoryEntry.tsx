import { displayName, partnerOf, type Person } from '@/features/auth/identity';
import { CATEGORY_LABELS } from './categories';
import type { ClosedRound } from './queries';
import styles from './questions.module.css';

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function HistoryEntry({ round, who }: { round: ClosedRound; who: Person }) {
  const mine = round.answers.find((a) => a.author === who);
  const theirs = round.answers.find((a) => a.author === partnerOf(who));
  const categoryLabel = CATEGORY_LABELS[round.question.category];

  return (
    <div className={styles.historyEntry}>
      <div className={styles.historyHead}>
        <span className={styles.categoryLabel}>{categoryLabel}</span>
        {round.round.closed_at && (
          <span className={styles.historyDate}>{dateLabel(round.round.closed_at)}</span>
        )}
      </div>
      <p className={styles.historyQuestion}>{round.question.body}</p>
      {mine && (
        <div className={styles.answerBlock}>
          <p className={styles.answerAuthor}>You</p>
          <p className={styles.answerBody}>{mine.body}</p>
        </div>
      )}
      {theirs && (
        <div className={styles.answerBlock}>
          <p className={styles.answerAuthor}>{displayName(theirs.author)}</p>
          <p className={styles.answerBody}>{theirs.body}</p>
        </div>
      )}
    </div>
  );
}
