import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoinPill } from './CoinPill';

describe('CoinPill', () => {
  it('mostra il saldo e porta allo shop', () => {
    render(<CoinPill coins={1234} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/shop');
    expect(link.textContent).toContain('1,234');
  });

  it('mostra un segnaposto mentre il saldo non è ancora noto', () => {
    render(<CoinPill coins={null} />);
    expect(screen.getByRole('link').textContent).toContain('—');
  });

  it('ha un’etichetta accessibile che spiega il numero', () => {
    render(<CoinPill coins={40} />);
    expect(screen.getByLabelText('40 coins — open the shop')).toBeDefined();
  });
});
