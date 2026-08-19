import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GooseBoard } from './GooseBoard';
import type { Match } from '../types';
import type { BoardState } from './board';

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

const openMatch = (
  over: Partial<Match> & { boardState?: Partial<BoardState> } = {},
): Match => ({
  id: 'm1',
  game_type: 'goose',
  state: {
    positions: { fabrizio: 0, emily: 0 },
    stuck: { fabrizio: 0, emily: 0 },
    lastRoll: null,
    ...over.boardState,
  },
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-25T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('GooseBoard', () => {
  beforeEach(() => {
    createMatch.mockReset();
    makeMove.mockReset();
    useActiveMatch.mockReset();
    useGameHistory.mockReset();
    useGameHistory.mockReturnValue(baseHistory);
    createMatch.mockResolvedValue({ data: null, error: null });
    makeMove.mockResolvedValue({ data: null, error: null });
  });

  it('nessuna partita attiva: mostra "New game"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<GooseBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "goose"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<GooseBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('goose');
    expect(useGameHistory).toHaveBeenCalledWith('goose');
  });

  it('avviando una partita, chiama createMatch con lo stato iniziale', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<GooseBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    const [gameType, person, initialState] = createMatch.mock.calls[0];
    expect(gameType).toBe('goose');
    expect(person).toBe('emily');
    expect(initialState).toEqual({
      positions: { fabrizio: 0, emily: 0 },
      stuck: { fabrizio: 0, emily: 0 },
      lastRoll: null,
    });
  });

  it('il mio turno, non bloccato: tirando i dadi chiama makeMove con la nuova posizione', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<GooseBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'Roll dice' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [matchId, person, nextState] = makeMove.mock.calls[0];
    expect(matchId).toBe('m1');
    expect(person).toBe('fabrizio');
    // Somma di 2 dadi: minimo 2, massimo 12 — da posizione 0 non ci sono
    // caselle speciali fra 2 e 12 tranne 5 e 9 (oche, che incatenano oltre),
    // quindi il range resta valido indipendentemente dal tiro casuale.
    expect(nextState.positions.fabrizio).toBeGreaterThanOrEqual(2);
  });

  it('non il mio turno: il pulsante è disabilitato', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<GooseBoard who="fabrizio" />);
    expect((screen.getByRole('button', { name: 'Roll dice' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('bloccato: il pulsante diventa "Skip turn" e non tira i dadi, solo scala il contatore', async () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState: { positions: { fabrizio: 31, emily: 0 }, stuck: { fabrizio: 2, emily: 0 } } }),
    });
    render(<GooseBoard who="fabrizio" />);
    expect(screen.getByText('You’re stuck for 2 more turns.')).toBeDefined();
    screen.getByRole('button', { name: 'Skip turn' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, , nextState] = makeMove.mock.calls[0];
    expect(nextState.positions.fabrizio).toBe(31);
    expect(nextState.stuck.fabrizio).toBe(1);
  });

  it('raggiungendo la casella 63, chiude la partita dichiarando la vittoria', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // entrambi i dadi = 1, somma 2
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState: { positions: { fabrizio: 61, emily: 0 }, stuck: { fabrizio: 0, emily: 0 } } }),
    });
    render(<GooseBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'Roll dice' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, , nextState, result, winner] = makeMove.mock.calls[0];
    expect(nextState.positions.fabrizio).toBe(63);
    expect(result).toBe('win');
    expect(winner).toBe('fabrizio');
    randomSpy.mockRestore();
  });

  it('due tocchi rapidi inviano una sola mossa', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<GooseBoard who="fabrizio" />);
    const button = screen.getByRole('button', { name: 'Roll dice' });
    button.click();
    button.click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    expect(makeMove).toHaveBeenCalledTimes(1);
  });

  it('mostra il tally delle partite vinte con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 0 } });
    render(<GooseBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 0 draws')).toBeDefined();
  });

  it('partita chiusa: mostra il vincitore e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({
        boardState: { positions: { fabrizio: 63, emily: 40 }, stuck: { fabrizio: 0, emily: 0 } },
        closed_at: '2026-08-25T10:30:00Z',
        winner: 'fabrizio',
      }),
    });
    render(<GooseBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
