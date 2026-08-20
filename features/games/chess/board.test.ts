import { describe, it, expect } from 'vitest';
import {
  colorOf, personOf, algebraic, pieceAt, initialState, isSquareAttacked,
  kingSquare, isInCheck, pseudoLegalMoves,
  type BoardState, type Piece,
} from './board';

function emptyBoard(): (Piece | null)[][] {
  return Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
}

function customState(overrides: Partial<BoardState> & { pieces?: Array<{ square: { row: number; col: number }; piece: Piece }> }): BoardState {
  const board = emptyBoard();
  for (const { square, piece } of overrides.pieces ?? []) {
    board[square.row][square.col] = piece;
  }
  return {
    board,
    castlingRights: overrides.castlingRights ?? {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    },
    enPassantTarget: overrides.enPassantTarget ?? null,
  };
}

function has(moves: Array<{ row: number; col: number }>, sq: { row: number; col: number }): boolean {
  return moves.some((m) => m.row === sq.row && m.col === sq.col);
}

describe('colorOf, personOf, algebraic', () => {
  it('chi apre la partita gioca con il Bianco, l\'altro con il Nero', () => {
    expect(colorOf('fabrizio', 'fabrizio')).toBe('white');
    expect(colorOf('emily', 'fabrizio')).toBe('black');
    expect(personOf('white', 'fabrizio')).toBe('fabrizio');
    expect(personOf('black', 'fabrizio')).toBe('emily');
  });

  it('algebraic converte riga/colonna nella notazione tipo "e4"', () => {
    expect(algebraic({ row: 3, col: 4 })).toBe('e4');
    expect(algebraic({ row: 0, col: 0 })).toBe('a1');
    expect(algebraic({ row: 7, col: 7 })).toBe('h8');
  });
});

describe('initialState', () => {
  it('dispone i 32 pezzi nella posizione di partenza standard', () => {
    const state = initialState();
    expect(pieceAt(state, { row: 0, col: 4 })).toEqual({ type: 'king', color: 'white' });
    expect(pieceAt(state, { row: 0, col: 0 })).toEqual({ type: 'rook', color: 'white' });
    expect(pieceAt(state, { row: 1, col: 3 })).toEqual({ type: 'pawn', color: 'white' });
    expect(pieceAt(state, { row: 7, col: 4 })).toEqual({ type: 'king', color: 'black' });
    expect(pieceAt(state, { row: 7, col: 0 })).toEqual({ type: 'rook', color: 'black' });
    expect(pieceAt(state, { row: 6, col: 3 })).toEqual({ type: 'pawn', color: 'black' });
    expect(pieceAt(state, { row: 3, col: 3 })).toBeNull();
    expect(state.castlingRights).toEqual({
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    });
    expect(state.enPassantTarget).toBeNull();
  });
});

describe('pseudoLegalMoves — pedone', () => {
  it('un passo avanti su casella libera, due passi dalla casella di partenza', () => {
    const state = initialState();
    const moves = pseudoLegalMoves(state, { row: 1, col: 4 }); // e2
    expect(has(moves, { row: 2, col: 4 })).toBe(true); // e3
    expect(has(moves, { row: 3, col: 4 })).toBe(true); // e4
  });

  it('il doppio passo è bloccato se una delle due caselle è occupata', () => {
    const state = customState({
      pieces: [
        { square: { row: 1, col: 4 }, piece: { type: 'pawn', color: 'white' } },
        { square: { row: 2, col: 4 }, piece: { type: 'pawn', color: 'black' } },
      ],
    });
    const moves = pseudoLegalMoves(state, { row: 1, col: 4 });
    expect(has(moves, { row: 2, col: 4 })).toBe(false);
    expect(has(moves, { row: 3, col: 4 })).toBe(false);
  });

  it('cattura diagonale solo se la casella diagonale ha un pezzo avversario', () => {
    const state = customState({
      pieces: [
        { square: { row: 3, col: 4 }, piece: { type: 'pawn', color: 'white' } }, // e4
        { square: { row: 4, col: 3 }, piece: { type: 'pawn', color: 'black' } }, // d5
      ],
    });
    const moves = pseudoLegalMoves(state, { row: 3, col: 4 });
    expect(has(moves, { row: 4, col: 3 })).toBe(true);
    expect(has(moves, { row: 4, col: 5 })).toBe(false); // f5 vuota, nessun pezzo da catturare
  });

  it('presa en passant disponibile quando enPassantTarget coincide con la casella diagonale', () => {
    // Bianco e4->e5 appena giocato non serve qui: si costruisce direttamente lo stato
    // dopo che il Nero ha giocato d7-d5 (doppio passo), lasciando enPassantTarget su d6.
    const state = customState({
      pieces: [
        { square: { row: 4, col: 4 }, piece: { type: 'pawn', color: 'white' } }, // e5
        { square: { row: 4, col: 3 }, piece: { type: 'pawn', color: 'black' } }, // d5
      ],
      enPassantTarget: { row: 5, col: 3 }, // d6
    });
    const moves = pseudoLegalMoves(state, { row: 4, col: 4 });
    expect(has(moves, { row: 5, col: 3 })).toBe(true);
  });
});

