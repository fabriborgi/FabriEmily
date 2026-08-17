import { describe, it, expect, vi } from 'vitest';
import { toUserMessage, call } from './rpc';

describe('toUserMessage', () => {
  it('non produce messaggi quando non c’è errore', () => {
    expect(toUserMessage(null)).toBeNull();
  });

  it('traduce insufficient_funds', () => {
    expect(toUserMessage({ message: 'insufficient_funds' })).toBe(
      "You don't have enough coins for that yet.",
    );
  });

  it('riconosce il codice anche dentro un messaggio più lungo di Postgres', () => {
    expect(
      toUserMessage({ message: 'ERROR: invalid_strokes (SQLSTATE P0001)' }),
    ).toBe("That drawing couldn't be saved. Try drawing it again.");
  });

  it('traduce empty_letter', () => {
    expect(toUserMessage({ message: 'empty_letter' })).toBe('Write something first.');
  });

  it('traduce unknown_item', () => {
    expect(toUserMessage({ message: 'unknown_item' })).toBe("That item doesn't exist anymore.");
  });

  it('usa un messaggio generico per gli errori sconosciuti', () => {
    expect(toUserMessage({ message: 'connection reset by peer' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('non mostra mai all’utente il testo grezzo di Postgres', () => {
    // Un'implementazione che si limitasse a togliere la parola "constraint" dal
    // messaggio grezzo supererebbe un banale .not.toMatch(/constraint/) pur
    // mostrando comunque testo del database: il confronto deve essere con il
    // messaggio generico esatto, non con l'assenza di una singola parola.
    expect(toUserMessage({ message: 'duplicate key value violates unique constraint' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('non lancia mai, anche con un oggetto errore malformato', () => {
    expect(toUserMessage({})).toBe('Something went wrong. Please try again.');
    expect(toUserMessage({ message: null })).toBe('Something went wrong. Please try again.');
    expect(toUserMessage({ message: 42 })).toBe('Something went wrong. Please try again.');
  });
});

describe('call', () => {
  it('passa i dati quando la chiamata riesce', async () => {
    const result = await call(Promise.resolve({ data: 42, error: null }));
    expect(result).toEqual({ data: 42, error: null });
  });

  it('traduce l’errore e azzera i dati', async () => {
    const result = await call(
      Promise.resolve({ data: null, error: { message: 'insufficient_funds' } }),
    );
    expect(result.data).toBeNull();
    expect(result.error).toBe("You don't have enough coins for that yet.");
  });

  it('cattura anche un rifiuto della promise, tipicamente la rete', async () => {
    const result = await call(Promise.reject(new Error('Failed to fetch')));
    expect(result.error).toBe('No connection. Your work is still here — try again.');
  });

  it('riconosce "Load failed", il messaggio di rete di WebKit/Safari (e quindi di ogni browser su iOS)', async () => {
    const result = await call(Promise.reject(new Error('Load failed')));
    expect(result.error).toBe('No connection. Your work is still here — try again.');
  });

  it('si fida di navigator.onLine === false anche quando il testo dell’errore non contiene parole chiave note', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    try {
      const result = await call(Promise.reject(new Error('boom')));
      expect(result.error).toBe('No connection. Your work is still here — try again.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
