'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import type { ThemeSwatches } from './themes';
import { purchaseItem, activateTheme } from './queries';
import styles from './shop.module.css';

type ThemeDef = { key: string; label: string; swatches: ThemeSwatches };

export function ThemeCard({
  theme,
  cost,
  owned,
  active,
  who,
}: {
  theme: ThemeDef;
  cost: number | undefined;
  owned: boolean;
  active: boolean;
  who: Person;
}) {
  const [busy, setBusy] = useState<'buying' | 'activating' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona di QuestionCard/CategoryPicker (F5): il
  // `disabled` da solo non basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function buy() {
    if (sending.current || cost === undefined) return;
    sending.current = true;
    setBusy('buying');
    setError(null);
    const { error: purchaseFailure } = await purchaseItem(who, theme.key);
    if (purchaseFailure) {
      setBusy(null);
      sending.current = false;
      setError(purchaseFailure);
      return;
    }
    // Comprare applica subito il tema (README): due chiamate, ma un solo tap.
    setBusy('activating');
    const { error: activateFailure } = await activateTheme(theme.key);
    setBusy(null);
    sending.current = false;
    // Se l'attivazione fallisce, il possesso resta comunque registrato: la
    // card si aggiorna via realtime mostrando "Activate", pronta per un
    // secondo tap. Nessuna moneta persa, nessuno stato sporco.
    if (activateFailure) setError(activateFailure);
  }

  async function activate() {
    if (sending.current) return;
    sending.current = true;
    setBusy('activating');
    setError(null);
    const { error: failure } = await activateTheme(theme.key);
    setBusy(null);
    sending.current = false;
    if (failure) setError(failure);
  }

  return (
    <div className={styles.card} data-testid={`theme-card-${theme.key}`}>
      <div className={styles.head}>
        <p className={styles.label}>{theme.label}</p>
        <div className={styles.swatches} aria-hidden>
          <span className={styles.swatch} style={{ background: theme.swatches.bg }} />
          <span className={styles.swatch} style={{ background: theme.swatches.surface }} />
          <span className={styles.swatch} style={{ background: theme.swatches.accent }} />
        </div>
      </div>

      {active && <p className={styles.activeLabel}>Active</p>}

      {!active && owned && (
        <button
          type="button"
          className={styles.action}
          onClick={activate}
          disabled={busy !== null}
        >
          {busy === 'activating' ? 'Activating…' : 'Activate'}
        </button>
      )}

      {!owned && !active && (
        <button
          type="button"
          className={styles.action}
          onClick={buy}
          disabled={busy !== null || cost === undefined}
        >
          {busy === 'buying'
            ? 'Buying…'
            : busy === 'activating'
              ? 'Activating…'
              : cost === undefined
                ? 'Buy'
                : `Buy for ${cost} coins`}
        </button>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
