import type { Person } from '@/features/auth/identity';

export type PointState = { owner: Person; count: number } | null;
export type BoardState = {
  points: Record<number, PointState>;
  bar: Record<Person, number>;
  borneOff: Record<Person, number>;
};

export const POINTS = 24;

/** `startedBy` si muove in decrescente (24→1), l'altro in crescente (1→24). */
export function direction(person: Person, startedBy: Person): 1 | -1 {
  return person === startedBy ? -1 : 1;
}

/** Posizione virtuale della barra per questa persona — mai un punto reale 1-24. */
export function barPosition(person: Person, startedBy: Person): number {
  return person === startedBy ? 25 : 0;
}

/** Range dei punti "casa", dove si può iniziare il bear-off. */
export function homeRange(person: Person, startedBy: Person): [number, number] {
  return person === startedBy ? [1, 6] : [19, 24];
}

export function initialState(startedBy: Person): BoardState {
  const other: Person = startedBy === 'fabrizio' ? 'emily' : 'fabrizio';
  const points: Record<number, PointState> = {};
  for (let p = 1; p <= POINTS; p++) points[p] = null;

  points[24] = { owner: startedBy, count: 2 };
  points[13] = { owner: startedBy, count: 5 };
  points[8] = { owner: startedBy, count: 3 };
  points[6] = { owner: startedBy, count: 5 };

  points[1] = { owner: other, count: 2 };
  points[12] = { owner: other, count: 5 };
  points[17] = { owner: other, count: 3 };
  points[19] = { owner: other, count: 5 };

  return { points, bar: { fabrizio: 0, emily: 0 }, borneOff: { fabrizio: 0, emily: 0 } };
}

export function rollDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

/** Un doppio dà 4 valori uguali; un tiro normale dà i 2 valori tirati. */
export function dieValuesForRoll(dice: [number, number]): number[] {
  if (dice[0] === dice[1]) return [dice[0], dice[0], dice[0], dice[0]];
  return [dice[0], dice[1]];
}

export function mustEnterFromBar(state: BoardState, person: Person): boolean {
  return state.bar[person] > 0;
}

export function isOffBoard(to: number, dir: 1 | -1): boolean {
  return dir === -1 ? to < 1 : to > 24;
}

export function isLegalSingleMove(
  state: BoardState,
  person: Person,
  startedBy: Person,
  from: number,
  die: number,
): boolean {
  const dir = direction(person, startedBy);
  const bar = barPosition(person, startedBy);

  // Con pedine sulla barra, l'unica partenza legale è la barra stessa.
  if (mustEnterFromBar(state, person) && from !== bar) return false;

  if (from === bar) {
    if (state.bar[person] <= 0) return false;
  } else {
    const point = state.points[from];
    if (!point || point.owner !== person) return false;
  }

  const to = from + dir * die;

  if (isOffBoard(to, dir)) {
    return isLegalBearOff(state, person, startedBy, from, die);
  }

  const target = state.points[to];
  if (!target) return true;
  if (target.owner === person) return true;
  return target.count === 1;
}

export function legalSources(
  state: BoardState,
  person: Person,
  startedBy: Person,
  die: number,
): number[] {
  if (mustEnterFromBar(state, person)) {
    const bar = barPosition(person, startedBy);
    return isLegalSingleMove(state, person, startedBy, bar, die) ? [bar] : [];
  }
  const sources: number[] = [];
  for (let p = 1; p <= POINTS; p++) {
    const point = state.points[p];
    if (point && point.owner === person && isLegalSingleMove(state, person, startedBy, p, die)) {
      sources.push(p);
    }
  }
  return sources;
}

export function applySingleMove(
  state: BoardState,
  person: Person,
  startedBy: Person,
  from: number,
  die: number,
): BoardState {
  const dir = direction(person, startedBy);
  const to = from + dir * die;
  const bar = barPosition(person, startedBy);

  const points = { ...state.points };
  const barCount = { ...state.bar };
  const borneOff = { ...state.borneOff };

  if (from === bar) {
    barCount[person] -= 1;
  } else {
    const source = points[from]!;
    points[from] = source.count > 1 ? { owner: person, count: source.count - 1 } : null;
  }

  if (isOffBoard(to, dir)) {
    borneOff[person] += 1;
  } else {
    const target = points[to];
    if (target && target.owner !== person) {
      const opponent = target.owner;
      barCount[opponent] += 1;
      points[to] = { owner: person, count: 1 };
    } else if (target) {
      points[to] = { owner: person, count: target.count + 1 };
    } else {
      points[to] = { owner: person, count: 1 };
    }
  }

  return { points, bar: barCount, borneOff };
}

export function isWin(state: BoardState, person: Person): boolean {
  return state.borneOff[person] === 15;
}

// --- Bear-off: implementato nel Task 3. Stub temporaneo, sostituito per intero dal Task 3. ---
function isLegalBearOff(
  _state: BoardState,
  _person: Person,
  _startedBy: Person,
  _from: number,
  _die: number,
): boolean {
  throw new Error('not implemented until Task 3');
}
