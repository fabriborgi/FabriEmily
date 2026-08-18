import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevealedAnswers } from './RevealedAnswers';
import type { Answer } from './queries';

const answers: Answer[] = [
  { round_id: 'r1', author: 'fabrizio', body: 'la mia risposta', answered_at: '2026-08-18T10:00:00Z' },
  { round_id: 'r1', author: 'emily', body: 'la sua risposta', answered_at: '2026-08-18T11:00:00Z' },
];

describe('RevealedAnswers', () => {
  it('etichetta la propria risposta come "You"', () => {
    render(<RevealedAnswers answers={answers} who="fabrizio" />);
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('la mia risposta')).toBeDefined();
  });

  it('etichetta la risposta del partner con il suo nome', () => {
    render(<RevealedAnswers answers={answers} who="fabrizio" />);
    expect(screen.getByText('Emily')).toBeDefined();
    expect(screen.getByText('la sua risposta')).toBeDefined();
  });

  it('mostra entrambe le risposte anche osservando dal punto di vista dell’altro', () => {
    render(<RevealedAnswers answers={answers} who="emily" />);
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('Fabrizio')).toBeDefined();
  });
});
