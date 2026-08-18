import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabBar } from './TabBar';

vi.mock('next/navigation', () => ({ usePathname: () => '/letters' }));

describe('TabBar', () => {
  it('mostra le cinque sezioni', () => {
    render(<TabBar />);
    for (const label of ['Home', 'Games', 'Letters', 'Pets', 'Questions']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeDefined();
    }
  });

  it('non contiene lo Shop, che si raggiunge dal saldo monete', () => {
    render(<TabBar />);
    expect(screen.queryByRole('link', { name: /Shop/ })).toBeNull();
  });

  it('segna come corrente la sezione attiva', () => {
    render(<TabBar />);
    const letters = screen.getByRole('link', { name: /Letters/ });
    expect(letters.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Home/ }).getAttribute('aria-current')).toBeNull();
  });

  it('collega ogni voce alla propria rotta', () => {
    render(<TabBar />);
    expect(screen.getByRole('link', { name: /Games/ }).getAttribute('href')).toBe('/games');
    expect(screen.getByRole('link', { name: /Questions/ }).getAttribute('href')).toBe('/questions');
  });
});
