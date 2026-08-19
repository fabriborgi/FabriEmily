import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SkinPicker } from './SkinPicker';

const purchaseItem = vi.fn();
vi.mock('@/features/shop/queries', () => ({ purchaseItem: (...a: unknown[]) => purchaseItem(...a) }));

const selectPetSkin = vi.fn();
vi.mock('./queries', () => ({ selectPetSkin: (...a: unknown[]) => selectPetSkin(...a) }));

describe('SkinPicker', () => {
  beforeEach(() => {
    purchaseItem.mockReset();
    selectPetSkin.mockReset();
    purchaseItem.mockResolvedValue({ data: null, error: null });
    selectPetSkin.mockResolvedValue({ data: null, error: null });
  });

  it('skin non posseduta: mostra il prezzo; comprando, acquista e poi attiva', async () => {
    render(
      <SkinPicker speciesKey="pet_dog" activeSkin={null} ownedSkins={[]} prices={{ skin_gold: 50 }} who="fabrizio" />,
    );
    screen.getByRole('button', { name: /Gold · 50/ }).click();
    await waitFor(() => expect(purchaseItem).toHaveBeenCalledWith('fabrizio', 'skin_gold'));
    await waitFor(() => expect(selectPetSkin).toHaveBeenCalledWith('pet_dog', 'skin_gold'));
  });

  it('skin posseduta ma non attiva: attivando, chiama solo selectPetSkin', async () => {
    render(
      <SkinPicker speciesKey="pet_dog" activeSkin={null} ownedSkins={['skin_gold']} prices={{ skin_gold: 50 }} who="emily" />,
    );
    screen.getByRole('button', { name: 'Gold' }).click();
    await waitFor(() => expect(selectPetSkin).toHaveBeenCalledWith('pet_dog', 'skin_gold'));
    expect(purchaseItem).not.toHaveBeenCalled();
  });

  it('Natural è sempre attivabile, anche senza alcuna skin posseduta', async () => {
    render(
      <SkinPicker speciesKey="pet_dog" activeSkin="skin_gold" ownedSkins={['skin_gold']} prices={{ skin_gold: 50 }} who="fabrizio" />,
    );
    screen.getByRole('button', { name: 'Natural' }).click();
    await waitFor(() => expect(selectPetSkin).toHaveBeenCalledWith('pet_dog', null));
  });

  it('acquisto fallito per monete insufficienti: mostra l’errore, non attiva', async () => {
    purchaseItem.mockResolvedValue({ data: null, error: "You don't have enough coins for that yet." });
    render(
      <SkinPicker speciesKey="pet_dog" activeSkin={null} ownedSkins={[]} prices={{ skin_gold: 50 }} who="fabrizio" />,
    );
    screen.getByRole('button', { name: /Gold · 50/ }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(selectPetSkin).not.toHaveBeenCalled();
  });

  it('due tocchi rapidi sulla stessa skin inviano una sola attivazione', async () => {
    render(
      <SkinPicker speciesKey="pet_dog" activeSkin={null} ownedSkins={['skin_gold']} prices={{ skin_gold: 50 }} who="fabrizio" />,
    );
    const button = screen.getByRole('button', { name: 'Gold' });
    button.click();
    button.click();
    await waitFor(() => expect(selectPetSkin).toHaveBeenCalled());
    expect(selectPetSkin).toHaveBeenCalledTimes(1);
  });

  it('costo non ancora caricato: il pulsante mostra solo il nome, disabilitato', () => {
    render(<SkinPicker speciesKey="pet_dog" activeSkin={null} ownedSkins={[]} prices={{}} who="fabrizio" />);
    const button = screen.getByRole('button', { name: 'Gold' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
