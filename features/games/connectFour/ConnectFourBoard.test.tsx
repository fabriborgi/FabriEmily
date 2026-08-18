import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConnectFourBoard } from './ConnectFourBoard';
import { COLUMNS, ROWS } from './board';
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
const EMPTY_CELLS = Array(COLUMNS * ROWS).fill(null);

const openMatch = (over: Partial<Match> & { cells?: Array<string | null> } = {}): Match => ({
  id: 'm1',
  game_type: 'connect_four',
  state: { cells: over.cells ?? EMPTY_CELLS },
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-21T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('ConnectFourBoard', () => {
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
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "connect_four"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('connect_four');
    expect(useGameHistory).toHaveBeenCalledWith('connect_four');
  });

  it('il simbolo di una pedina dipende da started_by, non da chi guarda', () => {
    const cells = [...EMPTY_CELLS];
    cells[(ROWS - 1) * COLUMNS + 0] = 'emily';
    cells[(ROWS - 1) * COLUMNS + 1] = 'fabrizio';
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ started_by: 'emily', cells }),
    });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: /Emily/ }).textContent).toBe('●');
    expect(screen.getByRole('button', { name: /Fabrizio/ }).textContent).toBe('○');
  });

  it('avviando una partita, chiama createMatch con la griglia 7×6 vuota', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<ConnectFourBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() =>
      expect(createMatch).toHaveBeenCalledWith('connect_four', 'emily', { cells: EMPTY_CELLS }),
    );
  });

  it('partita attiva, il mio turno: la colonna vuota è cliccabile', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByText('Your turn')).toBeDefined();
    expect(
      screen.getByRole('button', { name: /^Column 1, row 1,/ }).getAttribute('disabled'),
    ).toBeNull();
  });

  it('partita attiva, non il mio turno: tutte le colonne sono disabilitate', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<ConnectFourBoard who="fabrizio" />);
    for (const cell of screen.getAllByRole('button', { name: /^Column \d/ })) {
      expect(cell.getAttribute('disabled')).not.toBeNull();
    }
  });

  it('una colonna piena è disabilitata anche nel proprio turno', () => {
    const cells = [...EMPTY_CELLS];
    for (let row = 0; row < ROWS; row++) cells[row * COLUMNS + 0] = row % 2 === 0 ? 'fabrizio' : 'emily';
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ cells }) });
    render(<ConnectFourBoard who="fabrizio" />);
    for (const cell of screen.getAllByRole('button', { name: /^Column 1,/ })) {
      expect(cell.getAttribute('disabled')).not.toBeNull();
    }
  });

  it('toccando una colonna vuota, il pezzo cade nella riga più bassa e chiama makeMove', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<ConnectFourBoard who="fabrizio" />);
    screen.getByRole('button', { name: /^Column 1, row 1,/ }).click();
    const expected = [...EMPTY_CELLS];
    expected[(ROWS - 1) * COLUMNS + 0] = 'fabrizio';
    await waitFor(() =>
      expect(makeMove).toHaveBeenCalledWith('m1', 'fabrizio', { cells: expected }, null, null),
    );
  });

  it('una mossa che completa 4 in verticale chiama makeMove con result "win"', async () => {
    const cells = [...EMPTY_CELLS];
    for (let row = ROWS - 1; row >= ROWS - 3; row--) cells[row * COLUMNS + 0] = 'fabrizio';
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ cells }) });
    render(<ConnectFourBoard who="fabrizio" />);
    // La riga più in alto (row 1) è sempre vuota finché la colonna non è
    // piena — a differenza di un selettore generico su "row \d", è l'unico
    // che identifica una sola cella: le altre due righe vuote in questa
    // colonna soddisferebbero comunque un pattern non ancorato a una riga
    // precisa, causando un errore "multiple elements found" indipendente
    // dall'implementazione (play() usa solo la colonna, non la riga).
    screen.getByRole('button', { name: /^Column 1, row 1,/ }).click();
    const expected = [...cells];
    expected[(ROWS - 4) * COLUMNS + 0] = 'fabrizio';
    await waitFor(() =>
      expect(makeMove).toHaveBeenCalledWith('m1', 'fabrizio', { cells: expected }, 'win', 'fabrizio'),
    );
  });

  it('mostra il tally di vittorie/pareggi con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 1 } });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 1 draws')).toBeDefined();
  });

  it('due tocchi rapidi sulla stessa colonna inviano una sola mossa', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<ConnectFourBoard who="fabrizio" />);
    const cell = screen.getByRole('button', { name: /^Column 1, row 1,/ });
    cell.click();
    cell.click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    expect(makeMove).toHaveBeenCalledTimes(1);
  });

  it('partita appena chiusa con vittoria di chi guarda: mostra "You won!" e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ closed_at: '2026-08-21T10:05:00Z', winner: 'fabrizio' }),
    });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /^Column \d/ })).toHaveLength(0);
  });

  it('partita appena chiusa con vittoria dell\'altro: mostra "Emily won." e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ closed_at: '2026-08-21T10:05:00Z', winner: 'emily' }),
    });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByText('Emily won.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('partita appena chiusa in pareggio: mostra "It\'s a draw." e "New game"', () => {
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ closed_at: '2026-08-21T10:05:00Z', winner: null }),
    });
    render(<ConnectFourBoard who="fabrizio" />);
    expect(screen.getByText("It's a draw.")).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
