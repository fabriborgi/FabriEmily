'use client';

import { useRef, useState } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import {
  EMPTY_BOARD, GOAL, rollDice, applyRoll, isWin, squareGridPosition, squareKind,
  type BoardState,
} from './board';
import styles from '../games.module.css';

const SQUARE_EMOJI: Record<string, string> = {
  goose: '🪿',
  bridge: '🌉',
  inn: '🏨',
  well: '🕳️',
  labyrinth: '🌀',
  prison: '⛓️',
  death: '💀',
  goal: '🏁',
};

const SQUARES = Array.from({ length: GOAL }, (_, i) => i + 1);

export function GooseBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError, refetch } = useActiveMatch('goose');
  const { data: tally } = useGameHistory('goose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona degli altri giochi: il `disabled` da solo non
  // basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('goose', who, EMPTY_BOARD);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function play() {
    if (sending.current || !match) return;
    const state = match.state as BoardState;
    if (match.current_turn !== who) return;
    sending.current = true;
    setBusy(true);
    setError(null);

    let next: BoardState;
    let winner: Person | null = null;

    if (state.stuck[who] > 0) {
      // Turno bloccato (pozzo/prigione/locanda): niente dadi, si scala solo il contatore.
      next = { ...state, stuck: { ...state.stuck, [who]: state.stuck[who] - 1 }, lastRoll: null };
    } else {
      const dice = rollDice();
      const { position, stuckTurns } = applyRoll(state.positions[who], dice);
      next = {
        positions: { ...state.positions, [who]: position },
        stuck: { ...state.stuck, [who]: stuckTurns },
        lastRoll: dice,
      };
      if (isWin(position)) winner = who;
    }

    const result = winner ? 'win' : null;
    const { error: failure } = await makeMove(match.id, who, next, result, winner);
    setBusy(false);
    sending.current = false;
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
        const iAmStuck = state.stuck[who] > 0;
        const atStart: Person[] = (['fabrizio', 'emily'] as Person[]).filter((p) => state.positions[p] === 0);
        return (
          <>
            <MatchStatus currentTurn={match.current_turn} who={who} />
            {atStart.length > 0 && (
              <p className={styles.gooseStart}>Start: {atStart.map((p) => displayName(p)).join(', ')}</p>
            )}
            {state.lastRoll && (
              <p className={styles.gooseRoll}>
                Last roll: {state.lastRoll[0]} + {state.lastRoll[1]} = {state.lastRoll[0] + state.lastRoll[1]}
              </p>
            )}
            {iAmStuck && (
              <p className={styles.gooseStuck}>
                You&rsquo;re stuck for {state.stuck[who]} more turn{state.stuck[who] > 1 ? 's' : ''}.
              </p>
            )}
            <div className={styles.gooseBoard}>
              {SQUARES.map((square) => {
                const { row, col } = squareGridPosition(square);
                const kind = squareKind(square);
                const here: Person[] = (['fabrizio', 'emily'] as Person[]).filter(
                  (p) => state.positions[p] === square,
                );
                return (
                  <div
                    key={square}
                    className={styles.gooseSquare}
                    style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  >
                    <span className={styles.gooseSquareNumber}>{square}</span>
                    {kind && <span aria-hidden>{SQUARE_EMOJI[kind]}</span>}
                    {here.map((p) => (
                      <span key={p} className={styles.gooseToken} aria-label={displayName(p)}>
                        {p === match.started_by ? '●' : '○'}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
            <button type="button" className={styles.newGame} onClick={play} disabled={busy || !myTurn}>
              {busy ? 'Rolling…' : iAmStuck ? 'Skip turn' : 'Roll dice'}
            </button>
          </>
        );
      })()}

      {match && match.closed_at !== null && (
        <>
          <p className={styles.result}>
            {/* Il Gioco dell'oca non pareggia mai: qualcuno arriva sempre per primo a 63. */}
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
