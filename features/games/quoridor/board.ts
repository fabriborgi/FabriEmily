import type { Person } from '@/features/auth/identity';

export type Position = { row: number; col: number };
export type Orientation = 'horizontal' | 'vertical';
export type Wall = { row: number; col: number; orientation: Orientation };
export type BoardState = {
  positions: Record<Person, Position>;
  walls: Wall[];
  wallsRemaining: Record<Person, number>;
};

export const SIZE = 9;
export const WALLS_PER_PLAYER = 10;

/** `startedBy` parte in riga 0 (obiettivo riga 8), l'altro in riga 8 (obiettivo riga 0), entrambi al centro. */
export function initialState(startedBy: Person): BoardState {
  const other: Person = startedBy === 'fabrizio' ? 'emily' : 'fabrizio';
  return {
    positions: {
      [startedBy]: { row: 0, col: 4 },
      [other]: { row: 8, col: 4 },
    } as Record<Person, Position>,
    walls: [],
    wallsRemaining: { fabrizio: WALLS_PER_PLAYER, emily: WALLS_PER_PLAYER },
  };
}

export function goalRow(person: Person, startedBy: Person): number {
  return person === startedBy ? 8 : 0;
}

/**
 * Un muro è ancorato all'intersezione (row, col) fra 4 caselle (row/col da
 * 0 a 7) e copre un segmento lungo 2 caselle. Un muro orizzontale blocca
 * gli spostamenti verticali (cambio di riga) fra la riga `row` e `row+1`,
 * alle colonne `col` e `col+1`. Un muro verticale blocca gli spostamenti
 * laterali (cambio di colonna) fra la colonna `col` e `col+1`, alle righe
 * `row` e `row+1`. Ogni muro blocca sempre 2 bordi distinti, mai 1.
 */
export function wallBlocksEdge(wall: Wall, a: Position, b: Position): boolean {
  if (wall.orientation === 'horizontal') {
    if (a.row === b.row) return false;
    const minRow = Math.min(a.row, b.row);
    const col = a.col;
    return minRow === wall.row && (col === wall.col || col === wall.col + 1);
  }
  if (a.col === b.col) return false;
  const minCol = Math.min(a.col, b.col);
  const row = a.row;
  return minCol === wall.col && (row === wall.row || row === wall.row + 1);
}

export function orthogonalNeighbors(pos: Position): Position[] {
  const candidates = [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ];
  return candidates.filter((p) => p.row >= 0 && p.row < SIZE && p.col >= 0 && p.col < SIZE);
}

/**
 * Le destinazioni legali per il turno corrente: mossa semplice, oppure —
 * se l'avversario è adiacente — salto dritto oltre di lui (sostituisce la
 * mossa normale in quella direzione, non è un'alternativa a scelta) o,
 * solo se il salto dritto è bloccato da un muro o dal bordo, salto
 * diagonale su uno dei due lati dell'avversario (regola ufficiale esatta).
 */
export function legalMoves(state: BoardState, person: Person): Position[] {
  const other: Person = person === 'fabrizio' ? 'emily' : 'fabrizio';
  const from = state.positions[person];
  const opponent = state.positions[other];
  const moves: Position[] = [];

  for (const next of orthogonalNeighbors(from)) {
    if (state.walls.some((w) => wallBlocksEdge(w, from, next))) continue;

    if (next.row === opponent.row && next.col === opponent.col) {
      const beyond = {
        row: opponent.row + (opponent.row - from.row),
        col: opponent.col + (opponent.col - from.col),
      };
      const straightBlocked =
        beyond.row < 0 || beyond.row >= SIZE || beyond.col < 0 || beyond.col >= SIZE ||
        state.walls.some((w) => wallBlocksEdge(w, opponent, beyond));

      if (!straightBlocked) {
        moves.push(beyond);
        continue;
      }

      const isVertical = opponent.row !== from.row;
      const sides: Position[] = isVertical
        ? [{ row: opponent.row, col: opponent.col - 1 }, { row: opponent.row, col: opponent.col + 1 }]
        : [{ row: opponent.row - 1, col: opponent.col }, { row: opponent.row + 1, col: opponent.col }];

      for (const side of sides) {
        if (side.row < 0 || side.row >= SIZE || side.col < 0 || side.col >= SIZE) continue;
        if (state.walls.some((w) => wallBlocksEdge(w, opponent, side))) continue;
        moves.push(side);
      }
      continue;
    }

    moves.push(next);
  }

  return moves;
}

export function applyMove(state: BoardState, person: Person, to: Position): BoardState {
  return { ...state, positions: { ...state.positions, [person]: to } };
}

export function isWin(position: Position, targetRow: number): boolean {
  return position.row === targetRow;
}
