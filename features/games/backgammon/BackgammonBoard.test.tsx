import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BackgammonBoard } from './BackgammonBoard';
import { initialState } from './board';
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
  game_type: 'backgammon',
  state: over.boardState ?? initialState(over.started_by ?? 'fabrizio'),
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-27T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('BackgammonBoard', () => {
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
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "backgammon"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<BackgammonBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('backgammon');
    expect(useGameHistory).toHaveBeenCalledWith('backgammon');
  });

  it('avviando una partita, chiama createMatch con la disposizione iniziale standard', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<BackgammonBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    const [gameType, person, initialBoardState] = createMatch.mock.calls[0];
    expect(gameType).toBe('backgammon');
    expect(person).toBe('emily');
    expect(initialBoardState).toEqual(initialState('emily'));
  });

  it('il mio turno: il pulsante "Roll dice" tira i dadi localmente', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDefined();
  });

  it('non il mio turno: nessun pulsante "Roll dice"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.queryByRole('button', { name: 'Roll dice' })).toBeNull();
  });

  it('tirando i dadi con Math.random forzato, poi scegliendo dado e pedina, chiama makeMove con la mossa applicata', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // entrambi i dadi = 4 (1+floor(0.5*6)=4)
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    // `fireEvent.click` (invece del `.click()` nativo) perché servono riquery
    // sincrone in fila, ciascuna sul DOM aggiornato dal click precedente —
    // vedi lo stesso accorgimento in QuoridorBoard.test.tsx.
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    // Doppio 4: 4 dadi da 4. Sceglie il primo dado, poi la pedina sul 24 (fabrizio, disposizione standard).
    // Doppio 4: le 4 possibilità di dado risultano tutte etichettate "Die 4" —
    // sono equivalenti, si sceglie la prima.
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Point 24/ }));
    randomSpy.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [matchId, person, nextState, result, winner] = makeMove.mock.calls[0];
    expect(matchId).toBe('m1');
    expect(person).toBe('fabrizio');
    expect(nextState.points[24]).toEqual({ owner: 'fabrizio', count: 1 });
    expect(nextState.points[20]).toEqual({ owner: 'fabrizio', count: 1 });
    expect(result).toBeNull();
    expect(winner).toBeNull();
  });

  it('"Reset turn" scarta le mosse locali e fa ripartire dal tiro originale', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    // Doppio 4: le 4 possibilità di dado risultano tutte etichettate "Die 4" —
    // sono equivalenti, si sceglie la prima.
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Point 24/ }));
    randomSpy.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Reset turn' }));
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
  });

  it('con pedine sulla barra, solo "Enter from bar" è selezionabile, non i punti normali', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // doppio 4
    const boardState = initialState('fabrizio');
    boardState.bar.fabrizio = 1;
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ boardState }) });
    render(<BackgammonBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    // Con la barra occupata, i punti normali restano disabilitati anche se in
    // disposizione standard fabrizio ha già pedine sul 24.
    expect((screen.getByRole('button', { name: /Point 24/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Enter from bar' }));
    randomSpy.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [, , nextState] = makeMove.mock.calls[0];
    expect(nextState.bar.fabrizio).toBe(0);
    // Dalla barra (25), un dado 4 in direzione decrescente rientra sul 21.
    expect(nextState.points[21]).toEqual({ owner: 'fabrizio', count: 1 });
  });

  it('a fine turno (dadi esauriti), "Roll dice" scompare e non si può più ritirare cancellando il turno', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // doppio 4
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    // Gioca i 4 dadi da 4 su quattro pedine diverse di fabrizio (24, 13, 8, 6 nella
    // disposizione standard), tutte mosse indipendenti verso caselle libere — evita
    // di incatenare la stessa pedina su una casella che potrebbe poi risultare bloccata.
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Point 24/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Point 13/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Point 8/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Die 4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Point 6/ }));
    randomSpy.mockRestore();
    // Con i 4 dadi consumati, "Roll dice" non deve ricomparire: un secondo tap
    // accidentale non deve poter ritirare i dadi e cancellare il turno appena giocato.
    expect(screen.queryByRole('button', { name: 'Roll dice' })).toBeNull();
    expect(screen.getByRole('button', { name: 'End turn' })).toBeDefined();
  });

  it('mostra il tally delle partite vinte con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 0 } });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 0 draws')).toBeDefined();
  });

  it('partita chiusa: mostra il vincitore e "New game"', () => {
    const closedState: BoardState = {
      points: {},
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 15, emily: 8 },
    };
    for (let p = 1; p <= 24; p++) closedState.points[p] = null;
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState: closedState, closed_at: '2026-08-27T10:30:00Z', winner: 'fabrizio' }),
    });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
