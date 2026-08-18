'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { sendDrawing } from '@/features/letters/queries';
import { clearDraft } from '@/features/letters/draft';
import { DrawingCanvas } from '@/features/letters/DrawingCanvas';
import type { Stroke } from '@/features/letters/strokes';

export default function DrawPage() {
  const { who } = useIdentity();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guardia SINCRONA contro il doppio invio. Il `disabled` del pulsante non
  // basta: dipende da un re-render, e fra due tocchi molto ravvicinati React
  // puo' non averlo ancora eseguito. Senza questa riga un doppio tocco manda
  // due disegni identici, e nell'app non esiste modo di cancellarne uno.
  const sending = useRef(false);

  async function send(strokes: Stroke[]) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await sendDrawing(who, strokes);
    setBusy(false);
    // In caso di errore la bozza NON viene cancellata: il disegno resta recuperabile.
    if (failure) {
      sending.current = false;
      return setError(failure);
    }
    clearDraft(window.localStorage);
    router.push('/letters');
  }

  return <DrawingCanvas onSend={send} busy={busy} error={error} />;
}
