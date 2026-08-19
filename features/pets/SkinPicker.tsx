'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import { purchaseItem } from '@/features/shop/queries';
import { selectPetSkin } from './queries';
import { SKINS } from './skins';
import styles from './pets.module.css';

export function SkinPicker({
  speciesKey,
  activeSkin,
  ownedSkins,
  prices,
  who,
}: {
  speciesKey: string;
  activeSkin: string | null;
  ownedSkins: string[];
  prices: Record<string, number>;
  who: Person;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona delle altre azioni della card: il `disabled`
  // da solo non basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function activate(skinKey: string | null) {
    if (sending.current) return;
    sending.current = true;
    setBusyKey(skinKey ?? 'natural');
    setError(null);
    const { error: failure } = await selectPetSkin(speciesKey, skinKey);
    setBusyKey(null);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function buyAndActivate(skinKey: string) {
    if (sending.current) return;
    sending.current = true;
    setBusyKey(skinKey);
    setError(null);
    const { error: purchaseFailure } = await purchaseItem(who, skinKey);
    if (purchaseFailure) {
      setBusyKey(null);
      sending.current = false;
      setError(purchaseFailure);
      return;
    }
    const { error: activateFailure } = await selectPetSkin(speciesKey, skinKey);
    setBusyKey(null);
    sending.current = false;
    if (activateFailure) setError(activateFailure);
  }

  return (
    <div>
      <p className={styles.sectionTitle}>Skins</p>
      <div className={styles.skinGrid}>
        <button
          type="button"
          className={`${styles.skinSwatch} ${activeSkin === null ? styles.skinActive : ''}`}
          onClick={() => activate(null)}
          disabled={busyKey !== null}
        >
          <span className={styles.skinDot} style={{ background: 'var(--fg-muted)' }} aria-hidden />
          Natural
        </button>
        {SKINS.map((skin) => {
          const owned = ownedSkins.includes(skin.key);
          const active = activeSkin === skin.key;
          const cost = prices[skin.key];
          const label =
            owned || cost === undefined ? skin.label : `${skin.label} · ${cost}`;
          return (
            <button
              key={skin.key}
              type="button"
              className={`${styles.skinSwatch} ${active ? styles.skinActive : ''}`}
              onClick={() => (owned ? activate(skin.key) : buyAndActivate(skin.key))}
              disabled={busyKey !== null || (!owned && cost === undefined)}
            >
              <span className={styles.skinDot} style={{ background: skin.swatch }} aria-hidden />
              {busyKey === skin.key ? '…' : label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
