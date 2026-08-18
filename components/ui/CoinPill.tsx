import Link from 'next/link';
import styles from '@/app/shell.module.css';

export function CoinPill({ coins }: { coins: number | null }) {
  const shown = coins === null ? '—' : coins.toLocaleString('en-US');
  const label = coins === null ? 'Open the shop' : `${coins} coins — open the shop`;

  return (
    <Link href="/shop" className={styles.coinPill} aria-label={label}>
      <span aria-hidden>🪙</span>
      <span>{shown}</span>
    </Link>
  );
}
