import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PetDetail } from './PetDetail';
import type { Species } from './species';
import type { Pet } from './care';

const careForPet = vi.fn();
const renamePet = vi.fn();
const unlockPet = vi.fn();
vi.mock('./queries', () => ({
  careForPet: (...a: unknown[]) => careForPet(...a),
  renamePet: (...a: unknown[]) => renamePet(...a),
  unlockPet: (...a: unknown[]) => unlockPet(...a),
}));

const fern: Species = {
  key: 'plant_fern', kind: 'plant', name: 'Fern', emoji: '🌿', curiosity: 'An old plant family.',
  decayPerHour: { water: 3.33, light: 1.94 },
};

const pet: Pet = {
  species_key: 'plant_fern', kind: 'plant', nickname: null,
  stats: { water: 40, light: 100 },
  updated_at: new Date().toISOString(), unlocked_at: new Date().toISOString(),
  active_skin: null,
};

describe('PetDetail', () => {
  beforeEach(() => {
    careForPet.mockReset();
    renamePet.mockReset();
    unlockPet.mockReset();
    careForPet.mockResolvedValue({ data: null, error: null });
    renamePet.mockResolvedValue({ data: null, error: null });
    unlockPet.mockResolvedValue({ data: null, error: null });
  });

  it('bloccata: mostra la curiosità e il pulsante Unlock', () => {
    render(<PetDetail species={fern} pet={undefined} prices={{ plant_fern: 25 }} ownedSkins={[]} who="fabrizio" />);
    expect(screen.getByText('An old plant family.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unlock for 25 coins' })).toBeDefined();
  });

  it('sbloccata: mostra le statistiche correnti e i pulsanti di cura', () => {
    render(<PetDetail species={fern} pet={pet} prices={{ plant_fern: 25 }} ownedSkins={[]} who="fabrizio" />);
    expect(screen.getByText('40')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Water' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Light' })).toBeDefined();
  });

  it('un tap su Water chiama careForPet con la statistica alzata', async () => {
    render(<PetDetail species={fern} pet={pet} prices={{ plant_fern: 25 }} ownedSkins={[]} who="fabrizio" />);
    screen.getByRole('button', { name: 'Water' }).click();
    await waitFor(() => expect(careForPet).toHaveBeenCalled());
    const [actor, key, stats] = careForPet.mock.calls[0];
    expect(actor).toBe('fabrizio');
    expect(key).toBe('plant_fern');
    // 40 + CARE_BOOST(40) = 80, con una tolleranza minima: projectStats usa
    // l'orologio reale (useNow), quindi qualche decimo di ms di decadimento
    // passano fra la creazione della fixture e l'assert (stesso principio
    // già visto nella fragilità delle date fisse in PetCard.test.tsx).
    expect(stats.water).toBeCloseTo(80, 1);
  });

  it('salvando il nome, chiama renamePet', async () => {
    render(<PetDetail species={fern} pet={pet} prices={{ plant_fern: 25 }} ownedSkins={[]} who="fabrizio" />);
    const input = screen.getByPlaceholderText('Fern') as HTMLInputElement;
    input.focus();
    (input as unknown as { value: string }).value = 'Frondy';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    screen.getByRole('button', { name: 'Save name' }).click();
    await waitFor(() => expect(renamePet).toHaveBeenCalled());
    expect(renamePet.mock.calls[0][0]).toBe('plant_fern');
  });

  it('mostra la sezione Skins con l’opzione Natural per un animale sbloccato', () => {
    render(<PetDetail species={fern} pet={pet} prices={{ plant_fern: 25 }} ownedSkins={[]} who="fabrizio" />);
    expect(screen.getByText('Skins')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Natural' })).toBeDefined();
  });
});
