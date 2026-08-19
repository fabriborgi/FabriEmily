import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoosePage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

vi.mock('@/features/games/useActiveMatch', () => ({
  useActiveMatch: () => ({ data: null, loading: false, error: null, offline: false, refetch: vi.fn() }),
}));
vi.mock('@/features/games/useGameHistory', () => ({
  useGameHistory: () => ({
    data: { fabrizio: 0, emily: 0, draws: 0 },
    loading: false,
    error: null,
    offline: false,
    refetch: vi.fn(),
  }),
}));

describe('GoosePage', () => {
  it('renderizza la schermata del Gioco dell\'oca', () => {
    render(<GoosePage />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
