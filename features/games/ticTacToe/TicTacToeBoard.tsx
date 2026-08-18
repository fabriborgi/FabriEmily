'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import { EMPTY_BOARD, isLegalMove, applyMove, winnerOf, isDraw, type BoardState } from './board';
import styles from '../games.module.css';

export function TicTacToeBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError } = useActiveMatch('tic_tac_toe');
  const { data: tally } = useGameHistory('tic_tac_toe');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona del composer delle lettere e di QuestionCard: il
  // `disabled` da solo non basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('tic_tac_toe', who, EMPTY_BOARD);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function play(index: number) {
    if (sending.current || !match) return;
    const state = match.state as BoardState;
    if (match.current_turn !== who || !isLegalMove(state, index)) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyMove(state, index, who);
    const winner = winnerOf(next);
    const result = winner ? 'win' : isDraw(next) ? 'draw' : null;
    const { error: failure } = await makeMove(match.id, who, next, result, winner);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  if (loading && !match) return <p className={styles.muted}>Loading…</p>;

  return (
    <div className={styles.gameShell}>
      {tally && (
        <p className={styles.tally}>
          {tally.fabrizio} – {tally.emily} – {tally.draws} draws
        </p>
      )}
      {loadError && (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      )}

      {!match && (
        <button type="button" className={styles.newGame} onClick={start} disabled={busy}>
          {busy ? 'Starting…' : 'New game'}
        </button>
      )}

      {match && (
        <>
          <MatchStatus currentTurn={match.current_turn} who={who} />
          <div className={styles.board}>
            {(match.state as BoardState).cells.map((cell, i) => (
              <button
                key={i}
                type="button"
                className={styles.cell}
                aria-label={`Cell ${i + 1}`}
                onClick={() => play(i)}
                disabled={busy || match.current_turn !== who || cell !== null}
              >
                {cell ? (cell === match.started_by ? 'X' : 'O') : ''}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
