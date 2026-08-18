import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LetterCard } from './LetterCard';
import type { Letter } from './queries';

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: '11111111-1111-1111-1111-111111111111',
  author: 'emily',
  kind: 'text',
  body: 'I walked past the bakery today and thought of you for the whole afternoon.',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('LetterCard', () => {
  it('nomina l’autore', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByText('Emily')).toBeDefined();
  });

  it('mostra un estratto del testo', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByText(/walked past the bakery/)).toBeDefined();
  });

  it('accorcia gli estratti lunghi', () => {
    render(<LetterCard letter={letter({ body: 'a'.repeat(300) })} who="fabrizio" />);
    const excerpt = screen.getByTestId('excerpt').textContent ?? '';
    expect(excerpt.length).toBeLessThan(160);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('segnala le lettere non lette', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByLabelText('Unread')).toBeDefined();
  });

  it('non segnala le proprie lettere come non lette', () => {
    render(<LetterCard letter={letter({ author: 'fabrizio' })} who="fabrizio" />);
    expect(screen.queryByLabelText('Unread')).toBeNull();
  });

  it('non segnala una lettera già aperta', () => {
    render(<LetterCard letter={letter({ read_at: '2026-08-14T12:00:00Z' })} who="fabrizio" />);
    expect(screen.queryByLabelText('Unread')).toBeNull();
  });

  it('collega al dettaglio della lettera', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/letters/11111111-1111-1111-1111-111111111111',
    );
  });

  it('per un disegno mostra una miniatura invece del testo', () => {
    render(
      <LetterCard
        letter={letter({ kind: 'drawing', body: null, strokes: [{ c: 0, w: 0, p: [1, 1, 2, 2] }] })}
        who="fabrizio"
      />,
    );
    expect(screen.getByLabelText('Drawing from Emily')).toBeDefined();
    expect(screen.queryByTestId('excerpt')).toBeNull();
  });

  it('mostra la data in formato leggibile', () => {
    render(<LetterCard letter={letter()} who="fabrizio" />);
    expect(screen.getByText(/Aug 14/)).toBeDefined();
  });
});
