import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PetsPage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

const usePets = vi.fn();
vi.mock('@/features/pets/usePets', () => ({ usePets: () => usePets() }));

describe('PetsPage', () => {
  it('mostra due sotto-sezioni Animals e Plants con tutte le 47 specie', () => {
    usePets.mockReturnValue({ data: { prices: {}, pets: [] }, loading: false, error: null, offline: false, refetch: vi.fn() });
    render(<PetsPage />);
    expect(screen.getByText('Animals')).toBeDefined();
    expect(screen.getByText('Plants')).toBeDefined();
    expect(screen.getAllByTestId(/^pet-card-/)).toHaveLength(47);
  });
});
