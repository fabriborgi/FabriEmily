import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from './LoginForm';
import { getSupabase } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: vi.fn(),
  coupleEmail: () => 'us@example.com',
}));

/**
 * signInWithPassword, verificato empiricamente contro un client supabase-js
 * reale (mockando fetch per lanciare, e puntando a un host irraggiungibile
 * con il vero fetch): non lancia mai per un fallimento di rete, lo risolve
 * come { error: AuthRetryableFetchError }, con message uguale a ciò che
 * produce il fetch sottostante ("Load failed" su WebKit, "fetch failed" con
 * fetch nativo di Node, "Failed to fetch" su Chrome). Il ramo "lancia" sotto
 * resta comunque testato perché costa poco e copre un comportamento futuro
 * della libreria che oggi non si osserva.
 */
function mockSignIn(implementation: () => Promise<{ error: { message: string } | null }>) {
  const signInWithPassword = vi.fn(implementation);
  vi.mocked(getSupabase).mockReturnValue({
    auth: { signInWithPassword },
  } as unknown as ReturnType<typeof getSupabase>);
  return signInWithPassword;
}

async function typeAndSubmit(password: string) {
  fireEvent.change(screen.getByLabelText('Our password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /come in/i }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('mostra il messaggio di password sbagliata quando le credenziali sono rifiutate', async () => {
    mockSignIn(async () => ({ error: { message: 'Invalid login credentials' } }));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await typeAndSubmit('sbagliata');

    expect(await screen.findByText('That’s not the password. Try again?')).toBeDefined();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('mostra il messaggio di rete quando la richiesta cade per assenza di connessione, non quello della password sbagliata', async () => {
    // Riproduce ciò che auth-js restituisce davvero (verificato con un
    // client reale) quando fetch fallisce lato WebKit.
    mockSignIn(async () => ({ error: { message: 'Load failed' } }));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await typeAndSubmit('qualunque');

    expect(
      await screen.findByText('No connection. Your work is still here — try again.'),
    ).toBeDefined();
    expect(screen.queryByText('That’s not the password. Try again?')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('gestisce anche il caso, non osservato ma economico da coprire, in cui signInWithPassword lanciasse invece di risolvere', async () => {
    mockSignIn(async () => {
      throw new Error('Failed to fetch');
    });
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await typeAndSubmit('qualunque');

    expect(
      await screen.findByText('No connection. Your work is still here — try again.'),
    ).toBeDefined();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('non svuota il campo password quando il login fallisce', async () => {
    mockSignIn(async () => ({ error: { message: 'Invalid login credentials' } }));
    render(<LoginForm onSuccess={vi.fn()} />);

    await typeAndSubmit('quellochehoscritto');

    await waitFor(() =>
      expect(screen.getByText('That’s not the password. Try again?')).toBeDefined(),
    );
    expect((screen.getByLabelText('Our password') as HTMLInputElement).value).toBe(
      'quellochehoscritto',
    );
  });

  it('chiama onSuccess quando il login riesce', async () => {
    mockSignIn(async () => ({ error: null }));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await typeAndSubmit('correct-password');

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('mostra un messaggio che chiede di aspettare quando Supabase risponde con un rate limit, non quello della password sbagliata', async () => {
    // Testo e status verificati contro il comportamento reale di auth-js per
    // un rate limit sul login. Riprovare subito, come suggerirebbe il
    // messaggio di password sbagliata, aggrava proprio il blocco in corso.
    mockSignIn(async () => ({
      error: { message: 'Request rate limit reached', status: 429 } as unknown as {
        message: string;
      },
    }));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await typeAndSubmit('qualunque');

    expect(await screen.findByText('Too many attempts. Wait a minute, then try again.')).toBeDefined();
    expect(screen.queryByText('That’s not the password. Try again?')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('mostra un messaggio generico, che non incolpa la password, per un errore che non è né di rete né di credenziali rifiutate', async () => {
    // "Email not confirmed" è un errore reale di Supabase, non riconducibile
    // né a un problema di rete né a una password sbagliata: prima della
    // correzione, describeAuthError lo presentava comunque come password
    // sbagliata perché il binario ricadeva lì per esclusione.
    mockSignIn(async () => ({ error: { message: 'Email not confirmed' } }));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await typeAndSubmit('qualunque');

    expect(
      await screen.findByText('Something went wrong signing in. Please try again in a moment.'),
    ).toBeDefined();
    expect(screen.queryByText('That’s not the password. Try again?')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
