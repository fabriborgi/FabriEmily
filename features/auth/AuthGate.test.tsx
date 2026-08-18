import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AuthGate } from './AuthGate';
import { getSupabase } from '@/lib/supabase/client';
import { IDENTITY_KEY } from './identity';

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: vi.fn(),
  coupleEmail: () => 'us@example.com',
}));

/**
 * jsdom, in questa configurazione, non espone window.localStorage (verificato:
 * è undefined finché non viene fornito esplicitamente) — per questo AuthGate
 * non aveva ancora nessun test. IdentityProvider e AuthGate lo usano
 * direttamente (non è iniettabile come in identity.ts), quindi qui lo si
 * sostituisce con un'implementazione in memoria.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

type FakeSession = { user: { id: string } } | null;
type AuthHandler = (event: string, session: FakeSession) => void;

/**
 * Client Supabase finto per AuthGate. getSession() è controllabile a comando
 * con una promise il cui resolve resta esposto al test — lo stesso pattern
 * usato in lib/useRealtimeQuery.test.tsx per il caricamento lento — perché
 * serve poter far risolvere getSession() DOPO un evento di
 * onAuthStateChange per riprodurre la corsa fra le due sorgenti (rilievo di
 * review). onAuthStateChange espone il proprio gestore così il test può
 * iniettare eventi direttamente, e restituisce un unsubscribe spiabile per
 * verificare la disiscrizione allo smontaggio.
 */
function fakeSupabase() {
  let resolveSession: (session: FakeSession) => void = () => {};
  const sessionPromise = new Promise<{ data: { session: FakeSession } }>((resolve) => {
    resolveSession = (session) => resolve({ data: { session } });
  });
  const unsubscribe = vi.fn();
  let authHandler: AuthHandler | null = null;

  const client = {
    auth: {
      getSession: vi.fn(() => sessionPromise),
      onAuthStateChange: vi.fn((handler: AuthHandler) => {
        authHandler = handler;
        return { data: { subscription: { unsubscribe } } };
      }),
      signInWithPassword: vi.fn(async () => ({ error: null })),
    },
  };

  return {
    client,
    resolveSession: (session: FakeSession) => resolveSession(session),
    fireAuthEvent: (event: string, session: FakeSession) => authHandler?.(event, session),
    unsubscribe,
  };
}

function setup() {
  const fake = fakeSupabase();
  vi.mocked(getSupabase).mockReturnValue(fake.client as unknown as ReturnType<typeof getSupabase>);
  return fake;
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('mostra il form di login quando non c’è sessione', async () => {
    const fake = setup();
    render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    await act(async () => {
      fake.resolveSession(null);
    });

    expect(await screen.findByLabelText('Our password')).toBeDefined();
  });

  it('mostra la scelta dell’identità quando c’è sessione ma nessuna identità salvata', async () => {
    const fake = setup();
    render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    await act(async () => {
      fake.resolveSession({ user: { id: '1' } });
    });

    expect(await screen.findByText(/holding the phone/i)).toBeDefined();
  });

  it('mostra i figli quando c’è sessione e l’identità è già scelta', async () => {
    window.localStorage.setItem(IDENTITY_KEY, 'emily');
    const fake = setup();
    render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    await act(async () => {
      fake.resolveSession({ user: { id: '1' } });
    });

    expect(await screen.findByText('children-marker')).toBeDefined();
  });

  it('dopo la scelta dell’identità i figli compaiono senza bisogno di ricaricare', async () => {
    const fake = setup();
    render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    await act(async () => {
      fake.resolveSession({ user: { id: '1' } });
    });
    const button = await screen.findByRole('button', { name: /emily/i });
    fireEvent.click(button);

    expect(await screen.findByText('children-marker')).toBeDefined();
  });

  it('un evento di logout riporta al form di login', async () => {
    window.localStorage.setItem(IDENTITY_KEY, 'emily');
    const fake = setup();
    render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    await act(async () => {
      fake.resolveSession({ user: { id: '1' } });
    });
    await screen.findByText('children-marker');

    await act(async () => {
      fake.fireAuthEvent('SIGNED_OUT', null);
    });

    expect(await screen.findByLabelText('Our password')).toBeDefined();
  });

  it('un evento più recente non viene sovrascritto dalla risoluzione tardiva di getSession (corsa)', async () => {
    window.localStorage.setItem(IDENTITY_KEY, 'emily');
    const fake = setup();
    render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    // L'evento di logout arriva per primo, PRIMA che getSession() risolva.
    await act(async () => {
      fake.fireAuthEvent('SIGNED_OUT', null);
    });
    expect(await screen.findByLabelText('Our password')).toBeDefined();

    // getSession(), partita al montaggio quando la sessione esisteva ancora,
    // risolve tardi: non deve far tornare indietro lo stato a "ready".
    await act(async () => {
      fake.resolveSession({ user: { id: '1' } });
    });

    expect(screen.queryByLabelText('Our password')).not.toBeNull();
    expect(screen.queryByText('children-marker')).toBeNull();
  });

  it('disiscrive la sottoscrizione allo smontaggio', () => {
    const fake = setup();
    const { unmount } = render(
      <AuthGate>
        <div>children-marker</div>
      </AuthGate>,
    );

    unmount();

    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
