import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeciesImage } from './SpeciesImage';

describe('SpeciesImage', () => {
  it("mostra l'immagine della specie", () => {
    render(<SpeciesImage speciesKey="pet_dog" emoji="🐶" alt="Dog" />);
    const img = screen.getByRole('img', { name: 'Dog' }) as HTMLImageElement;
    expect(img.src).toContain('/pets/pet_dog.png');
  });

  it("mostra l'emoji se l'immagine non carica", () => {
    render(<SpeciesImage speciesKey="pet_dog" emoji="🐶" alt="Dog" />);
    fireEvent.error(screen.getByRole('img', { name: 'Dog' }));
    expect(screen.getByText('🐶')).toBeDefined();
  });
});
