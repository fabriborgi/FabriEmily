import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TriviaBoard } from './TriviaBoard';
import { TIMER_SECONDS, type MatchState } from './match';
import type { Question } from './questions';
import type { Match } from '../types';

const createMatch = vi.fn();
const makeMove = vi.fn();
vi.mock('../queries', () => ({
  createMatch: (...a: unknown[]) => createMatch(...a),
  makeMove: (...a: unknown[]) => makeMove(...a),
}));

const useActiveMatch = vi.fn();
vi.mock('../useActiveMatch', () => ({ useActiveMatch: (...args: unknown[]) => useActiveMatch(...args) }));

const useGameHistory = vi.fn();
vi.mock('../useGameHistory', () => ({ useGameHistory: (...args: unknown[]) => useGameHistory(...args) }));

const baseState = { loading: false, error: null, offline: false, refetch: vi.fn() };
const baseHistory = { ...baseState, data: { fabrizio: 0, emily: 0, draws: 0 } };

const q = (correctIndex: 0 | 1 | 2 | 3, prompt = 'domanda'): Question => ({
  prompt,
  options: ['a', 'b', 'c', 'd'],
  correctIndex,
});

const stateWith = (over: Partial<MatchState> = {}): MatchState => ({
  questions: Array(10).fill(null).map((_, i) => q(0, `domanda ${i}`)),
  answers: Array(10).fill(null),
  currentIndex: 0,
  ...over,
});

