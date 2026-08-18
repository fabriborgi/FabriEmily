/**
 * Formato dei disegni. Un disegno è una lista di tratti, ogni tratto è un colore,
 * uno spessore e una polilinea in uno spazio logico 1000 × 1000 con coordinate intere.
 *
 * Perché vettoriale e non un PNG: annullare è togliere l'ultimo elemento da un array,
 * il peso è di qualche kilobyte invece di qualche centinaio, non serve Storage, e i
 * tratti sono in ordine — quindi il disegno si può rigiocare come è stato fatto.
 *
 * I limiti qui sono gli stessi che il database valida in assert_valid_strokes:
 * il client non deve poter produrre dati che il database rifiuterebbe.
 */

export const PALETTE = [
  '#1F2933', // 0 ink
  '#E4572E', // 1 red
  '#F4A259', // 2 orange
  '#F2C14E', // 3 yellow
  '#8FBC5A', // 4 lime
  '#2E9E6B', // 5 green
  '#2AA8A8', // 6 teal
  '#4C9BE8', // 7 sky
  '#3355C4', // 8 blue
  '#7B5EA7', // 9 violet
  '#E86AA6', // 10 pink
  '#8C6239', // 11 brown
] as const;

export const WIDTHS = [6, 14, 30] as const;
export const CANVAS_UNITS = 1000;
export const MAX_STROKES = 200;
export const MAX_POINTS_PER_STROKE = 400;
export const MIN_POINT_DISTANCE = 4;
/** Solo per la copy dell'interfaccia: la regola vera vive in coin_rules. */
export const MIN_STROKES_FOR_REWARD = 5;

export type Stroke = { c: number; w: number; p: number[] };

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Da pixel della tela a unità logiche. Il taglio evita coordinate fuori range
 *  quando il dito esce dalla tela durante il tratto. */
export function toUnits(px: number, sizePx: number): number {
  return Math.round(clamp((px / sizePx) * CANVAS_UNITS, 0, CANVAS_UNITS));
}

export function startStroke(c: number, w: number, x: number, y: number): Stroke {
  return { c, w, p: [x, y] };
}

/**
 * Aggiunge un punto, scartandolo se troppo vicino al precedente o se il tratto è pieno.
 * Ritorna lo **stesso riferimento** quando non aggiunge nulla: così il chiamante può
 * evitare un re-render con un semplice confronto di identità.
 */
export function appendPoint(stroke: Stroke, x: number, y: number): Stroke {
  if (stroke.p.length >= MAX_POINTS_PER_STROKE * 2) return stroke;
  const lastX = stroke.p[stroke.p.length - 2];
  const lastY = stroke.p[stroke.p.length - 1];
  if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE) return stroke;
  return { ...stroke, p: [...stroke.p, x, y] };
}

export function undo(strokes: Stroke[]): Stroke[] {
  return strokes.slice(0, -1);
}

export function canAddStroke(strokes: Stroke[]): boolean {
  return strokes.length < MAX_STROKES;
}

export function isStrokeArray(value: unknown): value is Stroke[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STROKES) return false;
  return value.every((stroke) => {
    if (typeof stroke !== 'object' || stroke === null) return false;
    const { c, w, p } = stroke as Partial<Stroke>;
    if (!Number.isInteger(c) || c! < 0 || c! >= PALETTE.length) return false;
    if (!Number.isInteger(w) || w! < 0 || w! >= WIDTHS.length) return false;
    if (!Array.isArray(p) || p.length < 2 || p.length % 2 !== 0) return false;
    if (p.length > MAX_POINTS_PER_STROKE * 2) return false;
    // Le coordinate sono uno spazio logico intero: un valore frazionario qui
    // passerebbe la validazione ma verrebbe rifiutato dal database
    // (assert_valid_strokes, Task 5) — il client non deve produrre dati che
    // il database rifiuterebbe.
    return p.every((n) => Number.isInteger(n) && n >= 0 && n <= CANVAS_UNITS);
  });
}

/**
 * Disegna su una tela quadrata di `sizePx` pixel di lato.
 * `visibleStrokes` limita quanti tratti disegnare: è tutto ciò che serve al replay.
 */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  sizePx: number,
  visibleStrokes?: number,
): void {
  const scale = sizePx / CANVAS_UNITS;
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const count = visibleStrokes ?? strokes.length;
  for (const stroke of strokes.slice(0, count)) {
    const points = stroke.p;
    ctx.strokeStyle = PALETTE[stroke.c] ?? PALETTE[0];
    ctx.lineWidth = (WIDTHS[stroke.w] ?? WIDTHS[0]) * scale;
    ctx.beginPath();
    ctx.moveTo(points[0] * scale, points[1] * scale);

    if (points.length === 4) {
      ctx.lineTo(points[2] * scale, points[3] * scale);
    } else {
      // Curve quadratiche fra i punti medi: il tratto risulta liscio invece di spigoloso.
      for (let i = 2; i < points.length - 2; i += 2) {
        const midX = (points[i] + points[i + 2]) / 2;
        const midY = (points[i + 1] + points[i + 3]) / 2;
        ctx.quadraticCurveTo(points[i] * scale, points[i + 1] * scale, midX * scale, midY * scale);
      }
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      ctx.lineTo(lastX * scale, lastY * scale);
    }
    ctx.stroke();
  }
}
