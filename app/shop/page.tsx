'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { useShop } from '@/features/shop/useShop';
import { THEMES, DEFAULT_THEME } from '@/features/shop/themes';
import { ThemeCard } from '@/features/shop/ThemeCard';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/shop/shop.module.css';

export default function ShopPage() {
  const { who } = useIdentity();
  const { data, loading, offline, error } = useShop();

  if (loading && !data) return <p className={styles.muted}>Loading…</p>;

  return (
    <>
      {offline && <OfflineStrip />}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.grid}>
        <ThemeCard
          theme={DEFAULT_THEME}
          cost={undefined}
          owned={true}
          active={data?.activeTheme === 'default'}
          who={who}
        />
        {THEMES.map((theme) => (
          <ThemeCard
            key={theme.key}
            theme={theme}
            cost={data?.prices[theme.key]}
            owned={data?.owned.includes(theme.key) ?? false}
            active={data?.activeTheme === theme.key}
            who={who}
          />
        ))}
      </div>
    </>
  );
}
