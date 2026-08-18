import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GamesPage from './page';

describe('GamesPage', () => {
  it('mostra un link giocabile per il Tris', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Tic-tac-toe/ });
    expect(link.getAttribute('href')).toBe('/games/tic-tac-toe');
  });

  it('Forza 4 è ora un link giocabile', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Connect 4/ });
    expect(link.getAttribute('href')).toBe('/games/connect-four');
  });

  it('mostra i giochi non ancora pronti come "coming soon", senza link', () => {
    render(<GamesPage />);
    expect(screen.getByText('Blackjack')).toBeDefined();
    expect(screen.getByText('Trivia')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Blackjack/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Trivia/ })).toBeNull();
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });
});
