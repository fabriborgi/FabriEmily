import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';
import { fetchShopState, purchaseItem, activateTheme } from '@/features/shop/queries';

const setCoins = (n: number) => sql('update couple_state set coins = $1 where id = 1', [n]);

beforeEach(resetData);

describe('queries dello shop contro il database reale', () => {
  it('fetchShopState riporta il catalogo reale, nessun tema posseduto, default attivo', async () => {
    const client = await signedInClient();
    const state = await fetchShopState(client);
    expect(state.prices).toEqual({
      theme_night: 100,
      theme_ocean: 100,
      theme_sunset: 100,
      theme_forest: 100,
    });
    expect(state.owned).toEqual([]);
    expect(state.activeTheme).toBe('default');
  });

  it('purchaseItem scala le monete e registra il possesso', async () => {
    await setCoins(200);
    const client = await signedInClient();
    const { error } = await purchaseItem('emily', 'theme_ocean', client);
    expect(error).toBeNull();
    const state = await fetchShopState(client);
    expect(state.owned).toEqual(['theme_ocean']);
  });

  it('purchaseItem traduce insufficient_funds', async () => {
    await setCoins(10);
    const client = await signedInClient();
    const { error } = await purchaseItem('emily', 'theme_ocean', client);
    expect(error).toBe("You don't have enough coins for that yet.");
  });

  it('activateTheme applica un tema posseduto', async () => {
    await setCoins(200);
    const client = await signedInClient();
    await purchaseItem('emily', 'theme_ocean', client);
    const { error } = await activateTheme('theme_ocean', client);
    expect(error).toBeNull();
    const state = await fetchShopState(client);
    expect(state.activeTheme).toBe('theme_ocean');
  });

  it('activateTheme traduce theme_not_owned', async () => {
    const client = await signedInClient();
    const { error } = await activateTheme('theme_ocean', client);
    expect(error).toBe("You don't own that theme yet.");
  });

  it('activateTheme permette sempre default', async () => {
    const client = await signedInClient();
    const { error } = await activateTheme('default', client);
    expect(error).toBeNull();
  });
});
