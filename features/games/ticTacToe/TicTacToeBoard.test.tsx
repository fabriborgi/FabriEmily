import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TicTacToeBoard } from './TicTacToeBoard';
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

const openMatch = (over: Partial<Match> & { cells?: Array<string | null> } = {}): Match => ({
  id: 'm1',
  game_type: 'tic_tac_toe',
  state: { cells: over.cells ?? Array(9).fill(null) },
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-20T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('TicTacToeBoard', () => {
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
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "tic_tac_toe"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('tic_tac_toe');
    expect(useGameHistory).toHaveBeenCalledWith('tic_tac_toe');
  });

  it('avviando una partita, chiama createMatch con la griglia vuota', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<TicTacToeBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() =>
      expect(createMatch).toHaveBeenCalledWith('tic_tac_toe', 'emily', { cells: Array(9).fill(null) }),
    );
  });

  it('partita attiva, il mio turno: le celle sono cliccabili', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText('Your turn')).toBeDefined();
    expect(screen.getByRole('button', { name: /^Cell 1,/ }).getAttribute('disabled')).toBeNull();
  });

  it('partita attiva, non il mio turno: le celle sono disabilitate', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<TicTacToeBoard who="fabrizio" />);
    for (const cell of screen.getAllByRole('button', { name: /^Cell \d/ })) {
      expect(cell.getAttribute('disabled')).not.toBeNull();
    }
  });

  it('muovendo su una cella vuota nel proprio turno, calcola lo stato e chiama makeMove', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TicTacToeBoard who="fabrizio" />);
    screen.getByRole('button', { name: /^Cell 1,/ }).click();
    await waitFor(() =>
      expect(makeMove).toHaveBeenCalledWith(
        'm1',
        'fabrizio',
        { cells: ['fabrizio', null, null, null, null, null, null, null, null] },
        null,
        null,
      ),
    );
  });

  it('una mossa che completa una riga vincente chiama makeMove con result "win"', async () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ cells: ['fabrizio', 'fabrizio', null, 'emily', 'emily', null, null, null, null] }),
    });
    render(<TicTacToeBoard who="fabrizio" />);
    screen.getByRole('button', { name: /^Cell 3,/ }).click();
    await waitFor(() =>
      expect(makeMove).toHaveBeenCalledWith(
        'm1',
        'fabrizio',
        { cells: ['fabrizio', 'fabrizio', 'fabrizio', 'emily', 'emily', null, null, null, null] },
        'win',
        'fabrizio',
      ),
    );
  });

  it('mostra il tally di vittorie/pareggi con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 1 } });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 1 draws')).toBeDefined();
  });

  it('due tocchi rapidi sulla stessa cella inviano una sola mossa', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<TicTacToeBoard who="fabrizio" />);
    const cell = screen.getByRole('button', { name: /^Cell 1,/ });
    cell.click();
    cell.click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    expect(makeMove).toHaveBeenCalledTimes(1);
  });

  it('partita appena chiusa con vittoria di chi guarda: mostra "You won!" e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ closed_at: '2026-08-20T10:05:00Z', winner: 'fabrizio' }),
    });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /^Cell \d/ })).toHaveLength(0);
  });

  it('partita appena chiusa con vittoria dell\'altro: mostra "Emily won." e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ closed_at: '2026-08-20T10:05:00Z', winner: 'emily' }),
    });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText('Emily won.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /^Cell \d/ })).toHaveLength(0);
  });

  it('partita appena chiusa in pareggio: mostra "It\'s a draw." e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ closed_at: '2026-08-20T10:05:00Z', winner: null }),
    });
    render(<TicTacToeBoard who="fabrizio" />);
    expect(screen.getByText("It's a draw.")).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /^Cell \d/ })).toHaveLength(0);
  });
});
