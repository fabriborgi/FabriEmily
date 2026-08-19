import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PetCard } from './PetCard';
import type { Species } from './species';
import type { Pet } from './care';

const unlockPet = vi.fn();
vi.mock('./queries', () => ({ unlockPet: (...a: unknown[]) => unlockPet(...a) }));

const dog: Species = {
  key: 'pet_dog', kind: 'animal', name: 'Dog', emoji: '🐶', curiosity: 'x',
  decayPerHour: { hunger: 5, cleanliness: 4.5, affection: 7.5 },
};

describe('PetCard', () => {
  beforeEach(() => {
    unlockPet.mockReset();
    unlockPet.mockResolvedValue({ data: null, error: null });
  });

  it('bloccata: mostra il costo e il pulsante Unlock', () => {
    render(<PetCard species={dog} pet={undefined} cost={35} who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'Unlock for 35 coins' })).toBeDefined();
  });

  it('bloccata: linka comunque al dettaglio (curiosità visibile prima di comprare)', () => {
    render(<PetCard species={dog} pet={undefined} cost={35} who="fabrizio" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pets/pet_dog');
  });

  it('sbloccando, chiama unlockPet con le statistiche iniziali', async () => {
    render(<PetCard species={dog} pet={undefined} cost={35} who="emily" />);
    screen.getByRole('button', { name: 'Unlock for 35 coins' }).click();
    await waitFor(() => expect(unlockPet).toHaveBeenCalled());
    const [actor, key, kind, stats] = unlockPet.mock.calls[0];
    expect(actor).toBe('emily');
    expect(key).toBe('pet_dog');
    expect(kind).toBe('animal');
    expect(stats).toEqual({ hunger: 100, cleanliness: 100, affection: 100 });
  });

  it('sbloccata: mostra il nickname e linka al dettaglio', () => {
    const pet: Pet = {
      species_key: 'pet_dog', kind: 'animal', nickname: 'Rex',
      stats: { hunger: 100, cleanliness: 100, affection: 100 },
      // Data nel passato remoto, non futura: vedi il commento sulla stessa
      // scelta nel caso "badge" più sotto — projectStats usa l'orologio
      // reale via useNow().
      updated_at: '2020-08-23T10:00:00Z', unlocked_at: '2020-08-23T10:00:00Z',
    };
    render(<PetCard species={dog} pet={pet} cost={35} who="fabrizio" />);
    expect(screen.getByText('Rex')).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pets/pet_dog');
  });

  it('sbloccata e bisognosa di attenzioni: mostra il badge', () => {
    const pet: Pet = {
      species_key: 'pet_dog', kind: 'animal', nickname: null,
      stats: { hunger: 10, cleanliness: 100, affection: 100 },
      // Data nel passato remoto (non "oggi ± pochi giorni"): il decadimento
      // usa l'orologio reale via useNow(), quindi la fixture deve restare
      // valida indipendentemente da quando viene eseguito il test.
      updated_at: '2020-08-23T10:00:00Z', unlocked_at: '2020-08-23T10:00:00Z',
    };
    render(<PetCard species={dog} pet={pet} cost={35} who="fabrizio" />);
    expect(screen.getByText('Needs attention')).toBeDefined();
  });
});
