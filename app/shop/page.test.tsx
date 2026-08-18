import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShopPage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

const useShop = vi.fn();
vi.mock('@/features/shop/useShop', () => ({ useShop: () => useShop() }));

const baseState = { loading: false, error: null, offline: false, refetch: vi.fn() };
const fullCatalog = { theme_night: 100, theme_ocean: 100, theme_sunset: 100, theme_forest: 100 };

describe('ShopPage', () => {
  beforeEach(() => useShop.mockReset());

  it('mostra una card per ciascuno dei 4 temi', () => {
    useShop.mockReturnValue({
      ...baseState,
      data: { prices: fullCatalog, owned: [], activeTheme: 'default' },
    });
    render(<ShopPage />);
    expect(screen.getByText('Night')).toBeDefined();
    expect(screen.getByText('Ocean')).toBeDefined();
    expect(screen.getByText('Sunset')).toBeDefined();
    expect(screen.getByText('Forest')).toBeDefined();
  });

  it('segnala il tema attivo', () => {
    useShop.mockReturnValue({
      ...baseState,
      data: { prices: fullCatalog, owned: ['theme_ocean'], activeTheme: 'theme_ocean' },
    });
    render(<ShopPage />);
    expect(screen.getByText('Active')).toBeDefined();
  });
});
