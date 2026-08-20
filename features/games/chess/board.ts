import type { Person } from '@/features/auth/identity';

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type Color = 'white' | 'black';
export type Piece = { type: PieceType; color: Color };
export type Square = { row: number; col: number };
export type CastlingRights = { kingside: boolean; queenside: boolean };
export type BoardState = {
  board: (Piece | null)[][];
  castlingRights: Record<Color, CastlingRights>;
  enPassantTarget: Square | null;
};

export const SIZE = 8;

export function colorOf(person: Person, startedBy: Person): Color {
  return person === startedBy ? 'white' : 'black';
}

export function personOf(color: Color, startedBy: Person): Person {
  const other: Person = startedBy === 'fabrizio' ? 'emily' : 'fabrizio';
  return color === 'white' ? startedBy : other;
}

export function algebraic(square: Square): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + square.col);
  return `${file}${square.row + 1}`;
}

function inBounds(sq: Square): boolean {
  return sq.row >= 0 && sq.row < SIZE && sq.col >= 0 && sq.col < SIZE;
}

export function pieceAt(state: BoardState, sq: Square): Piece | null {
  return state.board[sq.row][sq.col];
}

export function initialState(): BoardState {
  const board: (Piece | null)[][] = Array.from({ length: SIZE }, () => Array<Piece | null>(SIZE).fill(null));
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let col = 0; col < SIZE; col++) {
    board[0][col] = { type: backRank[col], color: 'white' };
    board[1][col] = { type: 'pawn', color: 'white' };
    board[6][col] = { type: 'pawn', color: 'black' };
    board[7][col] = { type: backRank[col], color: 'black' };
  }
  return {
    board,
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    enPassantTarget: null,
  };
}

const BISHOP_DIRS: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS: Array<[number, number]> = [...BISHOP_DIRS, ...ROOK_DIRS];
const KNIGHT_OFFSETS: Array<[number, number]> = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING_OFFSETS: Array<[number, number]> = QUEEN_DIRS;

function slideMoves(state: BoardState, from: Square, directions: Array<[number, number]>): Square[] {
  const piece = pieceAt(state, from)!;
  const moves: Square[] = [];
  for (const [dr, dc] of directions) {
    let r = from.row + dr;
    let c = from.col + dc;
    while (inBounds({ row: r, col: c })) {
      const target = state.board[r][c];
      if (!target) {
        moves.push({ row: r, col: c });
      } else {
        if (target.color !== piece.color) moves.push({ row: r, col: c });
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function stepMoves(state: BoardState, from: Square, offsets: Array<[number, number]>): Square[] {
  const piece = pieceAt(state, from)!;
  const moves: Square[] = [];
  for (const [dr, dc] of offsets) {
    const sq = { row: from.row + dr, col: from.col + dc };
    if (!inBounds(sq)) continue;
    const target = state.board[sq.row][sq.col];
    if (!target || target.color !== piece.color) moves.push(sq);
  }
  return moves;
}

function pawnAttackSquares(from: Square, color: Color): Square[] {
  const dir = color === 'white' ? 1 : -1;
  return [
    { row: from.row + dir, col: from.col - 1 },
    { row: from.row + dir, col: from.col + 1 },
  ].filter(inBounds);
}

function pawnMoves(state: BoardState, from: Square): Square[] {
  const piece = pieceAt(state, from)!;
  const dir = piece.color === 'white' ? 1 : -1;
  const startRow = piece.color === 'white' ? 1 : 6;
  const moves: Square[] = [];
  const oneStep = { row: from.row + dir, col: from.col };
  if (inBounds(oneStep) && !state.board[oneStep.row][oneStep.col]) {
    moves.push(oneStep);
    const twoStep = { row: from.row + 2 * dir, col: from.col };
    if (from.row === startRow && !state.board[twoStep.row][twoStep.col]) {
      moves.push(twoStep);
    }
  }
  for (const target of pawnAttackSquares(from, piece.color)) {
    const occupant = state.board[target.row][target.col];
    if (occupant && occupant.color !== piece.color) {
      moves.push(target);
    } else if (
      state.enPassantTarget &&
      target.row === state.enPassantTarget.row &&
      target.col === state.enPassantTarget.col
    ) {
      moves.push(target);
    }
  }
  return moves;
}

export function isSquareAttacked(state: BoardState, square: Square, byColor: Color): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== byColor) continue;
      const from = { row: r, col: c };
      const matches = (moves: Square[]): boolean => moves.some((m) => m.row === square.row && m.col === square.col);
      if (piece.type === 'pawn') {
        if (matches(pawnAttackSquares(from, piece.color))) return true;
      } else if (piece.type === 'knight') {
        if (matches(stepMoves(state, from, KNIGHT_OFFSETS))) return true;
      } else if (piece.type === 'king') {
        if (matches(stepMoves(state, from, KING_OFFSETS))) return true;
      } else if (piece.type === 'bishop') {
        if (matches(slideMoves(state, from, BISHOP_DIRS))) return true;
      } else if (piece.type === 'rook') {
        if (matches(slideMoves(state, from, ROOK_DIRS))) return true;
      } else if (piece.type === 'queen') {
        if (matches(slideMoves(state, from, QUEEN_DIRS))) return true;
      }
    }
  }
  return false;
}

export function kingSquare(state: BoardState, color: Color): Square {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = state.board[r][c];
      if (piece && piece.type === 'king' && piece.color === color) return { row: r, col: c };
    }
  }
  throw new Error('king not found');
}

