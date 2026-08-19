import type { Person } from '@/features/auth/identity';
import { QUESTIONS, type Question } from './questions';

export type Answer = number | null; // indice scelto, o null se il tempo è scaduto

export type MatchState = {
  questions: Question[]; // sempre QUESTIONS_PER_MATCH elementi
  answers: Answer[];      // stessa lunghezza di questions
  currentIndex: number;   // 0..QUESTIONS_PER_MATCH-1, o QUESTIONS_PER_MATCH quando la partita è finita
};

export const QUESTIONS_PER_MATCH = 10;
export const TIMER_SECONDS = 10;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Rimescola le 4 opzioni di una domanda (e sposta correctIndex di
 * conseguenza) senza mutare l'oggetto originale nel banco statico. Il banco
 * ha correctIndex sbilanciato verso alcune lettere (es. quasi metà delle
 * domande con la risposta corretta in posizione B): senza rimescolare, chi
 * gioca può sfruttare la distribuzione invece di rispondere davvero.
 */
function shuffleOptions(question: Question): Question {
  const order = shuffled([0, 1, 2, 3]);
  const options = order.map((i) => question.options[i]) as Question['options'];
  const correctIndex = order.indexOf(question.correctIndex) as Question['correctIndex'];
  return { ...question, options, correctIndex };
}

/** Pesca QUESTIONS_PER_MATCH domande casuali senza ripetizioni dal banco statico. */
export function drawMatch(): MatchState {
  const questions = shuffled(QUESTIONS).slice(0, QUESTIONS_PER_MATCH).map(shuffleOptions);
  return {
    questions,
    answers: Array(QUESTIONS_PER_MATCH).fill(null),
    currentIndex: 0,
  };
}

export function isCorrect(question: Question, answer: Answer): boolean {
  return answer !== null && answer === question.correctIndex;
}

export function applyAnswer(state: MatchState, answer: Answer): MatchState {
  const answers = [...state.answers];
  answers[state.currentIndex] = answer;
  return { ...state, answers, currentIndex: state.currentIndex + 1 };
}

export function isMatchOver(state: MatchState): boolean {
  return state.currentIndex >= state.questions.length;
}

/**
 * Le risposte alternano automaticamente grazie al motore di F2 (current_turn
 * gira a ogni make_move): l'indice pari appartiene a chi ha iniziato la
 * partita, l'indice dispari all'altra persona. Nessun campo separato lo
 * traccia — si deriva da started_by, che make_move non tocca mai.
 */
export function scoreByPerson(state: MatchState, startedBy: Person): Record<Person, number> {
  const other: Person = startedBy === 'fabrizio' ? 'emily' : 'fabrizio';
  const score: Record<Person, number> = { fabrizio: 0, emily: 0 };
  state.questions.forEach((question, i) => {
    if (i >= state.answers.length) return;
    if (isCorrect(question, state.answers[i])) {
      const answerer = i % 2 === 0 ? startedBy : other;
      score[answerer] += 1;
    }
  });
  return score;
}

export function winnerOf(state: MatchState, startedBy: Person): Person | null {
  const score = scoreByPerson(state, startedBy);
  if (score.fabrizio === score.emily) return null;
  return score.fabrizio > score.emily ? 'fabrizio' : 'emily';
}
