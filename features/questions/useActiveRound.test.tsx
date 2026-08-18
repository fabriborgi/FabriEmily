import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useActiveRound } from './useActiveRound';
import type { CurrentRound, Round } from './queries';

vi.mock('./queries', () => ({
  fetchCurrentRound: vi.fn(),
  fetchAnswers: vi.fn(),
}));

import { fetchCurrentRound, fetchAnswers } from './queries';

const round = (over: Partial<Round> = {}): CurrentRound => ({
  round: {
    id: 'r1',
    question_id: 'q1',
    drawn_by: 'fabrizio',
    drawn_at: '2026-08-18T10:00:00Z',
    closed_at: null,
    closed_reason: null,
    closed_by: null,
    ...over,
  },
  question: { id: 'q1', category: 'fun', body: 'domanda' },
});

/** Client Realtime finto: sufficiente per soddisfare useRealtimeQuery. */
function fakeClient() {
  const channel = {
    on: () => channel,
    subscribe: (cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return channel;
    },
  };
  return { channel: () => channel, removeChannel: () => {} };
}

describe('useActiveRound', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentRound).mockReset();
    vi.mocked(fetchAnswers).mockReset();
  });

  it('senza round attivo, non prova a caricare le risposte', async () => {
    vi.mocked(fetchCurrentRound).mockResolvedValue(null);
    // fakeClient() va chiamato UNA volta, fuori dal render: passarne uno
    // fresco a ogni render (identità diversa ogni volta) rientra nelle
    // dipendenze dell'effetto di useRealtimeQuery e innesca un loop infinito
    // di risottoscrizioni — bug trovato eseguendo proprio questo test.
    const client = fakeClient();
    const { result } = renderHook(() => useActiveRound({ client: client as never }));
    await waitFor(() => expect(result.current.data?.current).toBeNull());
    expect(fetchAnswers).not.toHaveBeenCalled();
  });

  it('round aperto: non carica le risposte, anche se ne esistessero', async () => {
    vi.mocked(fetchCurrentRound).mockResolvedValue(round());
    const client = fakeClient();
    const { result } = renderHook(() => useActiveRound({ client: client as never }));
    // Attende lo stato completamente assestato (loading: false), non il primo
    // istante in cui `current` non è nullo: al montaggio partono due
    // caricamenti quasi in contemporanea (diretto + su SUBSCRIBED, vedi
    // useRealtimeQuery), e fermarsi al primo può catturare un render
    // intermedio prima che il secondo abbia scritto lo stato finale —
    // instabilità trovata eseguendo proprio questo test (1 volta su 8).
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchAnswers).not.toHaveBeenCalled();
    expect(result.current.data?.answers).toEqual([]);
  });

  it('round chiuso come answered: carica le risposte', async () => {
    vi.mocked(fetchCurrentRound).mockResolvedValue(
      round({ closed_at: '2026-08-18T11:00:00Z', closed_reason: 'answered' }),
    );
    vi.mocked(fetchAnswers).mockResolvedValue([
      { round_id: 'r1', author: 'fabrizio', body: 'una', answered_at: '2026-08-18T10:30:00Z' },
      { round_id: 'r1', author: 'emily', body: 'due', answered_at: '2026-08-18T11:00:00Z' },
    ]);
    const client = fakeClient();
    const { result } = renderHook(() => useActiveRound({ client: client as never }));
    await waitFor(() => expect(result.current.data?.answers).toHaveLength(2));
  });

  it('round chiuso come skipped: non carica le risposte', async () => {
    vi.mocked(fetchCurrentRound).mockResolvedValue(
      round({ closed_at: '2026-08-18T11:00:00Z', closed_reason: 'skipped' }),
    );
    const client = fakeClient();
    const { result } = renderHook(() => useActiveRound({ client: client as never }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchAnswers).not.toHaveBeenCalled();
    expect(result.current.data?.answers).toEqual([]);
  });
});
