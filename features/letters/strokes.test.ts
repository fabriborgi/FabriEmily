import { describe, it, expect } from 'vitest';
import {
  PALETTE,
  WIDTHS,
  CANVAS_UNITS,
  MAX_STROKES,
  MAX_POINTS_PER_STROKE,
  toUnits,
  startStroke,
  appendPoint,
  undo,
  canAddStroke,
  drawStrokes,
  isStrokeArray,
  type Stroke,
} from './strokes';

describe('costanti del formato', () => {
  it('ha dodici colori, tutti esadecimali', () => {
    expect(PALETTE).toHaveLength(12);
    for (const color of PALETTE) expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('ha tre spessori, in ordine crescente', () => {
    expect(WIDTHS).toEqual([6, 14, 30]);
  });
});

describe('toUnits', () => {
  it('converte i pixel nello spazio logico', () => {
    expect(toUnits(250, 500)).toBe(500);
    expect(toUnits(0, 500)).toBe(0);
    expect(toUnits(500, 500)).toBe(CANVAS_UNITS);
  });

  it('restituisce interi, non decimali', () => {
    expect(Number.isInteger(toUnits(123, 377))).toBe(true);
  });

  it('taglia i valori fuori dalla tela invece di produrre coordinate invalide', () => {
    expect(toUnits(-40, 500)).toBe(0);
    expect(toUnits(900, 500)).toBe(CANVAS_UNITS);
  });
});

describe('costruzione di un tratto', () => {
  it('parte con un solo punto', () => {
    expect(startStroke(3, 1, 100, 200)).toEqual({ c: 3, w: 1, p: [100, 200] });
  });

  it('aggiunge un punto abbastanza distante', () => {
    const next = appendPoint(startStroke(0, 0, 100, 100), 110, 100);
    expect(next.p).toEqual([100, 100, 110, 100]);
  });

  it('scarta un punto troppo vicino, restituendo lo stesso tratto', () => {
    const stroke = startStroke(0, 0, 100, 100);
    const next = appendPoint(stroke, 102, 100);
    expect(next).toBe(stroke);
  });

  it('non muta il tratto di partenza', () => {
    const stroke = startStroke(0, 0, 100, 100);
    appendPoint(stroke, 200, 200);
    expect(stroke.p).toEqual([100, 100]);
  });

  it('smette di aggiungere punti raggiunto il limite del tratto', () => {
    let stroke: Stroke = startStroke(0, 0, 0, 0);
    for (let i = 1; i <= MAX_POINTS_PER_STROKE + 50; i++) stroke = appendPoint(stroke, i * 5, 0);
    expect(stroke.p).toHaveLength(MAX_POINTS_PER_STROKE * 2);
  });
});

describe('undo e limiti', () => {
  it('rimuove esattamente l’ultimo tratto', () => {
    const a = startStroke(0, 0, 1, 1);
    const b = startStroke(1, 1, 2, 2);
    expect(undo([a, b])).toEqual([a]);
  });

  it('su una tela vuota non fa nulla', () => {
    expect(undo([])).toEqual([]);
  });

  it('non muta l’array originale', () => {
    const list = [startStroke(0, 0, 1, 1)];
    undo(list);
    expect(list).toHaveLength(1);
  });

  it('impedisce di superare i 200 tratti', () => {
    const many = Array.from({ length: MAX_STROKES }, () => startStroke(0, 0, 1, 1));
    expect(canAddStroke(many)).toBe(false);
    expect(canAddStroke(many.slice(1))).toBe(true);
  });
});

describe('isStrokeArray', () => {
  const valid: Stroke[] = [{ c: 0, w: 0, p: [1, 2, 3, 4] }];

  it('accetta tratti ben formati', () => {
    expect(isStrokeArray(valid)).toBe(true);
  });

  it.each([
    ['non un array', { c: 0 }],
    ['colore fuori palette', [{ c: 12, w: 0, p: [1, 2] }]],
    ['spessore inesistente', [{ c: 0, w: 5, p: [1, 2] }]],
    ['coordinate dispari', [{ c: 0, w: 0, p: [1, 2, 3] }]],
    ['coordinata oltre il limite', [{ c: 0, w: 0, p: [1, 2000] }]],
    ['coordinata non numerica', [{ c: 0, w: 0, p: [1, 'x'] }]],
    ['campo mancante', [{ c: 0, p: [1, 2] }]],
    ['troppi tratti', Array.from({ length: MAX_STROKES + 1 }, () => valid[0])],
    // Il database (assert_valid_strokes, Task 5) rifiuta anche le coordinate
    // frazionarie: p è uno spazio logico a coordinate intere, e accettare qui
    // ciò che il database rifiuta manderebbe un errore incomprensibile a chi
    // ha appena finito di disegnare.
    ['coordinata frazionaria', [{ c: 0, w: 0, p: [1.5, 2] }]],
  ])('rifiuta: %s', (_name, value) => {
    expect(isStrokeArray(value)).toBe(false);
  });
});

describe('drawStrokes', () => {
  /** Contesto finto: registra le chiamate per poterle verificare. */
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
        set strokeStyle(v: string) { calls.push(`strokeStyle=${v}`); },
        set lineWidth(v: number) { calls.push(`lineWidth=${Math.round(v)}`); },
        set lineCap(v: string) { calls.push(`lineCap=${v}`); },
        set lineJoin(v: string) { calls.push(`lineJoin=${v}`); },
      } as unknown as CanvasRenderingContext2D,
    };
  }

  it('pulisce la tela prima di disegnare', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [], 500);
    expect(calls[0]).toBe('clearRect(0,0,500,500)');
  });

  it('scala le coordinate dallo spazio logico ai pixel', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 0, p: [0, 0, 1000, 1000] }], 500);
    expect(calls).toContain('moveTo(0,0)');
    expect(calls).toContain('lineTo(500,500)');
  });

  it('scala anche lo spessore del tratto', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 2, p: [0, 0, 100, 100] }], 500);
    expect(calls).toContain('lineWidth=15'); // 30 unità su tela da 500 px
  });

  it('usa il colore della palette corrispondente all’indice', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 1, w: 0, p: [0, 0, 10, 10] }], 500);
    expect(calls).toContain(`strokeStyle=${PALETTE[1]}`);
  });

  it('usa estremità arrotondate', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 0, p: [0, 0, 10, 10] }], 500);
    expect(calls).toContain('lineCap=round');
    expect(calls).toContain('lineJoin=round');
  });

  it('interpola con curve quando i punti sono più di due', () => {
    const { ctx, calls } = fakeCtx();
    drawStrokes(ctx, [{ c: 0, w: 0, p: [0, 0, 100, 0, 200, 100] }], 1000);
    expect(calls.some((c) => c.startsWith('quadraticCurveTo'))).toBe(true);
  });

  it('disegna solo i primi N tratti quando richiesto — è la base del replay', () => {
    const { ctx, calls } = fakeCtx();
    const three: Stroke[] = [
      { c: 0, w: 0, p: [0, 0, 10, 10] },
      { c: 1, w: 0, p: [0, 0, 10, 10] },
      { c: 2, w: 0, p: [0, 0, 10, 10] },
    ];
    drawStrokes(ctx, three, 500, 2);
    expect(calls.filter((c) => c === 'stroke()')).toHaveLength(2);
  });
});
