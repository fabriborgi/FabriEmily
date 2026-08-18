import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useShop } from './useShop';
import type { ShopState } from './queries';

vi.mock('./queries', () => ({ fetchShopState: vi.fn() }));
import { fetchShopState } from './queries';

/** Client Realtime finto: stesso pattern di useActiveRound.test.tsx. */
function fakeClient() {
  const channel = {
    on: () => channel,
    subscribe: (cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return channel;
    },
  };
  return { channel: () => channel, removeChannel: () => {} };
}

const state = (over: Partial<ShopState> = {}): ShopState => ({
  prices: { theme_night: 100 },
  owned: [],
  activeTheme: 'default',
  ...over,
});

describe('useShop', () => {
  beforeEach(() => vi.mocked(fetchShopState).mockReset());

  it('carica prezzi, posseduti e tema attivo', async () => {
    vi.mocked(fetchShopState).mockResolvedValue(
      state({ owned: ['theme_night'], activeTheme: 'theme_night' }),
    );
    // fakeClient() va chiamato UNA volta, fuori dal render: stesso motivo
    // già documentato in useActiveRound.test.tsx (F5) — passarne uno fresco
    // a ogni render innescherebbe un loop di risottoscrizioni.
    const client = fakeClient();
    const { result } = renderHook(() => useShop({ client: client as never }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(state({ owned: ['theme_night'], activeTheme: 'theme_night' }));
  });
});
