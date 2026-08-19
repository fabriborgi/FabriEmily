import { describe, it, expect } from 'vitest';
import {
  applyRoll, isWin, squareGridPosition, squareKind,
  BRIDGE_TARGET, INN, WELL, LABYRINTH_TARGET, PRISON,
} from './board';

describe('applyRoll', () => {
  it('somma i due dadi e avanza senza effetti su una casella semplice', () => {
    expect(applyRoll(1, [1, 2])).toEqual({ position: 4, stuckTurns: 0 });
  });

  it('rimbalza indietro se supera la casella 63', () => {
    // da 60, somma 5 → 65, eccesso 2 → rimbalza a 61
    expect(applyRoll(60, [2, 3])).toEqual({ position: 61, stuckTurns: 0 });
  });

  it('vittoria esatta a 63', () => {
    expect(applyRoll(61, [1, 1])).toEqual({ position: 63, stuckTurns: 0 });
  });

  it("un'oca ripete lo stesso tiro dalla nuova posizione, e può incatenarsi", () => {
    // 1 + somma 4 = 5 (oca) → ripete +4 = 9 (oca di nuovo) → ripete +4 = 13, non speciale
    expect(applyRoll(1, [2, 2])).toEqual({ position: 13, stuckTurns: 0 });
  });

  it('una catena che rimbalza a metà può terminare su una casella speciale non-oca', () => {
    // 41 (oca) + somma 9 = 50 (oca) → +9 = 59 (oca) → +9 = 68, rimbalza a 58 (morte)
    // 58 non è un'oca: la catena si ferma lì e si applica l'effetto morte.
    expect(applyRoll(41, [4, 5])).toEqual({ position: 0, stuckTurns: 0 });
  });

  it("una catena può arrivare esatta alla casella 63 e vincere", () => {
    // 45 (oca) + somma 9 = 54 (oca) → +9 = 63, arrivo esatto: non è un'oca, la catena si ferma qui.
    expect(applyRoll(45, [4, 5])).toEqual({ position: 63, stuckTurns: 0 });
  });

  it('una catena che rimbalzerebbe esattamente sulla stessa oca si ferma lì invece di ciclare all\'infinito', () => {
    // 51 + somma 8 = 59 (oca) → rimbalzo di 59+8=67 torna esattamente a 59:
    // senza un limite sulle caselle già visitate, questo tiro non terminerebbe mai.
    expect(applyRoll(51, [2, 6])).toEqual({ position: 59, stuckTurns: 0 });
  });

  it('il ponte porta alla casella 12', () => {
    expect(applyRoll(1, [2, 3])).toEqual({ position: BRIDGE_TARGET, stuckTurns: 0 }); // 1+5=6=ponte
  });

  it('la locanda blocca per 1 turno', () => {
    expect(applyRoll(15, [2, 2])).toEqual({ position: INN, stuckTurns: 1 }); // 15+4=19=locanda
  });

  it('il pozzo blocca per 2 turni', () => {
    expect(applyRoll(29, [1, 1])).toEqual({ position: WELL, stuckTurns: 2 }); // 29+2=31=pozzo
  });

  it('il labirinto riporta alla casella 30', () => {
    expect(applyRoll(38, [2, 2])).toEqual({ position: LABYRINTH_TARGET, stuckTurns: 0 }); // 38+4=42=labirinto
  });

  it('la prigione blocca per 2 turni', () => {
    expect(applyRoll(49, [1, 2])).toEqual({ position: PRISON, stuckTurns: 2 }); // 49+3=52=prigione
  });

  it('la morte riporta alla casella 0', () => {
    expect(applyRoll(55, [1, 2])).toEqual({ position: 0, stuckTurns: 0 }); // 55+3=58=morte
  });
});

describe('isWin', () => {
  it('è vero solo alla casella 63', () => {
    expect(isWin(63)).toBe(true);
    expect(isWin(62)).toBe(false);
  });
});

describe('squareKind', () => {
  it('riconosce ogni tipo di casella speciale', () => {
    expect(squareKind(5)).toBe('goose');
    expect(squareKind(6)).toBe('bridge');
    expect(squareKind(19)).toBe('inn');
    expect(squareKind(31)).toBe('well');
    expect(squareKind(42)).toBe('labyrinth');
    expect(squareKind(52)).toBe('prison');
    expect(squareKind(58)).toBe('death');
    expect(squareKind(63)).toBe('goal');
    expect(squareKind(1)).toBeNull();
  });
});

describe('squareGridPosition', () => {
  it('mappa le caselle sulla griglia a serpentina (riga 0 in alto)', () => {
    expect(squareGridPosition(1)).toEqual({ row: 8, col: 0 });
    expect(squareGridPosition(7)).toEqual({ row: 8, col: 6 });
    expect(squareGridPosition(8)).toEqual({ row: 7, col: 6 });
    expect(squareGridPosition(14)).toEqual({ row: 7, col: 0 });
    expect(squareGridPosition(63)).toEqual({ row: 0, col: 6 });
  });
});
