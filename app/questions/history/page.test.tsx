import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuestionsHistoryPage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

const useHistory = vi.fn();
vi.mock('@/features/questions/useHistory', () => ({ useHistory: () => useHistory() }));

const base = { loading: false, error: null, offline: false, refetch: vi.fn() };

describe('QuestionsHistoryPage', () => {
  beforeEach(() => useHistory.mockReset());

  it('senza round risposti, mostra lo stato vuoto', () => {
    useHistory.mockReturnValue({ ...base, data: [] });
    render(<QuestionsHistoryPage />);
    expect(screen.getByText('Nothing here yet')).toBeDefined();
  });

  it('elenca i round risposti', () => {
    useHistory.mockReturnValue({
      ...base,
      data: [
        {
          round: {
            id: 'r1', question_id: 'q1', drawn_by: 'fabrizio', drawn_at: '2026-08-10T10:00:00Z',
            closed_at: '2026-08-10T15:00:00Z', closed_reason: 'answered', closed_by: null,
          },
          question: { id: 'q1', category: 'fun', body: 'una domanda passata' },
          answers: [
            { round_id: 'r1', author: 'fabrizio', body: 'una', answered_at: '2026-08-10T11:00:00Z' },
            { round_id: 'r1', author: 'emily', body: 'due', answered_at: '2026-08-10T15:00:00Z' },
          ],
        },
      ],
    });
    render(<QuestionsHistoryPage />);
    expect(screen.getByText('una domanda passata')).toBeDefined();
  });

  it('porta un collegamento per tornare alla domanda del giorno', () => {
    useHistory.mockReturnValue({ ...base, data: [] });
    render(<QuestionsHistoryPage />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/questions');
  });
});
