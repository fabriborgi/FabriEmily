'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { displayName } from '@/features/auth/identity';
import { useCoins } from '@/features/coins/useCoins';
import { CoinPill } from '@/components/ui/CoinPill';
import { TabBar } from '@/components/TabBar';
import { ThemeApplier } from '@/components/ThemeApplier';
import styles from '@/app/shell.module.css';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const { who, setWho, partner } = useIdentity();
  const coins = useCoins();

  return (
    <div className={styles.app}>
      <ThemeApplier />
      <header className={styles.header}>
        <button
          className={styles.whoButton}
          onClick={() => setWho(partner)}
          title="Tap if this is the wrong person"
        >
          {displayName(who)}
        </button>
        <CoinPill coins={coins} />
      </header>
      <main className={styles.content}>{children}</main>
      <TabBar />
    </div>
  );
}
