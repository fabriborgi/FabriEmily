import { describe, it, expect } from 'vitest';
import {
  initialState, direction, barPosition, homeRange, rollDice, dieValuesForRoll,
  mustEnterFromBar, isLegalSingleMove, legalSources, applySingleMove, isWin,
  type BoardState, type PointState,
} from './board';

function emptyPoints(): Record<number, PointState> {
  const points: Record<number, PointState> = {};
  for (let p = 1; p <= 24; p++) points[p] = null;
  return points;
}

describe('direction, barPosition, homeRange', () => {
  it("chi inizia si muove in decrescente (24→1), l'altro in crescente (1→24)", () => {
    expect(direction('fabrizio', 'fabrizio')).toBe(-1);
    expect(direction('emily', 'fabrizio')).toBe(1);
  });

  it('la posizione virtuale della barra è 25 per chi decresce, 0 per chi cresce', () => {
    expect(barPosition('fabrizio', 'fabrizio')).toBe(25);
    expect(barPosition('emily', 'fabrizio')).toBe(0);
  });

  it('la casa è 1-6 per chi decresce, 19-24 per chi cresce', () => {
    expect(homeRange('fabrizio', 'fabrizio')).toEqual([1, 6]);
    expect(homeRange('emily', 'fabrizio')).toEqual([19, 24]);
  });
});

describe('initialState', () => {
  it('posiziona le 15 pedine a testa nella disposizione standard', () => {
    const state = initialState('fabrizio');
    expect(state.points[24]).toEqual({ owner: 'fabrizio', count: 2 });
    expect(state.points[13]).toEqual({ owner: 'fabrizio', count: 5 });
    expect(state.points[8]).toEqual({ owner: 'fabrizio', count: 3 });
    expect(state.points[6]).toEqual({ owner: 'fabrizio', count: 5 });
    expect(state.points[1]).toEqual({ owner: 'emily', count: 2 });
    expect(state.points[12]).toEqual({ owner: 'emily', count: 5 });
    expect(state.points[17]).toEqual({ owner: 'emily', count: 3 });
    expect(state.points[19]).toEqual({ owner: 'emily', count: 5 });
    expect(state.bar).toEqual({ fabrizio: 0, emily: 0 });
    expect(state.borneOff).toEqual({ fabrizio: 0, emily: 0 });
  });
});

describe('dieValuesForRoll', () => {
  it('un tiro normale dà 2 valori', () => {
    expect(dieValuesForRoll([2, 5])).toEqual([2, 5]);
  });

  it('un doppio dà 4 valori uguali', () => {
    expect(dieValuesForRoll([3, 3])).toEqual([3, 3, 3, 3]);
  });
});

describe('isLegalSingleMove — movimento e cattura', () => {
  it('una mossa semplice verso una casella vuota è legale', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 2 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 24, 3)).toBe(true);
  });

  it('catturare un blot avversario (1 sola pedina) è legale', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 2 }, 21: { owner: 'emily', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 24, 3)).toBe(true);
  });

  it('una casella con 2+ pedine avversarie è bloccata', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 2 }, 21: { owner: 'emily', count: 2 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 24, 3)).toBe(false);
  });
});

describe('applySingleMove — movimento e cattura', () => {
  it('una mossa semplice sposta la pedina', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 2 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    const next = applySingleMove(state, 'fabrizio', 'fabrizio', 24, 3);
    expect(next.points[24]).toEqual({ owner: 'fabrizio', count: 1 });
    expect(next.points[21]).toEqual({ owner: 'fabrizio', count: 1 });
  });

  it('catturare un blot lo manda sulla barra dell\'avversario', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 2 }, 21: { owner: 'emily', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    const next = applySingleMove(state, 'fabrizio', 'fabrizio', 24, 3);
    expect(next.points[21]).toEqual({ owner: 'fabrizio', count: 1 });
    expect(next.bar.emily).toBe(1);
  });
});

describe('rientro obbligato dalla barra', () => {
  it("con pedine sulla barra, l'unica partenza legale è la barra stessa", () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 1, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    // Tentare di muovere la pedina normale sul 24 è illegale finché la barra non è vuota.
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 24, 3)).toBe(false);
    // Rientrare dalla barra (posizione virtuale 25) è legale se la casella d'ingresso è libera.
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 25, 3)).toBe(true);
  });

  it('mustEnterFromBar è vero solo con pedine sulla barra', () => {
    const withBar: BoardState = {
      points: emptyPoints(),
      bar: { fabrizio: 1, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    const withoutBar: BoardState = { ...withBar, bar: { fabrizio: 0, emily: 0 } };
    expect(mustEnterFromBar(withBar, 'fabrizio')).toBe(true);
    expect(mustEnterFromBar(withoutBar, 'fabrizio')).toBe(false);
  });

  it('legalSources con pedine sulla barra restituisce solo la barra (se legale)', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 24: { owner: 'fabrizio', count: 1 }, 22: { owner: 'emily', count: 2 } },
      bar: { fabrizio: 1, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    // Con die=3, il rientro andrebbe in 25-3=22, bloccata da 2 pedine avversarie: nessuna sorgente legale.
    expect(legalSources(state, 'fabrizio', 'fabrizio', 3)).toEqual([]);
    // Con die=1, il rientro va in 25-1=24, dove c'è già una propria pedina: legale.
    expect(legalSources(state, 'fabrizio', 'fabrizio', 1)).toEqual([25]);
  });
});

describe('turno che può finire con un dado inutilizzato', () => {
  it('legalSources è un array vuoto quando nessuna pedina propria ha una mossa legale per quel dado', () => {
    // Le uniche due pedine di fabrizio sono bloccate: dal 24 un dado 2 andrebbe sul 22
    // (2+ pedine avversarie, bloccato), dal 6 un dado 2 andrebbe sul 4 (idem). Il turno
    // può quindi terminare con questo dado inutilizzato, senza ricerca combinatoria.
    const state: BoardState = {
      points: {
        ...emptyPoints(),
        24: { owner: 'fabrizio', count: 1 },
        22: { owner: 'emily', count: 2 },
        6: { owner: 'fabrizio', count: 1 },
        4: { owner: 'emily', count: 2 },
      },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(legalSources(state, 'fabrizio', 'fabrizio', 2)).toEqual([]);
  });
});

describe('isWin', () => {
  it('è vero solo con tutte e 15 le pedine tolte', () => {
    const state: BoardState = {
      points: emptyPoints(),
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 15, emily: 10 },
    };
    expect(isWin(state, 'fabrizio')).toBe(true);
    expect(isWin(state, 'emily')).toBe(false);
  });
});
