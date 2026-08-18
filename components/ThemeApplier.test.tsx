import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeApplier } from './ThemeApplier';

const useActiveTheme = vi.fn();
vi.mock('@/features/shop/useActiveTheme', () => ({ useActiveTheme: () => useActiveTheme() }));

describe('ThemeApplier', () => {
  beforeEach(() => useActiveTheme.mockReset());
  afterEach(() => delete document.documentElement.dataset.theme);

  it('imposta data-theme quando il tema attivo non è default', () => {
    useActiveTheme.mockReturnValue('theme_ocean');
    render(<ThemeApplier />);
    expect(document.documentElement.dataset.theme).toBe('theme_ocean');
  });

  it('non imposta nulla quando il tema è default', () => {
    useActiveTheme.mockReturnValue('default');
    render(<ThemeApplier />);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('non imposta nulla finché il tema non è ancora noto', () => {
    useActiveTheme.mockReturnValue(null);
    render(<ThemeApplier />);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('rimuove l’attributo se il tema torna al default dopo essere stato impostato', () => {
    useActiveTheme.mockReturnValue('theme_ocean');
    const { rerender } = render(<ThemeApplier />);
    expect(document.documentElement.dataset.theme).toBe('theme_ocean');
    useActiveTheme.mockReturnValue('default');
    rerender(<ThemeApplier />);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
