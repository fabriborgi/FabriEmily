'use client';

import { useRef, useState } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import {
  initialState, legalMoves, applyMove, isWin, goalRow,
  isLegalWallPlacement, applyWall, SIZE,
  type BoardState, type Position, type Wall, type Orientation,
} from './board';
import styles from '../games.module.css';

export function QuoridorBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError, refetch } = useActiveMatch('quoridor');
  const { data: tally } = useGameHistory('quoridor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'move' | 'wall'>('move');
  const [selectedAnchor, setSelectedAnchor] = useState<Position | null>(null);
  // Stessa guardia sincrona degli altri giochi: il `disabled` da solo non
  // basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('quoridor', who, initialState(who));
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function submitMove(to: Position) {
    if (sending.current || !match) return;
    const state = match.state as BoardState;
    if (match.current_turn !== who) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyMove(state, who, to);
    const winner = isWin(to, goalRow(who, match.started_by)) ? who : null;
    const result = winner ? 'win' : null;
    const { error: failure } = await makeMove(match.id, who, next, result, winner);
    setBusy(false);
    sending.current = false;
    if (failure) {
      setError(failure);
      refetch();
    }
  }

  async function submitWall(wall: Wall) {
    if (sending.current || !match) return;
    const state = match.state as BoardState;
    if (match.current_turn !== who) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyWall(state, who, wall);
    const { error: failure } = await makeMove(match.id, who, next, null, null);
    setBusy(false);
    sending.current = false;
    setSelectedAnchor(null);
    setMode('move');
    if (failure) {
      setError(failure);
      refetch();
    }
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

      {match && match.closed_at === null && (() => {
        const state = match.state as BoardState;
        const myTurn = match.current_turn === who;
        const moves = myTurn ? legalMoves(state, who) : [];

        const anchors: Position[] = [];
        for (let r = 0; r < SIZE - 1; r++) {
          for (let c = 0; c < SIZE - 1; c++) anchors.push({ row: r, col: c });
        }

        return (
          <>
            <MatchStatus currentTurn={match.current_turn} who={who} />
            <p className={styles.tally}>
              Walls left — {displayName('fabrizio')}: {state.wallsRemaining.fabrizio}, {displayName('emily')}: {state.wallsRemaining.emily}
            </p>
            {myTurn && (
              <div className={styles.quoridorModeRow}>
                <button
                  type="button"
                  className={styles.quoridorModeButton}
                  onClick={() => {
                    setMode('move');
                    setSelectedAnchor(null);
                  }}
                  disabled={mode === 'move'}
                >
                  Move
                </button>
                <button
                  type="button"
                  className={styles.quoridorModeButton}
                  onClick={() => setMode('wall')}
                  disabled={mode === 'wall' || state.wallsRemaining[who] <= 0}
                >
                  Place wall
                </button>
              </div>
            )}
            <div className={styles.quoridorBoard}>
              {Array.from({ length: SIZE }, (_, row) =>
                Array.from({ length: SIZE }, (_, col) => {
                  const isFabrizio = state.positions.fabrizio.row === row && state.positions.fabrizio.col === col;
                  const isEmily = state.positions.emily.row === row && state.positions.emily.col === col;
                  const isLegalTarget = mode === 'move' && myTurn && moves.some((m) => m.row === row && m.col === col);
                  return (
                    <button
                      key={`${row}-${col}`}
                      type="button"
                      className={`${styles.quoridorCell} ${isLegalTarget ? styles.quoridorCellLegal : ''}`}
                      onClick={() => isLegalTarget && submitMove({ row, col })}
                      disabled={!isLegalTarget || busy}
                      aria-label={`Row ${row + 1}, column ${col + 1}${isFabrizio ? ', Fabrizio' : isEmily ? ', Emily' : ''}`}
                    >
                      {isFabrizio ? '●' : isEmily ? '○' : ''}
                    </button>
                  );
                }),
              )}
              {mode === 'wall' &&
                myTurn &&
                anchors.map((anchor) => (
                  <button
                    key={`anchor-${anchor.row}-${anchor.col}`}
                    type="button"
                    className={styles.quoridorAnchor}
                    style={{ top: `${((anchor.row + 1) / SIZE) * 100}%`, left: `${((anchor.col + 1) / SIZE) * 100}%` }}
                    onClick={() => setSelectedAnchor(anchor)}
                    disabled={busy}
                    aria-label={`Wall anchor row ${anchor.row + 1}, column ${anchor.col + 1}`}
                  />
                ))}
            </div>
            {mode === 'wall' && selectedAnchor && (
              <div className={styles.quoridorOrientationRow}>
                {(['horizontal', 'vertical'] as Orientation[]).map((orientation) => {
                  const wall: Wall = { ...selectedAnchor, orientation };
                  const legal = isLegalWallPlacement(state, wall, who, match.started_by);
                  return (
                    <button
                      key={orientation}
                      type="button"
                      className={styles.quoridorOrientationButton}
                      onClick={() => submitWall(wall)}
                      disabled={!legal || busy}
                    >
                      {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {match && match.closed_at !== null && (
        <>
          <p className={styles.result}>
            {/* Quoridor non pareggia mai: si vince solo raggiungendo la riga obiettivo. */}
            {match.winner === who ? 'You won!' : `${displayName(match.winner as Person)} won.`}
          </p>
          {newGameButton}
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
