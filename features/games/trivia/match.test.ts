import { describe, it, expect } from 'vitest';
import {
  drawMatch, applyAnswer, isCorrect, isMatchOver, scoreByPerson, winnerOf,
  QUESTIONS_PER_MATCH, type MatchState,
} from './match';
import { QUESTIONS, type Question } from './questions';

const q = (correctIndex: 0 | 1 | 2 | 3): Question => ({
  prompt: 'domanda di prova',
  options: ['a', 'b', 'c', 'd'],
  correctIndex,
});

describe('logica di Trivia', () => {
  it('drawMatch pesca esattamente 10 domande senza ripetizioni', () => {
    const state = drawMatch();
    expect(state.questions).toHaveLength(QUESTIONS_PER_MATCH);
    const unique = new Set(state.questions.map((question) => question.prompt));
    expect(unique.size).toBe(QUESTIONS_PER_MATCH);
  });

  it('drawMatch pesca dal banco reale di domande, con le opzioni rimescolate', () => {
    const state = drawMatch();
    for (const question of state.questions) {
      const original = QUESTIONS.find((candidate) => candidate.prompt === question.prompt);
      expect(original).toBeDefined();
      expect(new Set(question.options)).toEqual(new Set(original!.options));
      expect(question.options[question.correctIndex]).toBe(original!.options[original!.correctIndex]);
    }
  });

  it('drawMatch rimescola le opzioni invece di lasciarle sempre nell\'ordine originale', () => {
    // Su 10 domande pescate a caso, la probabilità che tutte restino
    // nell'ordine originale (1/24 a domanda) è trascurabile: se questo test
    // fallisce di continuo, drawMatch ha smesso di rimescolare davvero.
    const state = drawMatch();
    const changed = state.questions.some((question) => {
      const original = QUESTIONS.find((candidate) => candidate.prompt === question.prompt)!;
      return question.options.some((option, i) => option !== original.options[i]);
    });
    expect(changed).toBe(true);
  });

  it('inizia con currentIndex a 0 e nessuna risposta', () => {
    const state = drawMatch();
    expect(state.currentIndex).toBe(0);
    expect(state.answers.every((answer) => answer === null)).toBe(true);
  });

  it('isCorrect riconosce la risposta giusta', () => {
    expect(isCorrect(q(2), 2)).toBe(true);
  });

  it('isCorrect riconosce una risposta sbagliata', () => {
    expect(isCorrect(q(2), 1)).toBe(false);
  });

  it('isCorrect tratta la risposta scaduta (null) come sbagliata', () => {
    expect(isCorrect(q(2), null)).toBe(false);
  });

  it('applyAnswer registra la risposta e avanza currentIndex senza mutare lo stato originale', () => {
    const state = drawMatch();
    const next = applyAnswer(state, 1);
    expect(next.answers[0]).toBe(1);
    expect(next.currentIndex).toBe(1);
    expect(state.currentIndex).toBe(0);
  });

  it('isMatchOver è falso finché non sono state fatte tutte le domande', () => {
    expect(isMatchOver(drawMatch())).toBe(false);
  });

  it("isMatchOver è vero dopo l'ultima domanda", () => {
    let state = drawMatch();
    for (let i = 0; i < QUESTIONS_PER_MATCH; i++) state = applyAnswer(state, 0);
    expect(isMatchOver(state)).toBe(true);
  });

  it('scoreByPerson assegna le risposte corrette in alternanza a partire da chi ha iniziato', () => {
    const state: MatchState = {
      questions: [q(0), q(1), q(2), q(3)],
      answers: [0, 1, 0, 3],
      currentIndex: 4,
    };
    // indice 0 (fabrizio, chi inizia): risposta 0, corretta -> fabrizio 1
    // indice 1 (emily): risposta 1, corretta -> emily 1
    // indice 2 (fabrizio): risposta 0, sbagliata (corretta è 2)
    // indice 3 (emily): risposta 3, corretta -> emily 2
    expect(scoreByPerson(state, 'fabrizio')).toEqual({ fabrizio: 1, emily: 2 });
  });

  it('winnerOf dichiara vincitore chi ha più risposte corrette', () => {
    const state: MatchState = {
      questions: [q(0), q(1), q(2), q(3)],
      answers: [0, 1, 0, 3],
      currentIndex: 4,
    };
    expect(winnerOf(state, 'fabrizio')).toBe('emily');
  });

  it('winnerOf ritorna null in caso di pareggio', () => {
    const state: MatchState = {
      questions: [q(0), q(1)],
      answers: [0, 1],
      currentIndex: 2,
    };
    expect(winnerOf(state, 'fabrizio')).toBeNull();
  });
});
