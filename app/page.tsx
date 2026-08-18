'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { useLetters } from '@/features/letters/useLetters';
import { UnreadCard } from '@/features/home/UnreadCard';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import { displayName } from '@/features/auth/identity';
import styles from '@/features/home/home.module.css';

export default function HomePage() {
  const { who, partner } = useIdentity();
  const { data, offline } = useLetters();

  return (
    <>
      {offline && <OfflineStrip />}
      <h1 className={styles.greeting}>Hi {displayName(who)}</h1>

      <UnreadCard letters={data ?? []} who={who} />

      {/* Segnaposto: F2 e F4 riempiono uno spazio già impaginato invece di ridisegnare la Home. */}
      <div className={styles.slot}>
        <p className={styles.slotTitle}>Your animals</p>
        <p className={styles.slotBody}>Coming soon — they&rsquo;ll ask for food right here.</p>
      </div>
      <div className={styles.slot}>
        <p className={styles.slotTitle}>Games in progress</p>
        <p className={styles.slotBody}>
          Coming soon — you&rsquo;ll see when it&rsquo;s your turn against {displayName(partner)}.
        </p>
      </div>
    </>
  );
}
