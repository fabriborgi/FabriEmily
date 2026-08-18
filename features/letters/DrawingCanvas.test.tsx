import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrawingCanvas } from './DrawingCanvas';
import { PALETTE, WIDTHS } from './strokes';

// jsdom, in questa configurazione, non espone window.localStorage (verificato in
// features/auth/AuthGate.test.tsx) e DrawingCanvas lo usa direttamente per la
// bozza: qui si sostituisce con un'implementazione in memoria, stesso pattern.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('DrawingCanvas', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('offre tutti i colori della palette', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getAllByRole('radio', { name: /color/i })).toHaveLength(PALETTE.length);
  });

  it('offre tutti gli spessori', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getAllByRole('radio', { name: /brush/i })).toHaveLength(WIDTHS.length);
  });

  it('parte con annulla e cancella disattivati, perché la tela è vuota', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' }).getAttribute('disabled')).not.toBeNull();
  });

  it('non permette di inviare una tela vuota', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getByRole('button', { name: /Send/ }).getAttribute('disabled')).not.toBeNull();
  });

  it('dice quanti tratti mancano alla ricompensa', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    expect(screen.getByText(/5 more strokes/)).toBeDefined();
  });

  it('la tela disabilita lo scroll del dito', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    const canvas = screen.getByLabelText('Drawing area');
    expect(canvas.style.touchAction).toBe('none');
  });
});
