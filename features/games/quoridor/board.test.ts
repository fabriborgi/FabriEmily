import { describe, it, expect } from 'vitest';
import { legalMoves, wallBlocksEdge, type BoardState, type Wall } from './board';

describe('wallBlocksEdge', () => {
  it('un muro orizzontale blocca gli spostamenti verticali sotto di sé, non quelli laterali', () => {
    const wall: Wall = { row: 4, col: 4, orientation: 'horizontal' };
    expect(wallBlocksEdge(wall, { row: 4, col: 4 }, { row: 5, col: 4 })).toBe(true);
    expect(wallBlocksEdge(wall, { row: 4, col: 5 }, { row: 5, col: 5 })).toBe(true);
    expect(wallBlocksEdge(wall, { row: 4, col: 3 }, { row: 5, col: 3 })).toBe(false);
    expect(wallBlocksEdge(wall, { row: 4, col: 4 }, { row: 4, col: 5 })).toBe(false);
  });

  it('un muro verticale blocca gli spostamenti laterali accanto a sé, non quelli verticali', () => {
    const vwall: Wall = { row: 3, col: 4, orientation: 'vertical' };
    expect(wallBlocksEdge(vwall, { row: 3, col: 4 }, { row: 3, col: 5 })).toBe(true);
    expect(wallBlocksEdge(vwall, { row: 4, col: 4 }, { row: 4, col: 5 })).toBe(true);
    expect(wallBlocksEdge(vwall, { row: 2, col: 4 }, { row: 2, col: 5 })).toBe(false);
    expect(wallBlocksEdge(vwall, { row: 3, col: 4 }, { row: 4, col: 4 })).toBe(false);
  });
});

describe('legalMoves', () => {
  it('include le 4 celle ortogonalmente adiacenti su un tabellone vuoto', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 0, col: 0 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toEqual(
      expect.arrayContaining([
        { row: 3, col: 4 }, { row: 5, col: 4 }, { row: 4, col: 3 }, { row: 4, col: 5 },
      ]),
    );
    expect(moves).toHaveLength(4);
  });

  it('un muro blocca la mossa in quella direzione', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 0, col: 0 } },
      walls: [{ row: 4, col: 4, orientation: 'horizontal' }],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).not.toContainEqual({ row: 5, col: 4 });
    expect(moves).toHaveLength(3);
  });

  it('il bordo del tabellone limita le mosse disponibili in un angolo', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 0, col: 0 }, emily: { row: 8, col: 8 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toEqual(expect.arrayContaining([{ row: 1, col: 0 }, { row: 0, col: 1 }]));
    expect(moves).toHaveLength(2);
  });

  it("salto dritto oltre l'avversario adiacente", () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 3, col: 4 }, emily: { row: 4, col: 4 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toContainEqual({ row: 5, col: 4 });
    expect(moves).not.toContainEqual({ row: 4, col: 4 });
  });

  it('salto diagonale quando il salto dritto è bloccato da un muro', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 3, col: 4 }, emily: { row: 4, col: 4 } },
      walls: [{ row: 4, col: 4, orientation: 'horizontal' }],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).not.toContainEqual({ row: 5, col: 4 });
    expect(moves).toContainEqual({ row: 4, col: 3 });
    expect(moves).toContainEqual({ row: 4, col: 5 });
  });

  it('nessun salto disponibile quando anche entrambe le diagonali sono bloccate', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 3, col: 4 }, emily: { row: 4, col: 4 } },
      walls: [
        { row: 4, col: 4, orientation: 'horizontal' },
        { row: 4, col: 3, orientation: 'vertical' },
        { row: 3, col: 4, orientation: 'vertical' },
      ],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toEqual(expect.arrayContaining([{ row: 2, col: 4 }, { row: 3, col: 3 }]));
    expect(moves).toHaveLength(2);
  });
});