export function isInCheck(state: BoardState, color: Color): boolean {
  const opponent: Color = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(state, kingSquare(state, color), opponent);
}

function castlingMoves(state: BoardState, from: Square, color: Color): Square[] {
  const moves: Square[] = [];
  const row = color === 'white' ? 0 : 7;
  if (from.row !== row || from.col !== 4) return moves;
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const rights = state.castlingRights[color];
  if (isSquareAttacked(state, from, opponent)) return moves;

  if (rights.kingside) {
    const passSquares = [{ row, col: 5 }, { row, col: 6 }];
    const empty = passSquares.every((sq) => !state.board[sq.row][sq.col]);
    const safe = passSquares.every((sq) => !isSquareAttacked(state, sq, opponent));
    const rook = state.board[row][7];
    if (empty && safe && rook && rook.type === 'rook' && rook.color === color) {
      moves.push({ row, col: 6 });
    }
  }
  if (rights.queenside) {
    const emptyBetween = !state.board[row][1] && !state.board[row][2] && !state.board[row][3];
    const safe = [{ row, col: 3 }, { row, col: 2 }].every((sq) => !isSquareAttacked(state, sq, opponent));
    const rook = state.board[row][0];
    if (emptyBetween && safe && rook && rook.type === 'rook' && rook.color === color) {
      moves.push({ row, col: 2 });
    }
  }
  return moves;
}

export function pseudoLegalMoves(state: BoardState, from: Square): Square[] {
  const piece = pieceAt(state, from);
  if (!piece) return [];
  switch (piece.type) {
    case 'pawn':
      return pawnMoves(state, from);
    case 'knight':
      return stepMoves(state, from, KNIGHT_OFFSETS);
    case 'bishop':
      return slideMoves(state, from, BISHOP_DIRS);
    case 'rook':
      return slideMoves(state, from, ROOK_DIRS);
    case 'queen':
      return slideMoves(state, from, QUEEN_DIRS);
    case 'king':
      return [...stepMoves(state, from, KING_OFFSETS), ...castlingMoves(state, from, piece.color)];
  }
}

export function isPromotion(state: BoardState, from: Square, to: Square): boolean {
  const piece = pieceAt(state, from);
  if (!piece || piece.type !== 'pawn') return false;
  const lastRow = piece.color === 'white' ? SIZE - 1 : 0;
  return to.row === lastRow;
}

export function applyMove(state: BoardState, from: Square, to: Square, promotion?: PieceType): BoardState {
  const piece = pieceAt(state, from)!;
  const board = state.board.map((row) => row.slice());
  const castlingRights: Record<Color, CastlingRights> = {
    white: { ...state.castlingRights.white },
    black: { ...state.castlingRights.black },
  };
  let enPassantTarget: Square | null = null;

  // Presa en passant: il pedone catturato non è sulla casella di arrivo.
  if (
    piece.type === 'pawn' &&
    state.enPassantTarget &&
    to.row === state.enPassantTarget.row &&
    to.col === state.enPassantTarget.col &&
    !board[to.row][to.col]
  ) {
    const capturedRow = piece.color === 'white' ? to.row - 1 : to.row + 1;
    board[capturedRow][to.col] = null;
  }

  // Arrocco: sposta anche la torre.
  if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
    const row = from.row;
    if (to.col === 6) {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else if (to.col === 2) {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }

  board[from.row][from.col] = null;
  board[to.row][to.col] =
    piece.type === 'pawn' && isPromotion(state, from, to)
      ? { type: promotion ?? 'queen', color: piece.color }
      : piece;

  // Doppio passo del pedone: imposta il nuovo bersaglio en passant.
  if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
    enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
  }

  // Aggiorna i diritti di arrocco: il re o la torre si sono mossi, o la torre è stata catturata.
  if (piece.type === 'king') {
    castlingRights[piece.color] = { kingside: false, queenside: false };
  }
  if (piece.type === 'rook') {
    const homeRow = piece.color === 'white' ? 0 : SIZE - 1;
    if (from.row === homeRow && from.col === 0) castlingRights[piece.color].queenside = false;
    if (from.row === homeRow && from.col === 7) castlingRights[piece.color].kingside = false;
  }
  const opponent: Color = piece.color === 'white' ? 'black' : 'white';
  const opponentHomeRow = opponent === 'white' ? 0 : SIZE - 1;
  if (to.row === opponentHomeRow && to.col === 0) castlingRights[opponent].queenside = false;
  if (to.row === opponentHomeRow && to.col === 7) castlingRights[opponent].kingside = false;

  return { board, castlingRights, enPassantTarget };
}

export function legalMoves(state: BoardState, from: Square): Square[] {
  const piece = pieceAt(state, from);
  if (!piece) return [];
  return pseudoLegalMoves(state, from).filter((to) => {
    const next = applyMove(state, from, to, 'queen'); // la scelta di promozione non conta per il test di autoscacco
    return !isInCheck(next, piece.color);
  });
}

function hasAnyLegalMove(state: BoardState, color: Color): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = state.board[r][c];
      if (piece && piece.color === color && legalMoves(state, { row: r, col: c }).length > 0) return true;
    }
  }
  return false;
}

export function isCheckmate(state: BoardState, color: Color): boolean {
  return isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

export function isStalemate(state: BoardState, color: Color): boolean {
  return !isInCheck(state, color) && !hasAnyLegalMove(state, color);
}
