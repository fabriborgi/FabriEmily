import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DrawingReplay } from './DrawingReplay';
import type { Stroke } from './strokes';

/**
 * Contesto finto: registra le chiamate per poterle verificare, come in strokes.test.ts.
 * In più espone `scale`, che qui serve a DrawingReplay stesso (non a drawStrokes).
 */
function fakeCtx() {
  const calls: string[] = [];
  const record = (name: string) => (...args: unknown[]) =>
    void calls.push(`${name}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : a)).join(',')})`);
  return {
    calls,
    ctx: {
      clearRect: record('clearRect'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      quadraticCurveTo: record('quadraticCurveTo'),
      stroke: record('stroke'),
      scale: record('scale'),
      set strokeStyle(v: string) { calls.push(`strokeStyle=${v}`); },
      set lineWidth(v: number) { calls.push(`lineWidth=${Math.round(v)}`); },
      set lineCap(v: string) { calls.push(`lineCap=${v}`); },
      set lineJoin(v: string) { calls.push(`lineJoin=${v}`); },
    } as unknown as CanvasRenderingContext2D,
  };
}

/** In jsdom la tela si misura da parentElement.clientWidth, che vale sempre 0: qui gli si dà un valore. */
function stubClientWidth(px: number) {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(px);
}

/**
 * requestAnimationFrame/cancelAnimationFrame finti: tengono i callback pendenti in una
 * mappa per poter verificare che annullare un frame lo tolga davvero di mezzo, invece
 * di limitarsi a farli scorrere con un timer reale.
 */
function stubAnimationFrame() {
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  const cancelAnimationFrame = vi.fn((id: number) => {
    pending.delete(id);
  });
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  const flush = (id: number, now: number) => {
    const cb = pending.get(id);
    pending.delete(id);
    if (cb) act(() => cb(now));
  };
  return { pending, requestAnimationFrame, cancelAnimationFrame, flush };
}

const twoStrokes: Stroke[] = [
  { c: 0, w: 0, p: [0, 0, 10, 10] },
  { c: 1, w: 0, p: [0, 0, 20, 20] },
];

describe('DrawingReplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('con la tela a larghezza zero (non ancora misurata) non disegna e non lancia', () => {
    const { ctx, calls } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    expect(() => render(<DrawingReplay strokes={twoStrokes} />)).not.toThrow();

    const canvas = screen.getByRole('img', { name: 'Drawing' }) as HTMLCanvasElement;
    // 300 è il default HTML di un canvas mai dimensionato: se il dipinto fosse partito
    // comunque con dimensione 0, questo valore verrebbe sovrascritto a 0.
    expect(canvas.width).toBe(300);
    expect(calls).toHaveLength(0);
  });

  it('disegna un tratto singolo senza errori', () => {
    stubClientWidth(300);
    const { ctx, calls } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    expect(() =>
      render(<DrawingReplay strokes={[{ c: 0, w: 1, p: [500, 500] }]} />),
    ).not.toThrow();

    expect(calls).toContain('stroke()');
  });

  it('premere il pulsante due volte di seguito annulla la prima animazione invece di farle correre insieme', () => {
    stubClientWidth(300);
    const { ctx } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const { pending, cancelAnimationFrame } = stubAnimationFrame();

    render(<DrawingReplay strokes={twoStrokes} />);
    const button = screen.getByRole('button', { name: /Watch it again/ });

    fireEvent.click(button);
    expect(pending.size).toBe(1);
    const [firstId] = [...pending.keys()];

    fireEvent.click(button);
    // Un solo frame pendente: il primo è stato annullato prima di richiederne un altro.
    expect(cancelAnimationFrame).toHaveBeenCalledWith(firstId);
    expect(pending.size).toBe(1);
    expect([...pending.keys()]).not.toContain(firstId);
  });

  it('smontare durante l’animazione annulla il frame in sospeso', () => {
    stubClientWidth(300);
    const { ctx } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const { pending, cancelAnimationFrame } = stubAnimationFrame();

    const { unmount } = render(<DrawingReplay strokes={twoStrokes} />);
    fireEvent.click(screen.getByRole('button', { name: /Watch it again/ }));
    expect(pending.size).toBe(1);
    const [id] = [...pending.keys()];

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(id);
    expect(pending.size).toBe(0);
  });

  it('il replay disegna via via più tratti nel tempo, non tutti subito', () => {
    stubClientWidth(300);
    const { ctx, calls } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const { pending, flush } = stubAnimationFrame();
    vi.spyOn(performance, 'now').mockReturnValue(1000); // istante di partenza del replay

    render(<DrawingReplay strokes={twoStrokes} />);
    fireEvent.click(screen.getByRole('button', { name: /Watch it again/ }));
    calls.length = 0; // scarta il dipinto fatto al montaggio, restano solo i frame del replay

    let [id] = [...pending.keys()];
    flush(id, 1100); // 100ms su 2000: solo il primo tratto è visibile
    const strokesAfterFirstFrame = calls.filter((c) => c === 'stroke()').length;
    expect(strokesAfterFirstFrame).toBe(1);

    calls.length = 0;
    [id] = [...pending.keys()];
    flush(id, 3000); // oltre i 2000ms: tutti i tratti visibili, animazione conclusa
    const strokesAfterLastFrame = calls.filter((c) => c === 'stroke()').length;
    expect(strokesAfterLastFrame).toBe(twoStrokes.length);
    expect(strokesAfterLastFrame).toBeGreaterThan(strokesAfterFirstFrame);

    // A progress >= 1 non deve essere richiesto un altro frame.
    expect(pending.size).toBe(0);
  });
});
