'use client';

import { useEffect, useRef, useState } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import {
  drawMatch, applyAnswer, isMatchOver, scoreByPerson, winnerOf, TIMER_SECONDS, type MatchState,
} from './match';
import styles from '../games.module.css';

export function TriviaBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError, refetch } = useActiveMatch('trivia');
  const { data: tally } = useGameHistory('trivia');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  // Stessa guardia sincrona degli altri giochi: il `disabled` da solo non
  // basta fra due tocchi molto ravvicinati, né fra un tocco e lo scadere
  // del timer nello stesso istante.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('trivia', who, drawMatch());
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function submitAnswer(answerIndex: number | null) {
    if (sending.current || !match) return;
    const state = match.state as MatchState;
    if (match.current_turn !== who) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyAnswer(state, answerIndex);
    let result: 'win' | 'draw' | null = null;
    let winner: Person | null = null;
    if (isMatchOver(next)) {
      winner = winnerOf(next, match.started_by);
      result = winner ? 'win' : 'draw';
    }
    const { error: failure } = await makeMove(match.id, who, next, result, winner);
    setBusy(false);
    sending.current = false;
    if (failure) {
      setError(failure);
      refetch();
    }
  }

  const state = match ? (match.state as MatchState) : null;
  const myTurn = !!match && match.closed_at === null && match.current_turn === who;

  // Il countdown riparte a ogni nuova domanda del proprio turno. Allo
  // scadere non è una mossa speciale: è la stessa submitAnswer(null) di una
  // risposta sbagliata — il server non sa nulla del timer.
  useEffect(() => {
    if (!myTurn) return;
    setSecondsLeft(TIMER_SECONDS);
    let remaining = TIMER_SECONDS;
    const interval = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        submitAnswer(null);
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, match?.id, state?.currentIndex]);

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

      {match && state && match.closed_at === null && (
        <>
          <MatchStatus currentTurn={match.current_turn} who={who} />
          <p className={styles.triviaScore}>
            {displayName('fabrizio')} {scoreByPerson(state, match.started_by).fabrizio} –{' '}
            {displayName('emily')} {scoreByPerson(state, match.started_by).emily} — question{' '}
            {state.currentIndex + 1} of {state.questions.length}
          </p>
          {myTurn && <p className={styles.triviaTimer}>{secondsLeft}s</p>}
          <p className={styles.triviaPrompt}>{state.questions[state.currentIndex].prompt}</p>
          <div className={styles.triviaOptions}>
            {state.questions[state.currentIndex].options.map((option, i) => (
              <button
                key={i}
                type="button"
                className={styles.triviaOption}
                onClick={() => submitAnswer(i)}
                disabled={busy || !myTurn}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}

      {match && state && match.closed_at !== null && (
        <>
          <p className={styles.result}>
            {match.winner === null
              ? "It's a draw."
              : match.winner === who
                ? 'You won!'
                : `${displayName(match.winner)} won.`}
          </p>
          <p className={styles.triviaScore}>
            {displayName('fabrizio')} {scoreByPerson(state, match.started_by).fabrizio} –{' '}
            {displayName('emily')} {scoreByPerson(state, match.started_by).emily}
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
