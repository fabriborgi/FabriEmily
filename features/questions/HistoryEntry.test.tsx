import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoryEntry } from './HistoryEntry';
import type { ClosedRound } from './queries';

const entry = (): ClosedRound => ({
  round: {
    id: 'r1', question_id: 'q1', drawn_by: 'fabrizio', drawn_at: '2026-08-10T10:00:00Z',
    closed_at: '2026-08-10T15:00:00Z', closed_reason: 'answered', closed_by: null,
  },
  question: { id: 'q1', category: 'about_us', body: 'When do you feel most loved by me?' },
  answers: [
    { round_id: 'r1', author: 'fabrizio', body: 'quando cucini per me', answered_at: '2026-08-10T11:00:00Z' },
    { round_id: 'r1', author: 'emily', body: 'quando mi ascolti', answered_at: '2026-08-10T15:00:00Z' },
  ],
});

describe('HistoryEntry', () => {
  it('mostra la categoria e la domanda', () => {
    render(<HistoryEntry round={entry()} who="fabrizio" />);
    expect(screen.getByText('About us')).toBeDefined();
    expect(screen.getByText('When do you feel most loved by me?')).toBeDefined();
  });

  it('etichetta la propria risposta come "You" e quella del partner col nome', () => {
    render(<HistoryEntry round={entry()} who="fabrizio" />);
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('quando cucini per me')).toBeDefined();
    expect(screen.getByText('Emily')).toBeDefined();
    expect(screen.getByText('quando mi ascolti')).toBeDefined();
  });

  it('mostra la data di chiusura', () => {
    render(<HistoryEntry round={entry()} who="fabrizio" />);
    expect(screen.getByText(/Aug 10, 2026/)).toBeDefined();
  });
});
