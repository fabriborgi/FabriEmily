import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QuoridorBoard } from './QuoridorBoard';
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
  game_type: 'quoridor',
  state: {
    positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 0, col: 0 } },
    walls: [],
    wallsRemaining: { fabrizio: 10, emily: 10 },
    ...over.boardState,
  },
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-26T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('QuoridorBoard', () => {
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
    render(<QuoridorBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "quoridor"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<QuoridorBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('quoridor');
    expect(useGameHistory).toHaveBeenCalledWith('quoridor');
  });

  it('avviando una partita, chiama createMatch con lo stato iniziale corretto per chi la avvia', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<QuoridorBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    const [gameType, person, initialBoardState] = createMatch.mock.calls[0];
    expect(gameType).toBe('quoridor');
    expect(person).toBe('emily');
    expect(initialBoardState.positions.emily).toEqual({ row: 0, col: 4 });
    expect(initialBoardState.positions.fabrizio).toEqual({ row: 8, col: 4 });
    expect(initialBoardState.wallsRemaining).toEqual({ fabrizio: 10, emily: 10 });
  });

  it('modalità Move: mostra il pulsante di modalità e le celle raggiungibili sono tappabili', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<QuoridorBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'Move' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Place wall' })).toBeDefined();
  });

  it('muovendo la pedina in una cella raggiungibile, chiama makeMove con la nuova posizione', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<QuoridorBoard who="fabrizio" />);
    // Da (4,4) senza muri, (3,4) è una delle celle raggiungibili.
    screen.getByRole('button', { name: /Row 4, column 5/ }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [matchId, person, nextState, result, winner] = makeMove.mock.calls[0];
    expect(matchId).toBe('m1');
    expect(person).toBe('fabrizio');
    expect(nextState.positions.fabrizio).toEqual({ row: 3, col: 4 });
    expect(result).toBeNull();
    expect(winner).toBeNull();
  });

  it('raggiungendo la riga obiettivo, chiude la partita dichiarando la vittoria', async () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState: { positions: { fabrizio: { row: 7, col: 4 }, emily: { row: 0, col: 0 } } } }),
    });
    render(<QuoridorBoard who="fabrizio" />);
    screen.getByRole('button', { name: /Row 9, column 5/ }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, , nextState, result, winner] = makeMove.mock.calls[0];
    expect(nextState.positions.fabrizio).toEqual({ row: 8, col: 4 });
    expect(result).toBe('win');
    expect(winner).toBe('fabrizio');
  });

  it('non il mio turno: nessuna cella è tappabile', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<QuoridorBoard who="fabrizio" />);
    const target = screen.getByRole('button', { name: /Row 4, column 5/ });
    expect((target as HTMLButtonElement).disabled).toBe(true);
  });

  it('passando a modalità Wall e scegliendo un\'intersezione e un orientamento, chiama makeMove col muro piazzato', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<QuoridorBoard who="fabrizio" />);
    // Nota: qui si usa `fireEvent.click` (invece del `.click()` nativo usato
    // altrove) perché servono tre riquery sincrone in fila, ciascuna sul
    // DOM aggiornato dal click precedente — `.click()` nativo, non tracciato
    // da `act`, può ritardare il flush di React oltre la query successiva.
    fireEvent.click(screen.getByRole('button', { name: 'Place wall' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wall anchor row 3, column 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vertical' }));
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, person, nextState, result, winner] = makeMove.mock.calls[0];
    expect(person).toBe('fabrizio');
    expect(nextState.walls).toEqual([{ row: 2, col: 2, orientation: 'vertical' }]);
    expect(nextState.wallsRemaining.fabrizio).toBe(9);
    expect(result).toBeNull();
    expect(winner).toBeNull();
  });

  it('mostra il tally delle partite vinte con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 0 } });
    render(<QuoridorBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 0 draws')).toBeDefined();
  });

  it('partita chiusa: mostra il vincitore e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({
        boardState: { positions: { fabrizio: { row: 8, col: 4 }, emily: { row: 0, col: 0 } } },
        closed_at: '2026-08-26T10:30:00Z',
        winner: 'fabrizio',
      }),
    });
    render(<QuoridorBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
