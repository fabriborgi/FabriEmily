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

  it('Trivia è ora un link giocabile', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Trivia/ });
    expect(link.getAttribute('href')).toBe('/games/trivia');
  });

  it('Gioco dell\'oca è ora un link giocabile', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Goose Game/ });
    expect(link.getAttribute('href')).toBe('/games/goose');
  });

  it('mostra Blackjack come "coming soon", senza link', () => {
    render(<GamesPage />);
    expect(screen.getByText('Blackjack')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Blackjack/ })).toBeNull();
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
  });
});
