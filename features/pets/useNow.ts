'use client';

import { useEffect, useState } from 'react';

/** Orologio che si aggiorna a intervalli, per far ridisegnare le barre statistiche che decadono. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
