import type { Person } from '@/features/auth/identity';

export type Cell = Person | null;
export type BoardState = { cells: Cell[] }; // lunghezza 9, indice 0 in alto a sinistra

export const EMPTY_BOARD: BoardState = { cells: Array(9).fill(null) };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function isLegalMove(state: BoardState, index: number): boolean {
  return index >= 0 && index < 9 && state.cells[index] === null;
}

export function applyMove(state: BoardState, index: number, mark: Person): BoardState {
  const cells = [...state.cells];
  cells[index] = mark;
  return { cells };
}

export function winnerOf(state: BoardState): Person | null {
  for (const [a, b, c] of LINES) {
    const mark = state.cells[a];
    if (mark && mark === state.cells[b] && mark === state.cells[c]) return mark;
  }
  return null;
}

export function isDraw(state: BoardState): boolean {
  return winnerOf(state) === null && state.cells.every((c) => c !== null);
}
