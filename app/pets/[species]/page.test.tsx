import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PetDetailPage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ species: 'pet_dog' }) }));

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

const usePets = vi.fn();
vi.mock('@/features/pets/usePets', () => ({ usePets: () => usePets() }));

describe('PetDetailPage', () => {
  it('mostra il dettaglio della specie richiesta', () => {
    usePets.mockReturnValue({ data: { prices: { pet_dog: 35 }, pets: [], ownedSkins: [] }, loading: false, error: null, offline: false, refetch: vi.fn() });
    render(<PetDetailPage />);
    expect(screen.getByRole('button', { name: 'Unlock for 35 coins' })).toBeDefined();
  });
});
