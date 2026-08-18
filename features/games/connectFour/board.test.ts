import { describe, it, expect } from 'vitest';
import { EMPTY_BOARD, COLUMNS, ROWS, isLegalMove, applyMove, winnerOf, isDraw, type BoardState } from './board';

type Mark = 'fabrizio' | 'emily' | null;
const cells = (...marks: Mark[]): BoardState => ({ cells: marks });

describe('board di Forza 4', () => {
  it('una colonna vuota è una mossa legale', () => {
    expect(isLegalMove(EMPTY_BOARD, 0)).toBe(true);
  });

  it('una colonna piena non è una mossa legale', () => {
    let state = EMPTY_BOARD;
    for (let i = 0; i < ROWS; i++) state = applyMove(state, 0, 'fabrizio');
    expect(isLegalMove(state, 0)).toBe(false);
  });

  it('una colonna fuori dai limiti non è una mossa legale', () => {
    expect(isLegalMove(EMPTY_BOARD, COLUMNS)).toBe(false);
    expect(isLegalMove(EMPTY_BOARD, -1)).toBe(false);
  });

  it('applyMove non muta lo stato originale', () => {
    const next = applyMove(EMPTY_BOARD, 0, 'fabrizio');
    expect(EMPTY_BOARD.cells[(ROWS - 1) * COLUMNS]).toBeNull();
    expect(next.cells[(ROWS - 1) * COLUMNS]).toBe('fabrizio');
  });

  it('un pezzo cade nella riga più bassa libera della colonna', () => {
    let state = applyMove(EMPTY_BOARD, 3, 'fabrizio');
    expect(state.cells[(ROWS - 1) * COLUMNS + 3]).toBe('fabrizio');
    state = applyMove(state, 3, 'emily');
    expect(state.cells[(ROWS - 2) * COLUMNS + 3]).toBe('emily');
    expect(state.cells[(ROWS - 1) * COLUMNS + 3]).toBe('fabrizio');
  });

  it('riconosce la vittoria orizzontale', () => {
    const marks: Mark[] = Array(COLUMNS * ROWS).fill(null);
    const row = ROWS - 1;
    for (let col = 0; col < 4; col++) marks[row * COLUMNS + col] = 'fabrizio';
    expect(winnerOf(cells(...marks))).toBe('fabrizio');
  });

  it('riconosce la vittoria verticale', () => {
    const marks: Mark[] = Array(COLUMNS * ROWS).fill(null);
    for (let row = ROWS - 4; row < ROWS; row++) marks[row * COLUMNS + 0] = 'emily';
    expect(winnerOf(cells(...marks))).toBe('emily');
  });

  it('riconosce la vittoria diagonale (in basso a destra)', () => {
    const marks: Mark[] = Array(COLUMNS * ROWS).fill(null);
    for (let i = 0; i < 4; i++) marks[i * COLUMNS + i] = 'fabrizio';
    expect(winnerOf(cells(...marks))).toBe('fabrizio');
  });

  it('riconosce la vittoria diagonale (in basso a sinistra)', () => {
    const marks: Mark[] = Array(COLUMNS * ROWS).fill(null);
    for (let i = 0; i < 4; i++) marks[i * COLUMNS + (COLUMNS - 1 - i)] = 'emily';
    expect(winnerOf(cells(...marks))).toBe('emily');
  });

  it('nessun vincitore su una griglia vuota', () => {
    expect(winnerOf(EMPTY_BOARD)).toBeNull();
  });

  it('nessun vincitore con tre allineati e uno interrotto', () => {
    const marks: Mark[] = Array(COLUMNS * ROWS).fill(null);
    const row = ROWS - 1;
    marks[row * COLUMNS + 0] = 'fabrizio';
    marks[row * COLUMNS + 1] = 'fabrizio';
    marks[row * COLUMNS + 2] = 'fabrizio';
    marks[row * COLUMNS + 3] = 'emily';
    expect(winnerOf(cells(...marks))).toBeNull();
  });

  it('riconosce il pareggio: griglia piena senza vincitore', () => {
    // Pattern basato su (row * 7 + col * 11) % 29: garantisce
    // nessun 4-allineato in nessuna direzione su una griglia 7×6.
    const marks: Mark[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        const val = (row * 7 + col * 11) % 29;
        marks.push(val < 15 ? 'fabrizio' : 'emily');
      }
    }
    const full = cells(...marks);
    expect(winnerOf(full)).toBeNull();
    expect(isDraw(full)).toBe(true);
  });

  it('non è un pareggio se la griglia non è piena', () => {
    expect(isDraw(EMPTY_BOARD)).toBe(false);
  });
});