describe('pseudoLegalMoves — pezzi a scorrimento e cavallo', () => {
  it('la torre si muove in linea retta fino al primo ostacolo, incluso se catturabile', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 0 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 0, col: 5 }, piece: { type: 'pawn', color: 'black' } },
      ],
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 0 });
    expect(has(moves, { row: 0, col: 4 })).toBe(true); // fino alla casella prima dell'ostacolo
    expect(has(moves, { row: 0, col: 5 })).toBe(true); // cattura l'ostacolo avversario
    expect(has(moves, { row: 0, col: 6 })).toBe(false); // oltre l'ostacolo, illegale
  });

  it('l\'alfiere non supera un proprio pezzo', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 2 }, piece: { type: 'bishop', color: 'white' } },
        { square: { row: 2, col: 4 }, piece: { type: 'pawn', color: 'white' } },
      ],
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 2 });
    expect(has(moves, { row: 1, col: 3 })).toBe(true);
    expect(has(moves, { row: 2, col: 4 })).toBe(false); // proprio pezzo, non catturabile
    expect(has(moves, { row: 3, col: 5 })).toBe(false); // oltre il proprio pezzo
  });

  it('il cavallo salta secondo le 8 mosse a "L", ignorando ostacoli intermedi', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 1 }, piece: { type: 'knight', color: 'white' } },
        { square: { row: 1, col: 1 }, piece: { type: 'pawn', color: 'white' } }, // ostacolo ignorato dal cavallo
      ],
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 1 });
    expect(has(moves, { row: 2, col: 0 })).toBe(true);
    expect(has(moves, { row: 2, col: 2 })).toBe(true);
  });
});

describe('isSquareAttacked, isInCheck', () => {
  it('rileva una casella attaccata da una torre lungo la riga', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 0 }, piece: { type: 'rook', color: 'black' } },
      ],
    });
    expect(isSquareAttacked(state, { row: 0, col: 4 }, 'black')).toBe(true);
    expect(isInCheck(state, 'white')).toBe(true);
  });

  it('un pezzo che blocca la linea toglie lo scacco', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 0 }, piece: { type: 'rook', color: 'black' } },
        { square: { row: 0, col: 2 }, piece: { type: 'pawn', color: 'white' } },
      ],
    });
    expect(isInCheck(state, 'white')).toBe(false);
  });

  it('kingSquare trova la posizione del re di quel colore', () => {
    const state = initialState();
    expect(kingSquare(state, 'white')).toEqual({ row: 0, col: 4 });
    expect(kingSquare(state, 'black')).toEqual({ row: 7, col: 4 });
  });
});

describe('pseudoLegalMoves — arrocco', () => {
  it('arrocco corto legale: caselle libere, diritti intatti, nessuna casella attraversata sotto attacco', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 7 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 7, col: 4 }, piece: { type: 'king', color: 'black' } },
      ],
      castlingRights: {
        white: { kingside: true, queenside: false },
        black: { kingside: false, queenside: false },
      },
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 4 });
    expect(has(moves, { row: 0, col: 6 })).toBe(true);
  });

  it('arrocco corto illegale se una casella intermedia è occupata', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 7 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 0, col: 5 }, piece: { type: 'bishop', color: 'white' } },
        { square: { row: 7, col: 4 }, piece: { type: 'king', color: 'black' } },
      ],
      castlingRights: {
        white: { kingside: true, queenside: false },
        black: { kingside: false, queenside: false },
      },
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 4 });
    expect(has(moves, { row: 0, col: 6 })).toBe(false);
  });

  it('arrocco illegale se il re è attualmente sotto scacco', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 7 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 7, col: 4 }, piece: { type: 'rook', color: 'black' } },
      ],
      castlingRights: {
        white: { kingside: true, queenside: false },
        black: { kingside: false, queenside: false },
      },
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 4 });
    expect(has(moves, { row: 0, col: 6 })).toBe(false);
  });

  it('arrocco illegale se il re attraverserebbe una casella attaccata', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 7 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 7, col: 5 }, piece: { type: 'rook', color: 'black' } }, // colonna f, attacca f1
      ],
      castlingRights: {
        white: { kingside: true, queenside: false },
        black: { kingside: false, queenside: false },
      },
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 4 });
    expect(has(moves, { row: 0, col: 6 })).toBe(false);
  });

  it('arrocco lungo legale richiede b1/c1/d1 libere ma solo c1/d1 non attaccate', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 0 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 7, col: 4 }, piece: { type: 'king', color: 'black' } },
      ],
      castlingRights: {
        white: { kingside: false, queenside: true },
        black: { kingside: false, queenside: false },
      },
    });
    const moves = pseudoLegalMoves(state, { row: 0, col: 4 });
    expect(has(moves, { row: 0, col: 2 })).toBe(true);
  });
});

