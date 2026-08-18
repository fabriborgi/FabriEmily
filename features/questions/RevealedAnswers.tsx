import { displayName, partnerOf, type Person } from '@/features/auth/identity';
import type { Answer } from './queries';
import styles from './questions.module.css';

export function RevealedAnswers({ answers, who }: { answers: Answer[]; who: Person }) {
  const mine = answers.find((a) => a.author === who);
  const theirs = answers.find((a) => a.author === partnerOf(who));

  return (
    <div className={styles.revealed}>
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
