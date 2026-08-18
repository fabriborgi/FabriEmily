import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LetterDetail } from './LetterDetail';
import type { Letter } from './queries';

const markRead = vi.fn();
vi.mock('./queries', async (original) => ({
  ...(await original<typeof import('./queries')>()),
  markRead: (...a: unknown[]) => markRead(...a),
}));

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: 'abc',
  author: 'emily',
  kind: 'text',
  body: 'Two paragraphs.\n\nAnd the second one.',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('LetterDetail', () => {
  beforeEach(() => {
    markRead.mockReset();
    markRead.mockResolvedValue({ error: null });
  });

  it('mostra il testo per intero, a capo compresi', () => {
    render(<LetterDetail letter={letter()} who="fabrizio" />);
    expect(screen.getByText(/And the second one/)).toBeDefined();
  });

  it('segna come letta la lettera dell’altro', async () => {
    render(<LetterDetail letter={letter()} who="fabrizio" />);
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('abc', 'fabrizio'));
  });

  it('non segna come letta la propria lettera', async () => {
    render(<LetterDetail letter={letter({ author: 'fabrizio' })} who="fabrizio" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('non richiama markRead su una lettera già letta', async () => {
    render(<LetterDetail letter={letter({ read_at: '2026-08-14T12:00:00Z' })} who="fabrizio" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('all’autore mostra quando è stata letta', () => {
    render(
      <LetterDetail
        letter={letter({ author: 'fabrizio', read_at: '2026-08-14T12:00:00Z' })}
        who="fabrizio"
      />,
    );
    expect(screen.getByText(/Read on Aug 14/)).toBeDefined();
  });

  it('all’autore di una lettera non ancora letta lo dice', () => {
    render(<LetterDetail letter={letter({ author: 'fabrizio' })} who="fabrizio" />);
    expect(screen.getByText(/Not read yet/)).toBeDefined();
  });

  it('per un disegno offre il replay invece del testo', () => {
    render(
      <LetterDetail
        letter={letter({ kind: 'drawing', body: null, strokes: [{ c: 0, w: 0, p: [1, 1, 9, 9] }] })}
        who="fabrizio"
      />,
    );
    expect(screen.getByRole('button', { name: /Watch it again/ })).toBeDefined();
  });
});