import { isPromotion, applyMove, legalMoves } from './board';

describe('isPromotion', () => {
  it('è vero solo per un pedone che raggiunge l\'ultima riga', () => {
    const state = customState({
      pieces: [{ square: { row: 6, col: 4 }, piece: { type: 'pawn', color: 'white' } }],
    });
    expect(isPromotion(state, { row: 6, col: 4 }, { row: 7, col: 4 })).toBe(true);
    expect(isPromotion(state, { row: 6, col: 4 }, { row: 6, col: 4 })).toBe(false);
  });
});

describe('applyMove', () => {
  it('una mossa semplice sposta il pezzo e svuota la casella di partenza', () => {
    const state = customState({
      pieces: [{ square: { row: 1, col: 4 }, piece: { type: 'pawn', color: 'white' } }],
    });
    const next = applyMove(state, { row: 1, col: 4 }, { row: 3, col: 4 });
    expect(pieceAt(next, { row: 1, col: 4 })).toBeNull();
    expect(pieceAt(next, { row: 3, col: 4 })).toEqual({ type: 'pawn', color: 'white' });
  });

  it('il doppio passo del pedone imposta enPassantTarget sulla casella saltata', () => {
    const state = customState({
      pieces: [{ square: { row: 1, col: 4 }, piece: { type: 'pawn', color: 'white' } }],
    });
    const next = applyMove(state, { row: 1, col: 4 }, { row: 3, col: 4 });
    expect(next.enPassantTarget).toEqual({ row: 2, col: 4 });
  });

  it('la presa en passant rimuove il pedone catturato, non sulla casella di arrivo', () => {
    const state = customState({
      pieces: [
        { square: { row: 4, col: 4 }, piece: { type: 'pawn', color: 'white' } }, // e5
        { square: { row: 4, col: 3 }, piece: { type: 'pawn', color: 'black' } }, // d5
      ],
      enPassantTarget: { row: 5, col: 3 }, // d6
    });
    const next = applyMove(state, { row: 4, col: 4 }, { row: 5, col: 3 });
    expect(pieceAt(next, { row: 5, col: 3 })).toEqual({ type: 'pawn', color: 'white' });
    expect(pieceAt(next, { row: 4, col: 3 })).toBeNull(); // il pedone nero catturato sparisce
  });

  it('l\'arrocco corto sposta anche la torre', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 0, col: 7 }, piece: { type: 'rook', color: 'white' } },
      ],
      castlingRights: {
        white: { kingside: true, queenside: false },
        black: { kingside: false, queenside: false },
      },
    });
    const next = applyMove(state, { row: 0, col: 4 }, { row: 0, col: 6 });
    expect(pieceAt(next, { row: 0, col: 6 })).toEqual({ type: 'king', color: 'white' });
    expect(pieceAt(next, { row: 0, col: 5 })).toEqual({ type: 'rook', color: 'white' });
    expect(pieceAt(next, { row: 0, col: 7 })).toBeNull();
    expect(next.castlingRights.white).toEqual({ kingside: false, queenside: false });
  });

  it('la promozione sostituisce il pedone con il pezzo scelto', () => {
    const state = customState({
      pieces: [{ square: { row: 6, col: 4 }, piece: { type: 'pawn', color: 'white' } }],
    });
    const next = applyMove(state, { row: 6, col: 4 }, { row: 7, col: 4 }, 'rook');
    expect(pieceAt(next, { row: 7, col: 4 })).toEqual({ type: 'rook', color: 'white' });
  });

  it('muovere la torre di casa toglie il diritto di arrocco solo su quel lato', () => {
    const state = customState({
      pieces: [{ square: { row: 0, col: 0 }, piece: { type: 'rook', color: 'white' } }],
      castlingRights: {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true },
      },
    });
    const next = applyMove(state, { row: 0, col: 0 }, { row: 0, col: 3 });
    expect(next.castlingRights.white).toEqual({ kingside: true, queenside: false });
  });

  it('catturare la torre avversaria in casa toglie il diritto di arrocco su quel lato', () => {
    const state = customState({
      pieces: [
        { square: { row: 6, col: 0 }, piece: { type: 'rook', color: 'white' } },
        { square: { row: 7, col: 0 }, piece: { type: 'rook', color: 'black' } },
      ],
      castlingRights: {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true },
      },
    });
    const next = applyMove(state, { row: 6, col: 0 }, { row: 7, col: 0 });
    expect(next.castlingRights.black).toEqual({ kingside: true, queenside: false });
  });
});

