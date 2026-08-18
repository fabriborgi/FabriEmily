import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeQuery } from './useRealtimeQuery';

/** Client finto: registra le sottoscrizioni e permette al test di scatenare un evento. */
function fakeClient() {
  const handlers: Array<() => void> = [];
  const removed: string[] = [];
  const channel = {
    name: '',
    on(_event: string, _filter: unknown, handler: () => void) {
      handlers.push(handler);
      return channel;
    },
    subscribe(cb?: (status: string) => void) {
      cb?.('SUBSCRIBED');
      return channel;
    },
  };
  return {
    client: {
      channel(name: string) {
        channel.name = name;
        return channel;
      },
      removeChannel(ch: { name: string }) {
        removed.push(ch.name);
      },
    },
    fireChange: () => handlers.forEach((h) => h()),
    removed,
    handlerCount: () => handlers.length,
  };
}

describe('useRealtimeQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('parte in caricamento e poi espone i dati', async () => {
    const { client } = fakeClient();
    const fetcher = vi.fn().mockResolvedValue(['a']);
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: client as never }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('ri-scarica quando Realtime segnala una modifica', async () => {
    const f = fakeClient();
    // Al montaggio l'hook carica due volte (fetch iniziale + ri-scarico su
    // SUBSCRIBED del client finto, che invoca subito la callback): entrambe
    // devono restituire 'prima' perché il fireChange del test sia l'unico
    // evento a produrre 'dopo'.
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(['prima'])
      .mockResolvedValueOnce(['prima'])
      .mockResolvedValueOnce(['dopo']);
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(result.current.data).toEqual(['prima']));

    await act(async () => f.fireChange());
    await waitFor(() => expect(result.current.data).toEqual(['dopo']));
  });

  it('si iscrive a una tabella per ogni tabella richiesta', async () => {
    const f = fakeClient();
    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() =>
      useRealtimeQuery({
        tables: ['letters', 'couple_state'],
        fetcher,
        client: f.client as never,
      }),
    );
    await waitFor(() => expect(f.handlerCount()).toBe(2));
  });

  it('conserva i dati precedenti quando un ri-scarico fallisce', async () => {
    const f = fakeClient();
    // Idem: le prime due chiamate (fetch iniziale + SUBSCRIBED) devono
    // riuscire entrambe, così il fallimento arriva solo dal fireChange
    // del test e i dati vecchi visibili prima di quel momento sono 'buono'.
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(['buono'])
      .mockResolvedValueOnce(['buono'])
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(result.current.data).toEqual(['buono']));

    await act(async () => f.fireChange());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toEqual(['buono']);
  });

  it('ri-scarica quando la connessione torna', async () => {
    const f = fakeClient();
    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    // Al montaggio l'hook carica due volte: il fetch iniziale e il ri-scarico
    // su SUBSCRIBED (il client finto invoca subito la callback). È il
    // comportamento reale, non un difetto: quel secondo caricamento è la
    // garanzia di ripresa dopo una disconnessione.
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  });

  it('segnala lo stato offline e lo revoca al ritorno online', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const f = fakeClient();
    const { result } = renderHook(() =>
      useRealtimeQuery({
        tables: ['letters'],
        fetcher: vi.fn().mockResolvedValue([]),
        client: f.client as never,
      }),
    );
    await waitFor(() => expect(result.current.offline).toBe(true));

    await act(async () => {
      vi.stubGlobal('navigator', { onLine: true });
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.offline).toBe(false));
  });

  it('non lascia che una risposta lenta sovrascriva dati più recenti già arrivati (fuori ordine)', async () => {
    const f = fakeClient();
    let resolveSlow: (value: string[]) => void = () => {};
    const slow = new Promise<string[]>((resolve) => {
      resolveSlow = resolve;
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(['iniziale']) // fetch al montaggio
      .mockResolvedValueOnce(['iniziale']) // ri-scarico su SUBSCRIBED
      .mockImplementationOnce(() => slow) // caricamento lento innescato dal test, resta in sospeso
      .mockResolvedValueOnce(['veloce']); // caricamento veloce innescato subito dopo
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(result.current.data).toEqual(['iniziale']));

    // Parte il caricamento lento (terza chiamata) e, subito dopo, quello veloce
    // (quarta chiamata): il veloce risolve per primo.
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.data).toEqual(['veloce']));

    // Solo ora arriva la risposta del caricamento lento, partito per primo ma
    // più tardivo: non deve sovrascrivere i dati più recenti già mostrati.
    await act(async () => {
      resolveSlow(['lento']);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.data).toEqual(['veloce']);
  });

  it('revoca lo stato offline al ritorno online anche se il ri-scarico fallisce', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const f = fakeClient();
    // Tutti i caricamenti falliscono, compreso quello innescato da 'online':
    // il ramo di successo di load() (che azzererebbe offline come effetto
    // collaterale) non entra mai in gioco, così il test dipende solo dalla
    // riga esplicita nel gestore dell'evento 'online'.
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch')) // fetch al montaggio (offline)
      .mockRejectedValueOnce(new Error('Failed to fetch')) // ri-scarico su SUBSCRIBED (offline)
      .mockRejectedValueOnce(new Error('Failed to fetch')); // ri-scarico su 'online': la rete torna ma resta instabile
    const { result } = renderHook(() =>
      useRealtimeQuery({ tables: ['letters'], fetcher, client: f.client as never }),
    );
    await waitFor(() => expect(result.current.offline).toBe(true));

    await act(async () => {
      vi.stubGlobal('navigator', { onLine: true });
      window.dispatchEvent(new Event('online'));
    });

    // Anche se il ri-scarico fallisce, la connessione è tornata: la striscia
    // "offline" non deve restare bloccata (l'errore resta comunque esposto).
    await waitFor(() => expect(result.current.offline).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  it('rimuove il canale allo smontaggio', async () => {
    const f = fakeClient();
    const { unmount } = renderHook(() =>
      useRealtimeQuery({
        tables: ['letters'],
        fetcher: vi.fn().mockResolvedValue([]),
        client: f.client as never,
      }),
    );
    await waitFor(() => expect(f.handlerCount()).toBe(1));
    unmount();
    expect(f.removed).toHaveLength(1);
  });
});
