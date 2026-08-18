import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CategoryPicker } from './CategoryPicker';

const drawQuestion = vi.fn();
vi.mock('./queries', () => ({ drawQuestion: (...a: unknown[]) => drawQuestion(...a) }));

describe('CategoryPicker', () => {
  beforeEach(() => {
    drawQuestion.mockReset();
    drawQuestion.mockResolvedValue({ data: { id: 'r1' }, error: null });
  });

  it('offre le cinque categorie più "Surprise me"', () => {
    render(<CategoryPicker who="fabrizio" />);
    for (const label of ['Deep', 'About us', 'Hypothetical', 'Fun', 'Spicy', 'Surprise me']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('pescare per categoria passa il valore giusto', async () => {
    render(<CategoryPicker who="emily" />);
    screen.getByRole('button', { name: 'Deep' }).click();
    await waitFor(() => expect(drawQuestion).toHaveBeenCalledWith('emily', 'deep'));
  });

  it('"Surprise me" pesca senza categoria', async () => {
    render(<CategoryPicker who="emily" />);
    screen.getByRole('button', { name: 'Surprise me' }).click();
    await waitFor(() => expect(drawQuestion).toHaveBeenCalledWith('emily', null));
  });

  it('due tocchi rapidi pescano una sola volta', async () => {
    render(<CategoryPicker who="fabrizio" />);
    const button = screen.getByRole('button', { name: 'Fun' });
    button.click();
    button.click();
    await waitFor(() => expect(drawQuestion).toHaveBeenCalled());
    expect(drawQuestion).toHaveBeenCalledTimes(1);
  });

  it('mostra l’errore tradotto se la pescata fallisce', async () => {
    drawQuestion.mockResolvedValue({ data: null, error: 'Something went wrong. Please try again.' });
    render(<CategoryPicker who="fabrizio" />);
    screen.getByRole('button', { name: 'Fun' }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
  });
});
