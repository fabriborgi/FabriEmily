import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NewLetterPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'emily', partner: 'fabrizio', setWho: vi.fn(), forget: vi.fn() }),
}));

const sendText = vi.fn();
vi.mock('@/features/letters/queries', () => ({ sendText: (...a: unknown[]) => sendText(...a) }));

// L'assegnazione diretta `box.value = value` passa dal setter che React ha già
// avvolto per il value-tracking: il tracker si aggiorna insieme al DOM, quindi il
// successivo evento 'input' non risulta un cambiamento e onChange non scatta mai.
// Bisogna passare dal setter nativo (quello del prototipo, non avvolto) per far sì
// che React, confrontando il valore tracciato con quello reale del nodo, rilevi la
// differenza e invochi onChange — esattamente ciò che fireEvent.change fa internamente.
const type = (value: string) => {
  const box = screen.getByRole('textbox') as HTMLTextAreaElement;
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!;
  nativeSetter.call(box, value);
  box.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('composer di testo', () => {
  beforeEach(() => {
    push.mockReset();
    sendText.mockReset();
    sendText.mockResolvedValue({ data: { id: 'x' }, error: null });
  });

  it('non permette di inviare una lettera vuota', () => {
    render(<NewLetterPage />);
    expect(screen.getByRole('button', { name: /Send/ }).getAttribute('disabled')).not.toBeNull();
  });

  it('invia il testo firmandolo con l’identità corrente', async () => {
    render(<NewLetterPage />);
    type('Buffalo is far but not that far.');
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(sendText).toHaveBeenCalledWith('emily', 'Buffalo is far but not that far.'));
  });

  it('porta all’archivio quando l’invio riesce', async () => {
    render(<NewLetterPage />);
    type('ok');
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/letters'));
  });

  it('in caso di errore mostra il messaggio e NON perde il testo', async () => {
    sendText.mockResolvedValue({ data: null, error: 'No connection. Your work is still here — try again.' });
    render(<NewLetterPage />);
    type('una lettera lunga che non voglio riscrivere');
    screen.getByRole('button', { name: /Send/ }).click();

    await waitFor(() => expect(screen.getByText(/No connection/)).toBeDefined());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'una lettera lunga che non voglio riscrivere',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('due tocchi rapidi inviano una sola lettera', async () => {
    // Il disabled del pulsante dipende da un re-render: fra due tocchi molto
    // ravvicinati React puo' non averlo ancora eseguito, e nell'app non esiste
    // modo di cancellare una lettera mandata due volte.
    render(<NewLetterPage />);
    type('una lettera che non voglio spedire due volte');
    const button = screen.getByRole('button', { name: /Send/ });
    button.click();
    button.click();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it('dopo un errore si puo riprovare', async () => {
    sendText.mockResolvedValueOnce({ data: null, error: 'Something went wrong. Please try again.' });
    render(<NewLetterPage />);
    type('un tentativo che fallisce e poi riesce');
    const button = screen.getByRole('button', { name: /Send/ });
    button.click();
    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeDefined());

    sendText.mockResolvedValueOnce({ data: { id: 'x' }, error: null });
    button.click();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/letters'));
    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it('svuota il campo dopo un invio riuscito', async () => {
    // Tornando indietro col gesto del browser Next puo' riusare questa istanza:
    // ritrovarsi il testo gia' spedito invita a rimandarlo per sbaglio.
    render(<NewLetterPage />);
    type('questa parte davvero');
    screen.getByRole('button', { name: /Send/ }).click();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/letters'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('dice quanto manca per guadagnare le monete', () => {
    render(<NewLetterPage />);
    type('short');
    expect(screen.getByText(/35 more characters/)).toBeDefined();
  });

  it('conferma la ricompensa quando la lunghezza è sufficiente', () => {
    render(<NewLetterPage />);
    type('a'.repeat(40));
    expect(screen.getByText(/worth 15 coins/)).toBeDefined();
  });
});
