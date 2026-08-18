import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

type Stroke = { c: number; w: number; p: number[] };

const stroke = (c = 0, w = 0): Stroke => ({ c, w, p: [10, 10, 20, 20, 30, 25] });
const strokes = (n: number): Stroke[] => Array.from({ length: n }, (_, i) => stroke(i % 12));

const draw = async (author: string, s: unknown) =>
  (
    await sql<{ id: string; kind: string; strokes: Stroke[] }>(
      `select * from create_letter($1::person, 'drawing'::letter_kind, null, $2::jsonb)`,
      [author, JSON.stringify(s)],
    )
  )[0];

const coins = async () =>
  (await sql<{ coins: number }>('select coins from couple_state where id = 1'))[0].coins;

const letterCount = async () => (await sql('select 1 from letters')).length;

describe('create_letter — disegni', () => {
  beforeEach(resetData);

  it('salva i tratti e li restituisce identici', async () => {
    const input = strokes(5);
    const letter = await draw('emily', input);
    expect(letter.kind).toBe('drawing');
    expect(letter.strokes).toEqual(input);
  });

  it('accredita 20 monete da 5 tratti in su', async () => {
    await draw('emily', strokes(5));
    expect(await coins()).toBe(20);
  });

  it('salva ma non paga un disegno di 4 tratti', async () => {
    await draw('emily', strokes(4));
    expect(await letterCount()).toBe(1);
    expect(await coins()).toBe(0);
  });

  it('salva ma non paga il terzo disegno della giornata', async () => {
    await draw('fabrizio', strokes(5));
    await draw('fabrizio', strokes(5));
    expect(await coins()).toBe(40);
    await draw('fabrizio', strokes(5));
    expect(await coins()).toBe(40);
    expect(await letterCount()).toBe(3);
  });

  it('i cap di lettere e disegni sono indipendenti', async () => {
    for (let i = 0; i < 3; i++) {
      await sql(`select create_letter('emily'::person, 'text'::letter_kind, $1, null)`, [
        'a'.repeat(50),
      ]);
    }
    await draw('emily', strokes(5));
    expect(await coins()).toBe(45 + 20);
  });

  const invalid: Array<[string, unknown]> = [
    ['array vuoto', []],
    ['oltre 200 tratti', strokes(201)],
    ['colore fuori dalla palette', [{ c: 12, w: 0, p: [1, 1, 2, 2] }]],
    ['colore negativo', [{ c: -1, w: 0, p: [1, 1, 2, 2] }]],
    ['spessore inesistente', [{ c: 0, w: 3, p: [1, 1, 2, 2] }]],
    ['coordinate di lunghezza dispari', [{ c: 0, w: 0, p: [1, 1, 2] }]],
    ['un solo punto', [{ c: 0, w: 0, p: [] }]],
    ['coordinata oltre 1000', [{ c: 0, w: 0, p: [1, 1, 1001, 2] }]],
    ['coordinata negativa', [{ c: 0, w: 0, p: [1, -1, 2, 2] }]],
    ['coordinata non numerica', [{ c: 0, w: 0, p: [1, 1, 'x', 2] }]],
    ['oltre 400 punti', [{ c: 0, w: 0, p: Array.from({ length: 802 }, () => 5) }]],
    ['campo p mancante', [{ c: 0, w: 0 }]],
    ['tratto non oggetto', ['ciao']],
    ['non è un array', { c: 0 }],
    // Regressione: c/w e le coordinate sono indici/interi, non devono accettare frazionari.
    ['colore frazionario', [{ c: 0.5, w: 0, p: [1, 1, 2, 2] }]],
    ['spessore frazionario', [{ c: 0, w: 1.9999, p: [1, 1, 2, 2] }]],
    ['coordinata frazionaria', [{ c: 0, w: 0, p: [1.5, 2.7, 999.999, 0.0001] }]],
    // Regressione: chiavi extra oltre a {c, w, p} vanno rifiutate.
    ['chiave extra nel tratto', [{ c: 0, w: 0, p: [1, 1, 2, 2], junk: 'x'.repeat(1000) }]],
  ];

  it.each(invalid)('rifiuta: %s', async (_name, payload) => {
    await expect(draw('emily', payload)).rejects.toThrow(/invalid_strokes/);
    expect(await letterCount()).toBe(0);
    expect(await coins()).toBe(0);
  });

  it('accetta esattamente 200 tratti e 400 punti', async () => {
    const big: Stroke[] = [
      { c: 0, w: 2, p: Array.from({ length: 800 }, (_, i) => i % 1000) },
      ...strokes(199),
    ];
    const letter = await draw('emily', big);
    expect(letter.strokes).toHaveLength(200);
  });

  it('accetta i valori interi al limite (c: 11, w: 2, coordinate 0 e 1000)', async () => {
    const input: Stroke[] = [{ c: 11, w: 2, p: [0, 0, 1000, 1000] }];
    const letter = await draw('emily', input);
    expect(letter.strokes).toEqual(input);
  });
});
