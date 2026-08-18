'use client';

import { useEffect } from 'react';
import { useActiveTheme } from '@/features/shop/useActiveTheme';

/**
 * Nessun output visivo: applica il tema condiviso all'intera app impostando
 * data-theme sull'elemento <html>. 'default', o il tema non ancora caricato
 * (null, al primo render), non impostano nulla: è già l'aspetto di base
 * definito in :root, nessun blocco [data-theme] serve per rappresentarlo.
 */
export function ThemeApplier() {
  const theme = useActiveTheme();

  useEffect(() => {
    if (theme && theme !== 'default') {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [theme]);

  return null;
}
