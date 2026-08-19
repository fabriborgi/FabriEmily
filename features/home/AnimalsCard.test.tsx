import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimalsCard } from './AnimalsCard';

const usePets = vi.fn();
vi.mock('@/features/pets/usePets', () => ({ usePets: () => usePets() }));

describe('AnimalsCard', () => {
  it('senza specie sbloccate, invita a sbloccarne una', () => {
    usePets.mockReturnValue({ data: { prices: {}, pets: [] } });
    render(<AnimalsCard />);
    expect(screen.getByText(/Unlock your first animal or plant/)).toBeDefined();
  });

  it('con tutte le specie stanno bene, mostra un messaggio positivo', () => {
    usePets.mockReturnValue({
      data: {
        prices: {},
        pets: [
          {
            species_key: 'pet_dog', kind: 'animal', nickname: null,
            stats: { hunger: 100, cleanliness: 100, affection: 100 },
            updated_at: new Date().toISOString(), unlocked_at: new Date().toISOString(),
          },
        ],
      },
    });
    render(<AnimalsCard />);
    expect(screen.getByText('Everyone’s doing well.')).toBeDefined();
  });

  it('con una specie bisognosa di attenzioni, mostra il nome e linka a /pets', () => {
    usePets.mockReturnValue({
      data: {
        prices: {},
        pets: [
          {
            species_key: 'pet_dog', kind: 'animal', nickname: 'Rex',
            stats: { hunger: 10, cleanliness: 100, affection: 100 },
            updated_at: new Date().toISOString(), unlocked_at: new Date().toISOString(),
          },
        ],
      },
    });
    render(<AnimalsCard />);
    expect(screen.getByText('Rex needs attention.')).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pets');
  });
});
