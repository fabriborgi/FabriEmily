import styles from '@/app/shell.module.css';

export function OfflineStrip() {
  return (
    <p className={styles.offline} role="status">
      You&rsquo;re offline — showing what we already had.
    </p>
  );
}
