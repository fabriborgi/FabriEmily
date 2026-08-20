'use client';

import { useRef, useState } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import {
  initialState, rollDice, dieValuesForRoll, legalSources, applySingleMove, isWin,
  type BoardState,
} from './board';
import styles from '../games.module.css';

const TOP_ROW = Array.from({ length: 12 }, (_, i) => 24 - i); // 24..13
const BOTTOM_ROW = Array.from({ length: 12 }, (_, i) => 12 - i); // 12..1

export function BackgammonBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError, refetch } = useActiveMatch('backgammon');
  const { data: tally } = useGameHistory('backgammon');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDice, setPendingDice] = useState<number[]>([]);
  const [pendingState, setPendingState] = useState<BoardState | null>(null);
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  // Stessa guardia sincrona degli altri giochi: il `disabled` da solo non
  // basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('backgammon', who, initialState(who));
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  function roll() {
    if (pendingDice.length > 0 || !match) return;
    const dice = rollDice();
    setPendingDice(dieValuesForRoll(dice));
    setPendingState(match.state as BoardState);
    setSelectedDieIndex(null);
  }

  function resetTurn() {
    setPendingDice([]);
    setPendingState(null);
    setSelectedDieIndex(null);
  }

  function selectDie(index: number) {
    setSelectedDieIndex(index);
  }

  function playFrom(from: number) {
    if (selectedDieIndex === null || !pendingState || !match) return;
    const die = pendingDice[selectedDieIndex];
    const sources = legalSources(pendingState, who, match.started_by, die);
    if (!sources.includes(from)) return;
    const next = applySingleMove(pendingState, who, match.started_by, from, die);
    const remaining = pendingDice.filter((_, i) => i !== selectedDieIndex);
    setPendingState(next);
    setPendingDice(remaining);
    setSelectedDieIndex(null);
  }

  async function endTurn() {
    if (sending.current || !match || !pendingState) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const winner = isWin(pendingState, who) ? who : null;
    const result = winner ? 'win' : null;
    const { error: failure } = await makeMove(match.id, who, pendingState, result, winner);
    setBusy(false);
    sending.current = false;
    resetTurn();
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
        const myTurn = match.current_turn === who;
        const state = pendingState ?? (match.state as BoardState);

        return (
          <>
            <MatchStatus currentTurn={match.current_turn} who={who} />
            <p className={styles.backgammonInfo}>
              Bar — {displayName('fabrizio')}: {state.bar.fabrizio}, {displayName('emily')}: {state.bar.emily}
            </p>
            <p className={styles.backgammonInfo}>
              Borne off — {displayName('fabrizio')}: {state.borneOff.fabrizio}, {displayName('emily')}: {state.borneOff.emily}
            </p>
            {myTurn && pendingDice.length > 0 && (
              <div className={styles.backgammonDiceRow}>
                {pendingDice.map((die, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.backgammonDie} ${selectedDieIndex === i ? styles.backgammonDieSelected : ''}`}
                    onClick={() => selectDie(i)}
                    disabled={busy}
                  >
                    Die {die}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.backgammonBoard}>
              {[...TOP_ROW, ...BOTTOM_ROW].map((point) => {
                const pointState = state.points[point];
                const isLegalTarget =
                  myTurn &&
                  selectedDieIndex !== null &&
                  pendingState !== null &&
                  legalSources(pendingState, who, match.started_by, pendingDice[selectedDieIndex]).includes(point);
                return (
                  <button
                    key={point}
                    type="button"
                    className={`${styles.backgammonPoint} ${isLegalTarget ? styles.backgammonPointLegal : ''}`}
                    onClick={() => isLegalTarget && playFrom(point)}
                    disabled={!isLegalTarget || busy}
                    aria-label={`Point ${point}${pointState ? `, ${displayName(pointState.owner)} ×${pointState.count}` : ''}`}
                  >
                    <span className={styles.backgammonPointNumber}>{point}</span>
                    {pointState && <span>{pointState.owner === 'fabrizio' ? '●' : '○'}×{pointState.count}</span>}
                  </button>
                );
              })}
            </div>
            {myTurn && (
              <div className={styles.backgammonActionsRow}>
                {pendingDice.length === 0 && (
                  <button type="button" className={styles.backgammonActionButton} onClick={roll} disabled={busy}>
                    Roll dice
                  </button>
                )}
                {pendingState !== null && (
                  <>
                    <button type="button" className={styles.backgammonActionButton} onClick={resetTurn} disabled={busy}>
                      Reset turn
                    </button>
                    <button type="button" className={styles.backgammonActionButton} onClick={endTurn} disabled={busy}>
                      {busy ? 'Sending…' : 'End turn'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        );
      })()}

      {match && match.closed_at !== null && (
        <>
          <p className={styles.result}>
            {/* Backgammon non pareggia mai: si vince togliendo tutte e 15 le pedine. */}
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