describe('legalMoves — filtro di autoscacco', () => {
  it('una pedina inchiodata sul re non può muoversi, anche se il movimento sarebbe altrimenti legale', () => {
    // Re bianco e1, cavallo bianco e2 (inchiodato), torre nera e8 lungo la colonna e.
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 1, col: 4 }, piece: { type: 'knight', color: 'white' } },
        { square: { row: 7, col: 4 }, piece: { type: 'rook', color: 'black' } },
      ],
    });
    expect(legalMoves(state, { row: 1, col: 4 })).toEqual([]);
  });

  it('il re non può muoversi su una casella comunque attaccata', () => {
    const state = customState({
      pieces: [
        { square: { row: 0, col: 4 }, piece: { type: 'king', color: 'white' } },
        { square: { row: 7, col: 5 }, piece: { type: 'rook', color: 'black' } }, // colonna f, attacca f1
      ],
    });
    const moves = legalMoves(state, { row: 0, col: 4 });
    expect(has(moves, { row: 0, col: 5 })).toBe(false); // f1, attaccata
    expect(has(moves, { row: 0, col: 3 })).toBe(true); // d1, libera e non attaccata
  });
});

import { isCheckmate, isStalemate } from './board';

describe('isCheckmate, isStalemate', () => {
  it('matto del corridoio: il re è sotto scacco e non ha alcuna mossa legale', () => {
    // Re bianco g1, pedoni bianchi f2/g2/h2 (intrappolano il proprio re), torre nera e1
    // dà scacco lungo la prima riga (f1 libera). Nessun pezzo bianco può bloccare o
    // catturare la torre, il re non ha caselle libere non attaccate.
    const state = customState({
      pieces: [
        { square: { row: 0, col: 6 }, piece: { type: 'king', color: 'white' } }, // g1
        { square: { row: 1, col: 5 }, piece: { type: 'pawn', color: 'white' } }, // f2
        { square: { row: 1, col: 6 }, piece: { type: 'pawn', color: 'white' } }, // g2
        { square: { row: 1, col: 7 }, piece: { type: 'pawn', color: 'white' } }, // h2
        { square: { row: 0, col: 4 }, piece: { type: 'rook', color: 'black' } }, // e1
        { square: { row: 7, col: 4 }, piece: { type: 'king', color: 'black' } },
      ],
    });
    expect(isInCheck(state, 'white')).toBe(true);
    expect(isCheckmate(state, 'white')).toBe(true);
    expect(isStalemate(state, 'white')).toBe(false);
  });

  it('non è scacco matto se esiste una mossa legale che toglie lo scacco', () => {
    // Stessa idea del matto del corridoio, ma senza il pedone su h2: il re può scappare in h1.
    const state = customState({
      pieces: [
        { square: { row: 0, col: 6 }, piece: { type: 'king', color: 'white' } }, // g1
        { square: { row: 1, col: 5 }, piece: { type: 'pawn', color: 'white' } }, // f2
        { square: { row: 1, col: 6 }, piece: { type: 'pawn', color: 'white' } }, // g2
        { square: { row: 0, col: 4 }, piece: { type: 'rook', color: 'black' } }, // e1
        { square: { row: 7, col: 4 }, piece: { type: 'king', color: 'black' } },
      ],
    });
    expect(isInCheck(state, 'white')).toBe(true);
    expect(isCheckmate(state, 'white')).toBe(false);
  });

  it('stallo classico: il re non è sotto scacco ma non ha alcuna mossa legale', () => {
    // Re nero a8, re bianco c7, donna bianca b6: il re nero non è in scacco (la donna
    // non attacca a8 direttamente, distanza a "L") ma a7/b7/b8 sono tutte controllate.
    const state = customState({
      pieces: [
        { square: { row: 7, col: 0 }, piece: { type: 'king', color: 'black' } }, // a8
        { square: { row: 6, col: 2 }, piece: { type: 'king', color: 'white' } }, // c7
        { square: { row: 5, col: 1 }, piece: { type: 'queen', color: 'white' } }, // b6
      ],
    });
    expect(isInCheck(state, 'black')).toBe(false);
    expect(isStalemate(state, 'black')).toBe(true);
    expect(isCheckmate(state, 'black')).toBe(false);
  });
});
