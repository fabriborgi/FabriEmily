import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GamesPage from './page';

describe('GamesPage', () => {
  it('mostra un link giocabile per il Tris', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Tic-tac-toe/ });
    expect(link.getAttribute('href')).toBe('/games/tic-tac-toe');
  });

  it('mostra gli altri giochi come "coming soon", senza link', () => {
    render(<GamesPage />);
    expect(screen.getByText('Connect 4')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Connect 4/ })).toBeNull();
    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
  });
});
