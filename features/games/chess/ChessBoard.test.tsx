import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChessBoard } from './ChessBoard';
import { initialState, applyMove } from './board';
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
  over: Partial<Match> & { boardState?: BoardState } = {},
): Match => ({
  id: 'm1',
  game_type: 'chess',
  state: over.boardState ?? initialState(),
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-28T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('ChessBoard', () => {
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
    render(<ChessBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "chess"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<ChessBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('chess');
    expect(useGameHistory).toHaveBeenCalledWith('chess');
  });

  it('avviando una partita, chiama createMatch con la disposizione iniziale standard', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<ChessBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    const [gameType, person, initialBoardState] = createMatch.mock.calls[0];
    expect(gameType).toBe('chess');
    expect(person).toBe('emily');
    expect(initialBoardState).toEqual(initialState());
  });

  it('selezionando una propria pedina nel proprio turno, evidenzia le caselle di arrivo legali', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<ChessBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: /^e2,/ }));
    const target = screen.getByRole('button', { name: /^e4,/ }) as HTMLButtonElement;
    expect(target.disabled).toBe(false);
    fireEvent.click(target);
  });

  it('selezionando una pedina e poi la casella di arrivo, chiama makeMove con la mossa applicata', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<ChessBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: /^e2,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^e4,/ }));
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [matchId, person, nextState, result, winner] = makeMove.mock.calls[0];
    expect(matchId).toBe('m1');
    expect(person).toBe('fabrizio');
    expect(nextState).toEqual(applyMove(initialState(), { row: 1, col: 4 }, { row: 3, col: 4 }));
    expect(result).toBeNull();
    expect(winner).toBeNull();
  });

  it('non il mio turno: le pedine non sono selezionabili', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<ChessBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: /^e2,/ }));
    expect(screen.queryByText('Check!')).toBeNull();
    expect(makeMove).not.toHaveBeenCalled();
  });

  it('una mossa che raggiunge l\'ultima riga con un pedone apre il selettore di promozione', () => {
    const boardState: BoardState = initialState();
    // Scacchiera pulita col solo pedone bianco pronto a promuovere su a7->a8.
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) boardState.board[r][c] = null;
    boardState.board[0][4] = { type: 'king', color: 'white' };
    boardState.board[7][4] = { type: 'king', color: 'black' };
    boardState.board[6][0] = { type: 'pawn', color: 'white' };
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ boardState }) });
    render(<ChessBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: /^a7,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));
    expect(screen.getByRole('button', { name: 'Promote to queen' })).toBeDefined();
    expect(makeMove).not.toHaveBeenCalled();
  });

  it('scegliendo il pezzo di promozione, invia la mossa con quel pezzo', async () => {
    const boardState: BoardState = initialState();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) boardState.board[r][c] = null;
    boardState.board[0][4] = { type: 'king', color: 'white' };
    boardState.board[7][4] = { type: 'king', color: 'black' };
    boardState.board[6][0] = { type: 'pawn', color: 'white' };
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ boardState }) });
    render(<ChessBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: /^a7,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Promote to rook' }));
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, , nextState] = makeMove.mock.calls[0];
    expect(nextState.board[7][0]).toEqual({ type: 'rook', color: 'white' });
  });

  it('quando chi è di turno è sotto scacco, mostra il banner "Check!"', () => {
    const boardState: BoardState = initialState();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) boardState.board[r][c] = null;
    boardState.board[0][4] = { type: 'king', color: 'white' };
    boardState.board[7][4] = { type: 'king', color: 'black' };
    boardState.board[0][0] = { type: 'rook', color: 'black' }; // attacca lungo la riga 0
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ boardState, current_turn: 'fabrizio' }) });
    render(<ChessBoard who="fabrizio" />);
    expect(screen.getByText('Check!')).toBeDefined();
  });

  it('mostra il tally delle partite vinte con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 1 } });
    render(<ChessBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 1 draws')).toBeDefined();
  });

  it('partita chiusa per scacco matto: la scacchiera resta visibile con la casella del re sotto matto evidenziata', () => {
    // Matto del corridoio già verificato in board.test.ts: re bianco g1 sotto matto.
    const boardState: BoardState = initialState();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) boardState.board[r][c] = null;
    boardState.board[0][6] = { type: 'king', color: 'white' };
    boardState.board[1][5] = { type: 'pawn', color: 'white' };
    boardState.board[1][6] = { type: 'pawn', color: 'white' };
    boardState.board[1][7] = { type: 'pawn', color: 'white' };
    boardState.board[0][4] = { type: 'rook', color: 'black' };
    boardState.board[7][4] = { type: 'king', color: 'black' };
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState, closed_at: '2026-08-28T10:30:00Z', winner: 'emily' }),
    });
    render(<ChessBoard who="fabrizio" />);
    expect(screen.getByText('Emily won.')).toBeDefined();
    // La casella del re sotto matto porta un'indicazione testuale/accessibile dedicata,
    // non solo una classe CSS — verificabile senza dipendere dai nomi generati dai CSS Modules.
    expect(screen.getByRole('button', { name: /^g1,.*king in check/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('partita chiusa per stallo: mostra "It\'s a draw." e nessuna casella evidenziata per matto', () => {
    const boardState: BoardState = initialState();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) boardState.board[r][c] = null;
    boardState.board[7][0] = { type: 'king', color: 'black' };
    boardState.board[6][2] = { type: 'king', color: 'white' };
    boardState.board[5][1] = { type: 'queen', color: 'white' };
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState, closed_at: '2026-08-28T10:30:00Z', winner: null }),
    });
    render(<ChessBoard who="fabrizio" />);
    expect(screen.getByText("It's a draw.")).toBeDefined();
  });
});
