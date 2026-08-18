import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QuestionCard } from './QuestionCard';
import type { CurrentRound } from './queries';

const answerQuestion = vi.fn();
const skipQuestion = vi.fn();
vi.mock('./queries', () => ({
  answerQuestion: (...a: unknown[]) => answerQuestion(...a),
  skipQuestion: (...a: unknown[]) => skipQuestion(...a),
}));

const round = (): CurrentRound => ({
  round: {
    id: 'r1',
    question_id: 'q1',
    drawn_by: 'fabrizio',
    drawn_at: '2026-08-18T10:00:00Z',
    closed_at: null,
    closed_reason: null,
    closed_by: null,
  },
  question: { id: 'q1', category: 'deep', body: 'What matters most to you?' },
});

const type = (value: string) => {
  const box = screen.getByRole('textbox') as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!;
  setter.call(box, value);
  box.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * jsdom, in questa configurazione, non espone window.localStorage — stesso
 * problema già documentato in AuthGate.test.tsx (F0+F1): va sostituito con
 * un'implementazione in memoria.
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

describe('QuestionCard', () => {
  beforeEach(() => {
    answerQuestion.mockReset();
    skipQuestion.mockReset();
    answerQuestion.mockResolvedValue({ data: { round_id: 'r1' }, error: null });
    skipQuestion.mockResolvedValue({ data: true, error: null });
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('mostra la categoria e il testo della domanda', () => {
    render(<QuestionCard round={round()} who="fabrizio" />);
    expect(screen.getByText('Deep')).toBeDefined();
    expect(screen.getByText('What matters most to you?')).toBeDefined();
  });

  it('non permette di rispondere a vuoto', () => {
    render(<QuestionCard round={round()} who="fabrizio" />);
    expect(screen.getByRole('button', { name: /Answer/ }).getAttribute('disabled')).not.toBeNull();
  });

  it('rispondendo, chiama answerQuestion con l’identità corrente', async () => {
    render(<QuestionCard round={round()} who="emily" />);
    type('my honest answer');
    screen.getByRole('button', { name: /Answer/ }).click();
    await waitFor(() =>
      expect(answerQuestion).toHaveBeenCalledWith('r1', 'emily', 'my honest answer'),
    );
  });

  it('dopo aver risposto, mostra l’attesa e non più il modulo', async () => {
    render(<QuestionCard round={round()} who="fabrizio" />);
    type('risposta');
    screen.getByRole('button', { name: /Answer/ }).click();
    await waitFor(() => expect(screen.getByText(/Waiting for your partner/)).toBeDefined());
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('già risposto localmente: mostra subito l’attesa, senza chiamare la RPC', () => {
    window.localStorage.setItem('fe.answered-round', 'r1');
    render(<QuestionCard round={round()} who="fabrizio" />);
    expect(screen.getByText(/Waiting for your partner/)).toBeDefined();
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it('already_answered dal server passa all’attesa invece di mostrare un errore', async () => {
    answerQuestion.mockResolvedValue({ data: null, error: "You've already answered this one." });
    render(<QuestionCard round={round()} who="fabrizio" />);
    type('risposta');
    screen.getByRole('button', { name: /Answer/ }).click();
    await waitFor(() => expect(screen.getByText(/Waiting for your partner/)).toBeDefined());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un vero errore resta visibile, e il testo non si perde', async () => {
    answerQuestion.mockResolvedValue({ data: null, error: 'No connection. Your work is still here — try again.' });
    render(<QuestionCard round={round()} who="fabrizio" />);
    type('una risposta lunga che non voglio riscrivere');
    screen.getByRole('button', { name: /Answer/ }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'una risposta lunga che non voglio riscrivere',
    );
  });

  it('due tocchi rapidi su Answer inviano una sola risposta', async () => {
    render(<QuestionCard round={round()} who="fabrizio" />);
    type('risposta');
    const button = screen.getByRole('button', { name: /Answer/ });
    button.click();
    button.click();
    await waitFor(() => expect(answerQuestion).toHaveBeenCalled());
    expect(answerQuestion).toHaveBeenCalledTimes(1);
  });

  it('skip chiama skipQuestion con l’identità corrente', async () => {
    render(<QuestionCard round={round()} who="emily" />);
    screen.getByRole('button', { name: 'Skip' }).click();
    await waitFor(() => expect(skipQuestion).toHaveBeenCalledWith('r1', 'emily'));
  });
});
