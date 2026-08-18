'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PALETTE,
  WIDTHS,
  MAX_STROKES,
  MIN_STROKES_FOR_REWARD,
  appendPoint,
  canAddStroke,
  drawStrokes,
  startStroke,
  toUnits,
  undo,
  type Stroke,
} from './strokes';
import { loadDraft, saveDraft, clearDraft } from './draft';
import styles from './draw.module.css';

const DRAFT_DEBOUNCE_MS = 1000;

export function DrawingCanvas({
  onSend,
  busy,
  error,
}: {
  onSend: (strokes: Stroke[]) => void;
  busy: boolean;
  error?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const drawing = useRef<Stroke | null>(null);

  // Bozza recuperata all'apertura: se l'app è stata scaricata dalla memoria, il disegno è ancora qui.
  useEffect(() => {
    setStrokes(loadDraft(window.localStorage));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveDraft(window.localStorage, strokes), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [strokes]);

  // Tela quadrata, larga quanto il contenitore.
  useEffect(() => {
    const measure = () => setSize(canvasRef.current?.parentElement?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const repaint = useCallback(
    (list: Stroke[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || size === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      drawStrokes(ctx, list, size);
    },
    [size],
  );

  useEffect(() => {
    repaint(drawing.current ? [...strokes, drawing.current] : strokes);
  }, [repaint, strokes]);

  const pointToUnits = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: toUnits(event.clientX - rect.left, rect.width),
      y: toUnits(event.clientY - rect.top, rect.height),
    };
  };

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canAddStroke(strokes)) {
      setNotice(`That's ${MAX_STROKES} strokes — send it before adding more.`);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = pointToUnits(event);
    drawing.current = startStroke(color, width, x, y);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = drawing.current;
    if (!current) return;
    const { x, y } = pointToUnits(event);
    const next = appendPoint(current, x, y);
    // Identità invariata = punto scartato: niente ridisegno.
    if (next === current) return;
    drawing.current = next;
    repaint([...strokes, next]);
  }

  function onPointerUp() {
    const current = drawing.current;
    drawing.current = null;
    if (current) setStrokes((list) => [...list, current]);
  }

  const missing = MIN_STROKES_FOR_REWARD - strokes.length;

  return (
    <div className={styles.editor}>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ touchAction: 'none' }}
          aria-label="Drawing area"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className={styles.swatches} role="radiogroup" aria-label="Colors">
        {PALETTE.map((hex, index) => (
          <button
            key={hex}
            role="radio"
            aria-label={`Color ${index + 1}`}
            aria-checked={color === index}
            className={color === index ? styles.swatchActive : styles.swatch}
            style={{ background: hex }}
            onClick={() => setColor(index)}
          />
        ))}
      </div>

      <div className={styles.tools}>
        <div className={styles.widths} role="radiogroup" aria-label="Brush sizes">
          {WIDTHS.map((unit, index) => (
            <button
              key={unit}
              role="radio"
              aria-label={`Brush ${index + 1}`}
              aria-checked={width === index}
              className={width === index ? styles.widthActive : styles.width}
              onClick={() => setWidth(index)}
            >
              <span style={{ width: 4 + index * 8, height: 4 + index * 8 }} className={styles.dot} />
            </button>
          ))}
        </div>

        <button
          className={styles.tool}
          onClick={() => setStrokes(undo)}
          disabled={strokes.length === 0}
        >
          Undo
        </button>
        <button
          className={styles.tool}
          disabled={strokes.length === 0}
          onClick={() => {
            if (window.confirm('Clear the whole drawing?')) {
              setStrokes([]);
              clearDraft(window.localStorage);
            }
          }}
        >
          Clear
        </button>
      </div>

      <p className={styles.counter}>
        {missing > 0 ? `${missing} more strokes to earn coins` : 'This one is worth 20 coins'}
      </p>
      {notice && <p className={styles.counter}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.send}
        disabled={busy || strokes.length === 0}
        onClick={() => onSend(strokes)}
      >
        {busy ? 'Sending…' : 'Send it'}
      </button>
    </div>
  );
}
