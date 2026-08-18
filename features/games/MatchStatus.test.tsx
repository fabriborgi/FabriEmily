import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchStatus } from './MatchStatus';

describe('MatchStatus', () => {
  it('mostra "Your turn" quando tocca a chi guarda', () => {
    render(<MatchStatus currentTurn="fabrizio" who="fabrizio" />);
    expect(screen.getByText('Your turn')).toBeDefined();
  });

  it("mostra chi sta aspettando quando tocca all'altro", () => {
    render(<MatchStatus currentTurn="emily" who="fabrizio" />);
    expect(screen.getByText('Waiting for Emily')).toBeDefined();
  });
});
