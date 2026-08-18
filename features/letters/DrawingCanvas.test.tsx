import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawingCanvas } from './DrawingCanvas';
import { PALETTE, WIDTHS, MAX_STROKES, type Stroke } from './strokes';
import { DRAFT_KEY } from './draft';

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

// Un tratto minimo (down + up sullo stesso pointerId) basta a farlo comparire in
// `strokes`: onPointerDown crea il tratto, onPointerUp lo aggiunge alla lista, il
// pixel esatto non conta per questi test.
function drawStroke(canvas: HTMLCanvasElement, pointerId: number, x: number, y: number) {
  canvas.setPointerCapture = canvas.setPointerCapture ?? vi.fn();
  fireEvent.pointerDown(canvas, { pointerId, clientX: x, clientY: y });
  fireEvent.pointerUp(canvas, { pointerId, clientX: x, clientY: y });
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

  it('annulla rimuove davvero solo l’ultimo tratto', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    const canvas = screen.getByLabelText('Drawing area') as HTMLCanvasElement;
    drawStroke(canvas, 1, 10, 10);
    drawStroke(canvas, 2, 20, 20);
    // Osservabile diretto: il contatore dei tratti mancanti alla ricompensa è già
    // in interfaccia e riflette esattamente strokes.length (MIN_STROKES_FOR_REWARD
    // - strokes.length). Con due tratti disegnati ne mancano 3; sostituendo il
    // gestore di Undo con un no-op questo assert fallirebbe perché resterebbe "3".
    expect(screen.getByText(/3 more strokes/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/4 more strokes/)).toBeDefined();
  });

  it('un annulla o una cancella azzerano l’avviso dei 200 tratti', () => {
    const full: Stroke[] = Array.from({ length: MAX_STROKES }, () => ({ c: 0, w: 0, p: [0, 0] }));
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(full));
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    const canvas = screen.getByLabelText('Drawing area') as HTMLCanvasElement;
    // Un altro contatto quando si è già a 200 tratti innesca l'avviso e basta,
    // niente setPointerCapture: canAddStroke lo intercetta subito in onPointerDown.
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(screen.getByText(/200 strokes/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByText(/200 strokes/)).toBeNull();
  });

  it('un secondo dito appoggiato mentre si disegna non ruba il tratto in corso', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    const canvas = screen.getByLabelText('Drawing area') as HTMLCanvasElement;
    const capture = vi.fn();
    canvas.setPointerCapture = capture;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    // Il primo dito sta ancora disegnando (nessun pointerUp per id 1): un palmo o
    // un secondo dito tocca lo schermo con un pointerId diverso. Osservabile diretto:
    // se onPointerDown non ignorasse questo contatto, catturerebbe anche questo
    // pointerId — sostituendo il tratto in corso invece di scartare il contatto.
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 90, clientY: 90 });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(1);
  });

  it('un rilascio tardivo di un dito precedente non chiude il tratto del dito attuale', () => {
    render(<DrawingCanvas onSend={vi.fn()} busy={false} />);
    const canvas = screen.getByLabelText('Drawing area') as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    drawStroke(canvas, 1, 10, 10); // primo tratto completo: strokes.length === 1
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 50, clientY: 50 }); // secondo tratto iniziato, non ancora sollevato
    // Evento tardivo/duplicato per il dito 1, ormai sollevato da tempo: se
    // onPointerUp non verificasse il pointerId, chiuderebbe qui il tratto del
    // dito 2 (ancora sulla tela), facendolo comparire come completato in anticipo.
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(screen.getByText(/4 more strokes/)).toBeDefined(); // ancora 1 solo tratto committato
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 50, clientY: 50 }); // il dito 2, ora sollevato per davvero
    expect(screen.getByText(/3 more strokes/)).toBeDefined(); // ora 2 tratti committati
  });
});
