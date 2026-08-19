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

  it('applica il filtro CSS quando passato, sia su immagine sia su emoji fallback', () => {
    render(<SpeciesImage speciesKey="pet_dog" emoji="🐶" alt="Dog" filter="hue-rotate(35deg)" />);
    const img = screen.getByRole('img', { name: 'Dog' }) as HTMLImageElement;
    expect(img.style.filter).toBe('hue-rotate(35deg)');

    fireEvent.error(img);
    const fallback = screen.getByText('🐶');
    expect(fallback.style.filter).toBe('hue-rotate(35deg)');
  });

  it('nessun filtro applicato quando la prop non è passata', () => {
    render(<SpeciesImage speciesKey="pet_dog" emoji="🐶" alt="Dog" />);
    const img = screen.getByRole('img', { name: 'Dog' }) as HTMLImageElement;
    expect(img.style.filter).toBe('');
  });
});
