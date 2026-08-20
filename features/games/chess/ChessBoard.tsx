'use client';

import { useEffect, useRef, useState } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import {
  colorOf, algebraic, pieceAt, initialState, isInCheck, kingSquare,
  legalMoves, isPromotion, applyMove, isCheckmate, isStalemate, SIZE,
  type BoardState, type Piece, type PieceType, type Color, type Square,
} from './board';
import styles from '../games.module.css';

const GLYPHS: Record<Color, Record<PieceType, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

function glyph(piece: Piece): string {
  return GLYPHS[piece.color][piece.type];
}

const PROMOTION_CHOICES: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

export function ChessBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError, refetch } = useActiveMatch('chess');
  const { data: tally } = useGameHistory('chess');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  // Stessa guardia sincrona degli altri giochi: il `disabled` da solo non
  // basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [match?.id, match?.closed_at]);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('chess', who, initialState());
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function submitMove(from: Square, to: Square, promotion?: PieceType) {
    if (sending.current || !match) return;
    const state = match.state as BoardState;
    if (match.current_turn !== who) return;
    // make_move non valida le regole del gioco: il client è l'unico
    // controllo. Un render stale non deve poter inviare una mossa illegale —
    // stesso ricontrollo di QuoridorBoard/BackgammonBoard.
    if (!legalMoves(state, from).some((m) => m.row === to.row && m.col === to.col)) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyMove(state, from, to, promotion);
    const myColor = colorOf(who, match.started_by);
    const opponentColor: Color = myColor === 'white' ? 'black' : 'white';
    let result: 'win' | 'draw' | null = null;
    let winner: Person | null = null;
    if (isCheckmate(next, opponentColor)) {
      result = 'win';
      winner = who;
    } else if (isStalemate(next, opponentColor)) {
      result = 'draw';
      winner = null;
    }
    const { error: failure } = await makeMove(match.id, who, next, result, winner);
    setBusy(false);
    sending.current = false;
    setSelectedSquare(null);
    setPendingPromotion(null);
    if (failure) {
      setError(failure);
      refetch();
    }
  }

  function handleSquareClick(square: Square) {
    if (!match || busy || match.closed_at !== null || match.current_turn !== who) return;
    const state = match.state as BoardState;
    const myColor = colorOf(who, match.started_by);
    if (selectedSquare) {
      const isLegalTarget = legalMoves(state, selectedSquare).some((m) => m.row === square.row && m.col === square.col);
      if (isLegalTarget) {
        if (isPromotion(state, selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
        } else {
          submitMove(selectedSquare, square);
        }
        return;
      }
    }
    const clickedPiece = pieceAt(state, square);
    setSelectedSquare(clickedPiece && clickedPiece.color === myColor ? square : null);
  }

  if (loading && !match) return <p className={styles.muted}>Loading…</p>;

  const newGameButton = (
    <button type="button" className={styles.newGame} onClick={start} disabled={busy}>
      {busy ? 'Starting…' : 'New game'}
    </button>
  );

  return (
    <div className={styles.gameShell}>
      {tally && (
        <p className={styles.tally}>
          {displayName('fabrizio')} {tally.fabrizio} – {displayName('emily')} {tally.emily} – {tally.draws} draws
        </p>
      )}
      {loadError && (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      )}

      {!match && newGameButton}

      {match && (() => {
        const state = match.state as BoardState;
        const closed = match.closed_at !== null;
        const myTurn = !closed && match.current_turn === who;
        const turnColor = colorOf(match.current_turn, match.started_by);
        const inCheck = !closed && isInCheck(state, turnColor);
        const highlightedKingSquare = inCheck
          ? kingSquare(state, turnColor)
          : closed && isCheckmate(state, 'white')
            ? kingSquare(state, 'white')
            : closed && isCheckmate(state, 'black')
              ? kingSquare(state, 'black')
              : null;
        const legalTargets = myTurn && selectedSquare ? legalMoves(state, selectedSquare) : [];

        return (
          <>
            {!closed && <MatchStatus currentTurn={match.current_turn} who={who} />}
            {inCheck && <p className={styles.chessCheckBanner}>Check!</p>}
            <div className={styles.chessBoard}>
              {Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i).map((row) =>
                Array.from({ length: SIZE }, (_, col) => {
                  const square = { row, col };
                  const piece = pieceAt(state, square);
                  const isLight = (row + col) % 2 === 0;
                  const isSelected = selectedSquare?.row === row && selectedSquare?.col === col;
                  const isLegalTarget = legalTargets.some((m) => m.row === row && m.col === col);
                  const isHighlighted = highlightedKingSquare?.row === row && highlightedKingSquare?.col === col;
                  const classes = [
                    styles.chessSquare,
                    isLight ? styles.chessSquareLight : styles.chessSquareDark,
                    isLegalTarget ? styles.chessSquareLegal : '',
                    isSelected ? styles.chessSquareSelected : '',
                    isHighlighted ? styles.chessSquareCheck : '',
                  ].join(' ');
                  return (
                    <button
                      key={`${row}-${col}`}
                      type="button"
                      className={classes}
                      onClick={() => handleSquareClick(square)}
                      disabled={busy || closed}
                      aria-label={`${algebraic(square)}, ${piece ? `${piece.color} ${piece.type}` : 'empty'}${isHighlighted ? ', king in check' : ''}`}
                    >
                      {piece ? glyph(piece) : ''}
                    </button>
                  );
                }),
              )}
            </div>
            {!closed && pendingPromotion && (
              <div className={styles.chessPromotionRow}>
                {PROMOTION_CHOICES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={styles.chessPromotionButton}
                    onClick={() => submitMove(pendingPromotion.from, pendingPromotion.to, type)}
                    disabled={busy}
                    aria-label={`Promote to ${type}`}
                  >
                    {glyph({ type, color: colorOf(who, match.started_by) })}
                  </button>
                ))}
              </div>
            )}
            {closed && (
              <p className={styles.result}>
                {match.winner === who
                  ? 'You won!'
                  : match.winner === null
                    ? "It's a draw."
                    : `${displayName(match.winner as Person)} won.`}
              </p>
            )}
            {closed && newGameButton}
          </>
        );
      })()}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
