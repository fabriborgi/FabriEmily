'use client';

import { PEOPLE, displayName, type Person } from './identity';
import styles from './auth.module.css';

export function IdentityChooser({ onChoose }: { onChoose: (who: Person) => void }) {
  return (
    <main className={styles.gate}>
      <h1 className={styles.title}>Who&rsquo;s holding the phone?</h1>
      <div className={styles.choices}>
        {PEOPLE.map((who) => (
          <button key={who} className={styles.choice} onClick={() => onChoose(who)}>
            I'm {displayName(who)}
          </button>
        ))}
      </div>
    </main>
  );
}
