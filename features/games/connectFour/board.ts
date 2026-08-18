import type { Person } from '@/features/auth/identity';

export type Cell = Person | null;
export type BoardState = { cells: Cell[] }; // lunghezza 42 (7×6), indice row*COLUMNS+col, riga 0 in alto

export const COLUMNS = 7;
export const ROWS = 6;

export const EMPTY_BOARD: BoardState = { cells: Array(COLUMNS * ROWS).fill(null) };

/** Una colonna è giocabile finché la sua cella più in alto (riga 0) è libera. */
export function isLegalMove(state: BoardState, column: number): boolean {
  if (column < 0 || column >= COLUMNS) return false;
  return state.cells[column] === null;
}

/** Il pezzo cade nella riga libera più bassa di quella colonna — la gravità del gioco. */
export function applyMove(state: BoardState, column: number, mark: Person): BoardState {
  const cells = [...state.cells];
  for (let row = ROWS - 1; row >= 0; row--) {
    const index = row * COLUMNS + column;
    if (cells[index] === null) {
      cells[index] = mark;
      break;
    }
  }
  return { cells };
}

function lineFrom(row: number, col: number, dRow: number, dCol: number): number[] | null {
  const line: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = row + dRow * i;
    const c = col + dCol * i;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLUMNS) return null;
    line.push(r * COLUMNS + c);
  }
  return line;
}

// Generate tutte le linee di 4 celle possibili (orizzontali, verticali, le
// due diagonali) invece di elencarle a mano come le 8 del Tris: per una
// griglia 7×6 sono 69, troppe per un elenco leggibile senza errori di
// trascrizione.
const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

const LINES: number[][] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLUMNS; col++) {
    for (const [dRow, dCol] of DIRECTIONS) {
      const line = lineFrom(row, col, dRow, dCol);
      if (line) LINES.push(line);
    }
  }
}

export function winnerOf(state: BoardState): Person | null {
  for (const [a, b, c, d] of LINES) {
    const mark = state.cells[a];
    if (mark && mark === state.cells[b] && mark === state.cells[c] && mark === state.cells[d]) {
      return mark;
    }
  }
  return null;
}

export function isDraw(state: BoardState): boolean {
  return winnerOf(state) === null && state.cells.every((c) => c !== null);
}
