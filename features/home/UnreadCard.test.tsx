import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnreadCard } from './UnreadCard';
import type { Letter } from '@/features/letters/queries';

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: 'aaa',
  author: 'emily',
  kind: 'text',
  body: 'hello',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('UnreadCard', () => {
  it('senza non lette non mostra nulla', () => {
    const { container } = render(<UnreadCard letters={[]} who="fabrizio" />);
    expect(container.textContent).toBe('');
  });

  it('annuncia una lettera al singolare', () => {
    render(<UnreadCard letters={[letter()]} who="fabrizio" />);
    expect(screen.getByText('Emily wrote you')).toBeDefined();
  });

  it('annuncia un disegno con parole diverse', () => {
    render(
      <UnreadCard letters={[letter({ kind: 'drawing', body: null, strokes: [] })]} who="fabrizio" />,
    );
    expect(screen.getByText('Emily sent you a drawing')).toBeDefined();
  });

  it('conta le non lette quando sono più di una', () => {
    render(<UnreadCard letters={[letter({ id: 'a' }), letter({ id: 'b' })]} who="fabrizio" />);
    expect(screen.getByText(/2 unread/)).toBeDefined();
  });

  it('porta alla non letta più vecchia', () => {
    const older = letter({ id: 'old', created_at: '2026-08-01T10:00:00Z' });
    const newer = letter({ id: 'new', created_at: '2026-08-14T10:00:00Z' });
    render(<UnreadCard letters={[newer, older]} who="fabrizio" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/letters/old');
  });

  it('ignora le proprie lettere', () => {
    const { container } = render(
      <UnreadCard letters={[letter({ author: 'fabrizio' })]} who="fabrizio" />,
    );
    expect(container.textContent).toBe('');
  });
});
