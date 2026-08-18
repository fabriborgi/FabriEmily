'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { drawStrokes, type Stroke } from './strokes';
import styles from './letters.module.css';

const REPLAY_MS = 2000;

/**
 * Ridisegna il disegno tratto per tratto, in circa due secondi.
 * Avendo i tratti in ordine costa quasi nulla, e vedere la mano dell'altro
 * muoversi è la ragione per cui questo formato è stato scelto.
 */
export function DrawingReplay({ strokes }: { strokes: Stroke[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const frameRef = useRef<number | null>(null);

  const paint = useCallback(
    (visible: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || size === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      drawStrokes(ctx, strokes, size, visible);
    },
    [size, strokes],
  );

  // La tela è quadrata e larga quanto il contenitore: si misura una volta e a ogni resize.
  useEffect(() => {
    const measure = () => setSize(canvasRef.current?.parentElement?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    paint(strokes.length);
  }, [paint, strokes.length]);

  const replay = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / REPLAY_MS);
      paint(Math.max(1, Math.ceil(progress * strokes.length)));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className={styles.replayWrap}>
      <canvas ref={canvasRef} className={styles.replayCanvas} role="img" aria-label="Drawing" />
      <button className={styles.replayButton} onClick={replay}>
        ▸ Watch it again
      </button>
    </div>
  );
}
