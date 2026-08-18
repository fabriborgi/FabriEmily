'use client';

import { useEffect, useRef } from 'react';
import { drawStrokes, type Stroke } from './strokes';

/**
 * Ridisegna i tratti su una tela piccola. Nessun thumbnail viene generato o salvato:
 * i tratti SONO il disegno, e ridisegnarli costa meno di scaricare un'immagine.
 */
export function DrawingThumbnail({
  strokes,
  size,
  label,
}: {
  strokes: Stroke[];
  size: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // in jsdom getContext è null: il componente resta valido
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    drawStrokes(ctx, strokes, size);
  }, [strokes, size]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      style={{ width: size, height: size, borderRadius: 'var(--radius-md)', background: 'var(--paper)' }}
    />
  );
}
