import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdentityChooser } from './IdentityChooser';

describe('IdentityChooser', () => {
  it('offre entrambe le identità, in inglese', () => {
    render(<IdentityChooser onChoose={vi.fn()} />);
    expect(screen.getByRole('button', { name: "I'm Fabrizio" })).toBeDefined();
    expect(screen.getByRole('button', { name: "I'm Emily" })).toBeDefined();
  });

  it('comunica la scelta', () => {
    const onChoose = vi.fn();
    render(<IdentityChooser onChoose={onChoose} />);
    screen.getByRole('button', { name: "I'm Emily" }).click();
    expect(onChoose).toHaveBeenCalledWith('emily');
  });
});