const openMatch = (
  over: Partial<Match> & { matchState?: Partial<MatchState> } = {},
): Match => ({
  id: 'm1',
  game_type: 'trivia',
  state: stateWith(over.matchState),
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-22T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('TriviaBoard', () => {
  beforeEach(() => {
    // Il countdown usa setInterval: senza timer finti ogni test aspetterebbe
    // secondi veri. vi.advanceTimersByTimeAsync (usato più sotto) fa avanzare
    // sia il timer sia le promesse che scatena, incluso l'await su makeMove.
    // Solo setInterval/clearInterval sono finti: se si finge anche setTimeout,
    // il polling interno di waitFor() di testing-library (che usa setTimeout
    // reale) si blocca per 5s finché non scade il timeout del test.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    createMatch.mockReset();
    makeMove.mockReset();
    useActiveMatch.mockReset();
    useGameHistory.mockReset();
    useGameHistory.mockReturnValue(baseHistory);
    createMatch.mockResolvedValue({ data: null, error: null });
    makeMove.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nessuna partita attiva: mostra "New game"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "trivia"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TriviaBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('trivia');
    expect(useGameHistory).toHaveBeenCalledWith('trivia');
  });

  it('avviando una partita, chiama createMatch con uno stato di 10 domande', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TriviaBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    const [gameType, person, initialState] = createMatch.mock.calls[0];
    expect(gameType).toBe('trivia');
    expect(person).toBe('emily');
    expect(initialState.questions).toHaveLength(10);
    expect(initialState.answers).toEqual(Array(10).fill(null));
    expect(initialState.currentIndex).toBe(0);
  });

  it('partita attiva, il mio turno: mostra la domanda, le opzioni e il countdown', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.getByText('domanda 0')).toBeDefined();
    expect(screen.getByText(`${TIMER_SECONDS}s`)).toBeDefined();
    expect(screen.getByRole('button', { name: 'a' }).getAttribute('disabled')).toBeNull();
  });

  it('partita attiva, non il mio turno: le opzioni sono disabilitate, nessun countdown', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.queryByText(`${TIMER_SECONDS}s`)).toBeNull();
    for (const label of ['a', 'b', 'c', 'd']) {
      expect(screen.getByRole('button', { name: label }).getAttribute('disabled')).not.toBeNull();
    }
  });

  it("scegliendo una risposta non all'ultima domanda, chiama makeMove senza risultato", async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TriviaBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'a' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [matchId, person, nextState, result, winner] = makeMove.mock.calls[0];
    expect(matchId).toBe('m1');
    expect(person).toBe('fabrizio');
    expect(nextState.answers[0]).toBe(0);
    expect(nextState.currentIndex).toBe(1);
    expect(result).toBeNull();
    expect(winner).toBeNull();
  });

  it("rispondendo all'ultima domanda, chiude la partita con il vincitore corretto", async () => {
    const questions = Array(10).fill(null).map((_, i) => q(0, `domanda ${i}`));
    // fabrizio (indici pari, 5 risposte) sempre corretto; emily (indici
    // dispari, 4 risposte finora) sempre corretta anche lei -> 5 a 4 prima
    // dell'ultima domanda, che tocca a emily (indice 9, dispari).
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, 0, null];
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ matchState: { questions, answers, currentIndex: 9 }, current_turn: 'emily' }),
    });
    render(<TriviaBoard who="emily" />);
    screen.getByRole('button', { name: 'b' }).click(); // risposta sbagliata (corretta è 'a', indice 0)
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, , , result, winner] = makeMove.mock.calls[0];
    expect(result).toBe('win');
    expect(winner).toBe('fabrizio');
  });

  it('allo scadere del tempo, invia automaticamente una risposta nulla', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TriviaBoard who="fabrizio" />);
    await vi.advanceTimersByTimeAsync(TIMER_SECONDS * 1000);
    expect(makeMove).toHaveBeenCalled();
    const [, , nextState] = makeMove.mock.calls[0];
    expect(nextState.answers[0]).toBeNull();
  });

  it('il countdown riparte da 10s quando arriva una nuova domanda', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    const { rerender } = render(<TriviaBoard who="fabrizio" />);
    await vi.advanceTimersByTimeAsync(4000);
    expect(screen.getByText('6s')).toBeDefined();
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ matchState: { currentIndex: 1 } }),
    });
    rerender(<TriviaBoard who="fabrizio" />);
    expect(screen.getByText(`${TIMER_SECONDS}s`)).toBeDefined();
  });

  it('rispondendo poco prima della scadenza, il timer non invia comunque una seconda mossa', async () => {
    // Simula la finestra fra makeMove che ha successo e l'arrivo
    // dell'aggiornamento realtime: il mock di useActiveMatch resta invariato
    // (come se il refetch non fosse ancora arrivato), quindi myTurn e
    // currentIndex non cambiano finché il test non lo decide esplicitamente.
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TriviaBoard who="fabrizio" />);
    await vi.advanceTimersByTimeAsync(9000);
    screen.getByRole('button', { name: 'a' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect(makeMove).toHaveBeenCalledTimes(1);
  });

  it('due tocchi rapidi su risposte diverse inviano una sola mossa', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TriviaBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'a' }).click();
    screen.getByRole('button', { name: 'b' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    expect(makeMove).toHaveBeenCalledTimes(1);
  });

  it('mostra il punteggio parziale della partita in corso', () => {
    const questions = Array(10).fill(null).map((_, i) => q(0, `domanda ${i}`));
    const answers = [0, 1, null, null, null, null, null, null, null, null];
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ matchState: { questions, answers, currentIndex: 2 } }),
    });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.getByText(/Fabrizio 1 – Emily 0/)).toBeDefined();
  });

  it('mostra il tally delle partite vinte/pareggiate con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 1 } });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 1 draws')).toBeDefined();
  });

  it('partita chiusa con vittoria di chi guarda: mostra "You won!" e "New game"', () => {
    const questions = Array(10).fill(null).map((_, i) => q(0, `domanda ${i}`));
    const answers = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({
        matchState: { questions, answers, currentIndex: 10 },
        closed_at: '2026-08-22T10:05:00Z',
        winner: 'fabrizio',
      }),
    });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
    expect(screen.queryByText(`${TIMER_SECONDS}s`)).toBeNull();
  });

  it('partita chiusa in pareggio: mostra "It\'s a draw."', () => {
    const questions = Array(10).fill(null).map((_, i) => q(0, `domanda ${i}`));
    const answers = Array(10).fill(0); // tutti corretti: 5 a testa
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({
        matchState: { questions, answers, currentIndex: 10 },
        closed_at: '2026-08-22T10:05:00Z',
        winner: null,
      }),
    });
    render(<TriviaBoard who="fabrizio" />);
    expect(screen.getByText("It's a draw.")).toBeDefined();
  });
});
