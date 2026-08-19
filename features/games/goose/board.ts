export type Positions = { fabrizio: number; emily: number };
export type Stuck = { fabrizio: number; emily: number };
export type BoardState = { positions: Positions; stuck: Stuck; lastRoll: [number, number] | null };

export const GOAL = 63;
export const COLUMNS = 7;
export const ROWS = 9;

export const GEESE = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
export const BRIDGE = 6;
export const BRIDGE_TARGET = 12;
export const INN = 19;
export const WELL = 31;
export const LABYRINTH = 42;
export const LABYRINTH_TARGET = 30;
export const PRISON = 52;
export const DEATH = 58;

export const EMPTY_BOARD: BoardState = {
  positions: { fabrizio: 0, emily: 0 },
  stuck: { fabrizio: 0, emily: 0 },
  lastRoll: null,
};

export function rollDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

function bounce(position: number): number {
  return position > GOAL ? GOAL - (position - GOAL) : position;
}

export type MoveResult = { position: number; stuckTurns: number };

/** Applica l'effetto di una casella non-oca — chiamata solo dopo che la catena di oche si è fermata. */
function resolveSquare(position: number): MoveResult {
  if (position === BRIDGE) return { position: BRIDGE_TARGET, stuckTurns: 0 };
  if (position === INN) return { position, stuckTurns: 1 };
  if (position === WELL) return { position, stuckTurns: 2 };
  if (position === LABYRINTH) return { position: LABYRINTH_TARGET, stuckTurns: 0 };
  if (position === PRISON) return { position, stuckTurns: 2 };
  if (position === DEATH) return { position: 0, stuckTurns: 0 };
  return { position, stuckTurns: 0 };
}

/**
 * Muove dalla posizione corrente: somma i dadi, rimbalza se supera 63,
 * poi risolve un'eventuale catena di oche (ogni oca ripete lo stesso
 * tiro, con lo stesso rimbalzo a ogni passo), infine applica l'effetto
 * della casella non-oca su cui la catena si ferma.
 *
 * Il rimbalzo può riportare la catena esattamente sulla stessa oca da cui
 * è partita (es. dalla casella 59 con somma 8: 59+8=67, rimbalza a 59) —
 * senza un limite il ciclo non terminerebbe mai. `visited` rompe il ciclo:
 * se una casella si ripresenta, la catena si ferma lì (si resta su
 * quell'oca per questo turno, invece di rilanciare all'infinito).
 */
export function applyRoll(current: number, dice: [number, number]): MoveResult {
  const total = dice[0] + dice[1];
  let position = bounce(current + total);

  const visited = new Set<number>();
  while (GEESE.includes(position) && !visited.has(position)) {
    visited.add(position);
    position = bounce(position + total);
  }

  return resolveSquare(position);
}

export function isWin(position: number): boolean {
  return position === GOAL;
}

export type SquareKind = 'goose' | 'bridge' | 'inn' | 'well' | 'labyrinth' | 'prison' | 'death' | 'goal' | null;

export function squareKind(square: number): SquareKind {
  if (square === GOAL) return 'goal';
  if (GEESE.includes(square)) return 'goose';
  if (square === BRIDGE) return 'bridge';
  if (square === INN) return 'inn';
  if (square === WELL) return 'well';
  if (square === LABYRINTH) return 'labyrinth';
  if (square === PRISON) return 'prison';
  if (square === DEATH) return 'death';
  return null;
}

/**
 * Coordinate a griglia serpentina (riga 0 in alto, si parte dal basso a
 * sinistra e si sale a zig-zag) per la casella 1-63 — usata solo per il
 * disegno, non per la logica di gioco.
 */
export function squareGridPosition(square: number): { row: number; col: number } {
  const index = square - 1;
  const rowFromBottom = Math.floor(index / COLUMNS);
  const row = ROWS - 1 - rowFromBottom;
  const posInRow = index % COLUMNS;
  const col = rowFromBottom % 2 === 0 ? posInRow : COLUMNS - 1 - posInRow;
  return { row, col };
}
