import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuestionsPage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

const useActiveRound = vi.fn();
vi.mock('@/features/questions/useActiveRound', () => ({
  useActiveRound: () => useActiveRound(),
}));

const baseState = { loading: false, error: null, offline: false, refetch: vi.fn() };

describe('QuestionsPage', () => {
  beforeEach(() => useActiveRound.mockReset());

  it('senza round attivo, mostra la scelta della categoria', () => {
    useActiveRound.mockReturnValue({ ...baseState, data: { current: null, answers: [] } });
    render(<QuestionsPage />);
    expect(screen.getByRole('button', { name: 'Surprise me' })).toBeDefined();
  });

  it('round aperto: mostra la domanda, non la scelta della categoria', () => {
    useActiveRound.mockReturnValue({
      ...baseState,
      data: {
        current: {
          round: {
            id: 'r1', question_id: 'q1', drawn_by: 'fabrizio', drawn_at: '2026-08-18T10:00:00Z',
            closed_at: null, closed_reason: null, closed_by: null,
          },
          question: { id: 'q1', category: 'fun', body: 'una domanda' },
        },
        answers: [],
      },
    });
    render(<QuestionsPage />);
    expect(screen.getByText('una domanda')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Surprise me' })).toBeNull();
  });

  it('round chiuso come answered: mostra le risposte E la scelta di una nuova categoria', () => {
    useActiveRound.mockReturnValue({
      ...baseState,
      data: {
        current: {
          round: {
            id: 'r1', question_id: 'q1', drawn_by: 'fabrizio', drawn_at: '2026-08-18T10:00:00Z',
            closed_at: '2026-08-18T11:00:00Z', closed_reason: 'answered', closed_by: null,
          },
          question: { id: 'q1', category: 'fun', body: 'una domanda' },
        },
        answers: [
          { round_id: 'r1', author: 'fabrizio', body: 'una', answered_at: '2026-08-18T10:30:00Z' },
          { round_id: 'r1', author: 'emily', body: 'due', answered_at: '2026-08-18T11:00:00Z' },
        ],
      },
    });
    render(<QuestionsPage />);
    expect(screen.getByText('una')).toBeDefined();
    expect(screen.getByText('due')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Surprise me' })).toBeDefined();
  });

  it('round chiuso come skipped: si comporta come "nessun round"', () => {
    useActiveRound.mockReturnValue({
      ...baseState,
      data: {
        current: {
          round: {
            id: 'r1', question_id: 'q1', drawn_by: 'fabrizio', drawn_at: '2026-08-18T10:00:00Z',
            closed_at: '2026-08-18T11:00:00Z', closed_reason: 'skipped', closed_by: 'emily',
          },
          question: { id: 'q1', category: 'fun', body: 'una domanda skippata' },
        },
        answers: [],
      },
    });
    render(<QuestionsPage />);
    expect(screen.getByRole('button', { name: 'Surprise me' })).toBeDefined();
    expect(screen.queryByText('una domanda skippata')).toBeNull();
  });
});
