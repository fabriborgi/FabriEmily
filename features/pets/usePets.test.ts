import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePets } from './usePets';
import type { PetsState } from './queries';

vi.mock('./queries', () => ({ fetchPetsState: vi.fn() }));
import { fetchPetsState } from './queries';

/** Client Realtime finto: stesso pattern di useShop.test.ts. */
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

const state = (over: Partial<PetsState> = {}): PetsState => ({
  prices: { pet_dog: 35 },
  pets: [],
  ...over,
});

describe('usePets', () => {
  beforeEach(() => vi.mocked(fetchPetsState).mockReset());

  it('carica prezzi e animali posseduti', async () => {
    vi.mocked(fetchPetsState).mockResolvedValue(
      state({
        pets: [
          {
            species_key: 'pet_dog',
            kind: 'animal',
            nickname: 'Rex',
            stats: { hunger: 100, cleanliness: 100, affection: 100 },
            updated_at: '2026-08-23T10:00:00Z',
            unlocked_at: '2026-08-23T10:00:00Z',
          },
        ],
      }),
    );
    const client = fakeClient();
    const { result } = renderHook(() => usePets({ client: client as never }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.pets).toHaveLength(1);
    expect(result.current.data?.prices.pet_dog).toBe(35);
  });
});
