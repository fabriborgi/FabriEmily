import Link from 'next/link';
import { displayName, type Person } from '@/features/auth/identity';
import { isUnread } from './grouping';
import { shortDate } from './dates';
import { DrawingThumbnail } from './DrawingThumbnail';
import type { Letter } from './queries';
import styles from './letters.module.css';

const EXCERPT_LENGTH = 140;

const excerpt = (body: string) =>
  body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…` : body;

export function LetterCard({ letter, who }: { letter: Letter; who: Person }) {
  const author = displayName(letter.author);

  return (
    <Link href={`/letters/${letter.id}`} className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.author}>{author}</span>
        <span className={styles.date}>{shortDate(letter.created_at)}</span>
        {isUnread(letter, who) && <span className={styles.dot} aria-label="Unread" />}
      </div>

      {letter.kind === 'drawing' && letter.strokes ? (
        <DrawingThumbnail strokes={letter.strokes} size={96} label={`Drawing from ${author}`} />
      ) : (
        <p className={styles.excerpt} data-testid="excerpt">
          {excerpt(letter.body ?? '')}
        </p>
      )}
    </Link>
  );
}
