import Link from 'next/link';
import { displayName, type Person } from '@/features/auth/identity';
import { unreadFor } from '@/features/letters/grouping';
import type { Letter } from '@/features/letters/queries';
import styles from './home.module.css';

export function UnreadCard({ letters, who }: { letters: Letter[]; who: Person }) {
  const unread = unreadFor(letters, who);
  if (unread.length === 0) return null;

  const first = unread[0];
  const author = displayName(first.author);
  const headline =
    first.kind === 'drawing' ? `${author} sent you a drawing` : `${author} wrote you`;

  return (
    <Link href={`/letters/${first.id}`} className={styles.unread}>
      <span className={styles.unreadHeadline}>{headline}</span>
      {unread.length > 1 && (
        <span className={styles.unreadCount}>{unread.length} unread waiting</span>
      )}
    </Link>
  );
}
