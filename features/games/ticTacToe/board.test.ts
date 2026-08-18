import { describe, it, expect } from 'vitest';
import { EMPTY_BOARD, isLegalMove, applyMove, winnerOf, isDraw, type BoardState } from './board';

type Mark = 'fabrizio' | 'emily' | null;
const cells = (...marks: Mark[]): BoardState => ({ cells: marks });

describe('board del Tris', () => {
  it('una cella vuota è una mossa legale', () => {
    expect(isLegalMove(EMPTY_BOARD, 4)).toBe(true);
  });

  it('una cella occupata non è una mossa legale', () => {
    const state = applyMove(EMPTY_BOARD, 0, 'fabrizio');
    expect(isLegalMove(state, 0)).toBe(false);
  });

  it('un indice fuori dai limiti non è una mossa legale', () => {
    expect(isLegalMove(EMPTY_BOARD, 9)).toBe(false);
    expect(isLegalMove(EMPTY_BOARD, -1)).toBe(false);
  });

  it('applyMove non muta lo stato originale', () => {
    const next = applyMove(EMPTY_BOARD, 0, 'fabrizio');
    expect(EMPTY_BOARD.cells[0]).toBeNull();
    expect(next.cells[0]).toBe('fabrizio');
  });

  it('riconosce la vittoria su tutte le otto combinazioni possibili', () => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const line of lines) {
      const marks: Mark[] = Array(9).fill(null);
      for (const i of line) marks[i] = 'emily';
      expect(winnerOf(cells(...marks))).toBe('emily');
    }
  });

  it('nessun vincitore su una griglia vuota', () => {
    expect(winnerOf(EMPTY_BOARD)).toBeNull();
  });

  it('nessun vincitore su una griglia parziale senza allineamenti', () => {
    expect(
      winnerOf(cells('fabrizio', 'emily', 'fabrizio', 'emily', 'fabrizio', 'emily', null, null, null)),
    ).toBeNull();
  });

  it('riconosce il pareggio: griglia piena senza vincitore', () => {
    const full = cells(
      'fabrizio', 'emily', 'fabrizio',
      'emily', 'emily', 'fabrizio',
      'emily', 'fabrizio', 'emily',
    );
    expect(winnerOf(full)).toBeNull();
    expect(isDraw(full)).toBe(true);
  });

  it('non è un pareggio se la griglia non è piena', () => {
    expect(isDraw(EMPTY_BOARD)).toBe(false);
  });

  it("non è un pareggio se c'è un vincitore, anche a griglia piena", () => {
    const full = cells(
      'emily', 'emily', 'emily',
      'fabrizio', 'fabrizio', 'emily',
      'fabrizio', 'emily', 'fabrizio',
    );
    expect(winnerOf(full)).toBe('emily');
    expect(isDraw(full)).toBe(false);
  });
});
