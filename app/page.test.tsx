import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

const useLetters = vi.fn();
vi.mock('@/features/letters/useLetters', () => ({ useLetters: () => useLetters() }));

const usePets = vi.fn();
vi.mock('@/features/pets/usePets', () => ({ usePets: () => usePets() }));

describe('HomePage', () => {
  it('saluta la persona attiva e mostra la card degli animali', () => {
    useLetters.mockReturnValue({ data: [], offline: false });
    usePets.mockReturnValue({ data: { prices: {}, pets: [] } });
    render(<HomePage />);
    expect(screen.getByText('Hi Fabrizio')).toBeDefined();
    expect(screen.getByText(/Unlock your first animal or plant/)).toBeDefined();
  });

  it('mostra ancora lo slot dei giochi in corso, con il nome del partner', () => {
    useLetters.mockReturnValue({ data: [], offline: false });
    usePets.mockReturnValue({ data: { prices: {}, pets: [] } });
    render(<HomePage />);
    expect(screen.getByText(/against Emily/)).toBeDefined();
  });
});
