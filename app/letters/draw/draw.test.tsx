import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DrawPage from './page';
import type { Stroke } from '@/features/letters/strokes';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'emily', partner: 'fabrizio', setWho: vi.fn(), forget: vi.fn() }),
}));

const sendDrawing = vi.fn();
vi.mock('@/features/letters/queries', () => ({ sendDrawing: (...a: unknown[]) => sendDrawing(...a) }));

const clearDraft = vi.fn();
vi.mock('@/features/letters/draft', () => ({ clearDraft: (...a: unknown[]) => clearDraft(...a) }));

// La DrawingCanvas vera dipende dal contesto 2D del canvas, non disponibile in
// jsdom: qui basta una finta che rispetta lo stesso contratto (onSend/busy/error).
// Questo test non esercita il disegno a mano — verifica solo la guardia contro
// il doppio invio nella pagina, esattamente come composer.test.tsx fa per il testo.
const strokes: Stroke[] = [{ c: 0, w: 0, p: [0, 0, 10, 10] }];
vi.mock('@/features/letters/DrawingCanvas', () => ({
  DrawingCanvas: ({
    onSend,
    busy,
    error,
  }: {
    onSend: (s: Stroke[]) => void;
    busy: boolean;
    error?: string | null;
  }) => (
    <div>
      <button onClick={() => onSend(strokes)} disabled={busy}>
        {busy ? 'Sending…' : 'Send it'}
      </button>
      {error && <p>{error}</p>}
    </div>
  ),
}));

describe('pagina del disegno', () => {
  beforeEach(() => {
    push.mockReset();
    sendDrawing.mockReset();
    clearDraft.mockReset();
    sendDrawing.mockResolvedValue({ data: { id: 'x' }, error: null });
  });

  it('invia il disegno firmandolo con l’identità corrente', async () => {
    render(<DrawPage />);
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(sendDrawing).toHaveBeenCalledWith('emily', strokes));
  });

  it('porta all’archivio e cancella la bozza quando l’invio riesce', async () => {
    render(<DrawPage />);
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/letters'));
    expect(clearDraft).toHaveBeenCalled();
  });

  it('in caso di errore mostra il messaggio e NON cancella la bozza', async () => {
    sendDrawing.mockResolvedValue({
      data: null,
      error: 'No connection. Your work is still here — try again.',
    });
    render(<DrawPage />);
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(screen.getByText(/No connection/)).toBeDefined());
    expect(clearDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('due tocchi rapidi inviano un solo disegno', async () => {
    // Il disabled del pulsante dipende da un re-render: fra due tocchi molto
    // ravvicinati React puo' non averlo ancora eseguito, e nell'app non esiste
    // modo di cancellare un disegno mandato due volte.
    render(<DrawPage />);
    const button = screen.getByRole('button', { name: /Send/ });
    button.click();
    button.click();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(sendDrawing).toHaveBeenCalledTimes(1);
  });
});
