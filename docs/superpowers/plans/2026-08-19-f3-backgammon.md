# Backgammon · Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le due persone giocano a Backgammon in modo asincrono, riusando esattamente il motore di F2 (`game_matches`, `create_match`, `make_move`) senza modificarlo — ogni turno è un tiro di 2 dadi seguito da un massimo di 4 mosse (2 normalmente, 4 se doppio), con cattura di blot, rientro obbligato dalla barra e bear-off finale con la regola dell'eccedenza; vince chi toglie tutte e 15 le pedine per primo.

**Architecture:** Una sola riga di migrazione (`alter type game_type add value 'backgammon'`), zero funzioni nuove. Il turno intero (tiro + tutte le mosse) è **una sola** `make_move`, calcolata interamente lato client prima dell'invio — lo stato persistito contiene solo `points`/`bar`/`borneOff`, mai i dadi. Il frontend è diviso in due file di logica pura per isolare il rischio: `features/games/backgammon/board.ts` con movimento/cattura/barra in un task e le regole di bear-off (comprese quelle sull'eccedenza) in un task separato, poi `BackgammonBoard.tsx` con un flusso "scegli il dado, poi tocca la pedina di partenza" — la destinazione è sempre calcolata, mai una scelta separata.

**Tech Stack:** Stesso di F0+F1/F5/F6/F2/F3/F4 — Next.js App Router, TypeScript strict, `@supabase/supabase-js`, Vitest (unit in jsdom, integrazione contro Supabase locale).

**Spec di riferimento:** [`docs/superpowers/specs/2026-08-19-f3-backgammon-design.md`](../specs/2026-08-19-f3-backgammon-design.md)

**Branch:** nuovo branch da `main` (che contiene già F0+F1, F5, F6, F2, F3.1, F3.2, F4.1, F4.2, Gioco dell'Oca, Quoridor in produzione), in un worktree isolato

## Global Constraints

- Lingua dell'interfaccia: inglese. Commenti e documentazione in italiano.
- Mobile-first, viewport di riferimento 390 × 844 px. Target di tocco INTERATTIVI il più vicino possibile a 44 × 44 px: le 24 celle-punto del tabellone e i 4 chip dei dadi sono più piccoli per necessità di spazio (24 punti su una griglia 2×12 non possono garantire 44px su 390px, stessa eccezione già documentata per Quoridor); i pulsanti "Roll dice"/"Reset turn"/"End turn"/"New game" restano sopra i 44px.
- **Semplificazione grafica dichiarata**: il tabellone si disegna come una griglia semplice a 2 righe di 12 punti (riga superiore 13-24 da sinistra a destra, riga inferiore 12-1 da sinistra a destra), con barra e uscite mostrate come righe di testo separate sopra/sotto la griglia — non il layout fisico a "clessidra" con la barra al centro che divide ogni riga in due gruppi da 6. Scelta pragmatica per i tempi stretti, non un tentativo di fedeltà visiva completa.
- Nessuna scrittura diretta dal client: solo `.select()` e `.rpc()`.
- Nessun colore letterale nei componenti: solo variabili CSS già definite in `app/globals.css`.
- TypeScript strict: nessun `any` implicito, nessun `@ts-ignore`.
- Nessuna nuova funzione Postgres, nessuna nuova tabella: `create_match`/`make_move` (F2) funzionano già per qualunque `game_type`.
- Dopo la migrazione, rigenerare `lib/types.ts` con `npm run db:types` e includerlo nel commit. **Attenzione nota**: `npm run db:types` rigenera l'intero file e può cancellare un fix manuale pre-esistente su `lib/types.ts` (il campo `p_skin_key` della funzione `select_pet_skin`, che deve restare `string | null`, non `string` — la CLI di Supabase non deduce quella nullability). Dopo aver rigenerato i tipi in questo piano, esegui `npx tsc --noEmit` e, se fallisce con un errore su `select_pet_skin`/`p_skin_key`, apri `lib/types.ts`, trova quella entry sotto `Functions`, e correggi `Args: { p_skin_key: string; ... }` in `Args: { p_skin_key: string | null; ... }` prima di proseguire — non è un problema di questo piano.
- Commit dopo ogni task, messaggio in italiano, prefisso convenzionale (`feat:`, `test:`, `fix:`).
- Le monete usano le regole `game_win`/`game_loss` già seminate in F0+F1 — nessun nuovo valore economico, nessun moltiplicatore gammon/backgammon, nessun cubo del raddoppio (esplicitamente esclusi in spec). Questo gioco non pareggia mai.
- Lo stato "partita appena chiusa" (board sostituita dal risultato + pulsante "New game" insieme, non un dismiss separato) è obbligatorio fin dal primo commit — difetto già trovato e corretto nella review finale di F2.
- **Rigore sui casi limite**: le ultime tre fasi di questo progetto hanno tutte avuto problemi reali trovati solo in review finale (ciclo infinito nel Gioco dell'Oca, muri invisibili in Quoridor). Ogni valore atteso nei test di questo piano è già stato verificato a mano dall'autore del piano — copiali esattamente, non ricalcolarli né "semplificarli".
- **Uso dei dadi semplificato** (decisione di spec): un dado va usato se in quel momento esiste una mossa legale con quel valore; se un dado resta senza mosse legali disponibili, il turno può finire lì con quel dado inutilizzato — nessuna ricerca combinatoria per dimostrare che esisteva un ordine migliore.

## Mappa dei file

| File | Responsabilità |
|---|---|
| `supabase/migrations/20260827090000_backgammon_game_type.sql` | `alter type game_type add value 'backgammon'` |
| `supabase/tests/backgammon_game_type.test.ts` | Prova che `create_match` funziona già per `backgammon` senza modifiche |
| `features/games/backgammon/board.ts` | Logica pura: movimento/cattura/barra (Task 2), poi bear-off (Task 3) |
| `features/games/backgammon/board.test.ts` | Unit, con tabelloni costruiti apposta per ogni caso limite |
| `features/games/games.module.css` | Modificato: aggiunte le classi del tabellone di Backgammon |
| `features/games/backgammon/BackgammonBoard.tsx` | Il tabellone, il flusso dado→pedina, "Reset turn"/"End turn", tally |
| `features/games/backgammon/BackgammonBoard.test.tsx` | Unit |
| `app/games/backgammon/page.tsx` | La schermata di gioco |
| `app/games/backgammon/page.test.tsx` | Unit |
| `app/games/page.tsx` | Modificato: Backgammon passa da assente a link giocabile |
| `app/games/page.test.tsx` | Modificato: nuovo test per il link di Backgammon |
| `docs/schema-f3-backgammon.sql` | Doc di deploy in produzione |

---

### Task 1: `game_type` include `backgammon`

**Files:**
- Create: `supabase/migrations/20260827090000_backgammon_game_type.sql`
- Create: `supabase/tests/backgammon_game_type.test.ts`
- Modify: `features/games/types.ts`

**Interfaces:**
- Consumes: `create_match`/`make_move` (F2), enum `game_type` (F2).
- Produces: `GameType = 'tic_tac_toe' | 'connect_four' | 'trivia' | 'goose' | 'quoridor' | 'backgammon'`. Consumato dai Task 2-4.

- [ ] **Step 1: Scrivi il test che deve fallire**

`supabase/tests/backgammon_game_type.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sql, resetData } from './helpers';

beforeEach(resetData);

describe('game_type include backgammon', () => {
  it('create_match apre una partita di tipo backgammon, senza alcuna modifica alla funzione', async () => {
    const rows = await sql<{ game_type: string; current_turn: string }>(
      `select * from create_match('backgammon'::game_type, 'fabrizio'::person, '{"points":{},"bar":{"fabrizio":0,"emily":0},"borneOff":{"fabrizio":0,"emily":0}}')`,
    );
    expect(rows[0].game_type).toBe('backgammon');
    expect(rows[0].current_turn).toBe('fabrizio');
  });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm run test:int -- backgammon_game_type`
Expected: FAIL — `invalid input value for enum game_type: "backgammon"`.

- [ ] **Step 3: Scrivi la migrazione**

```sql
alter type game_type add value 'backgammon';
```

- [ ] **Step 4: Applica e verifica**

Run: `npm run db:reset && npm run test:int -- backgammon_game_type`
Expected: 1 test PASS.

- [ ] **Step 5: Verifica che il resto della suite di integrazione sia ancora verde**

Run: `npm run test:int`
Expected: tutti i test PASS.

- [ ] **Step 6: Aggiorna `features/games/types.ts`**

Cambia la riga:

```ts
export type GameType = 'tic_tac_toe' | 'connect_four' | 'trivia' | 'goose' | 'quoridor';
```

in:

```ts
export type GameType = 'tic_tac_toe' | 'connect_four' | 'trivia' | 'goose' | 'quoridor' | 'backgammon';
```

- [ ] **Step 7: Rigenera i tipi**

Run: `npm run db:types`

Poi esegui `npx tsc --noEmit`. Se fallisce con un errore su `select_pet_skin`/`p_skin_key` in `lib/types.ts` (non collegato a questo task — vedi Global Constraints), correggi quella riga a `p_skin_key: string | null` e rilancia `npx tsc --noEmit` finché non è pulito.

- [ ] **Step 8: Verifica l'intera suite unit**

Run: `npm run test`
Expected: tutti i test PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase features/games/types.ts lib/types.ts
git commit -m "feat: game_type include backgammon, motore invariato"
```

### Task 2: Movimento, cattura, barra

**Files:**
- Create: `features/games/backgammon/board.ts`
- Create: `features/games/backgammon/board.test.ts`

**Interfaces:**
- Consumes: `type Person` (`@/features/auth/identity`).
- Produces: `type PointState = { owner: Person; count: number } | null`; `type BoardState = { points: Record<number, PointState>; bar: Record<Person, number>; borneOff: Record<Person, number> }`; `POINTS = 24`; `direction(person: Person, startedBy: Person): 1 | -1`; `barPosition(person: Person, startedBy: Person): number`; `homeRange(person: Person, startedBy: Person): [number, number]`; `initialState(startedBy: Person): BoardState`; `rollDice(): [number, number]`; `dieValuesForRoll(dice: [number, number]): number[]`; `mustEnterFromBar(state: BoardState, person: Person): boolean`; `isOffBoard(to: number, dir: 1 | -1): boolean` (esportata, riusata dal Task 3); `isLegalSingleMove(state: BoardState, person: Person, startedBy: Person, from: number, die: number): boolean`; `legalSources(state: BoardState, person: Person, startedBy: Person, die: number): number[]`; `applySingleMove(state: BoardState, person: Person, startedBy: Person, from: number, die: number): BoardState`; `isWin(state: BoardState, person: Person): boolean`. Consumati da Task 3 (`isOffBoard`, `homeRange`, `direction`) e Task 4 (tutto il resto).

- [ ] **Step 1: Scrivi il test che deve fallire**

`features/games/backgammon/board.test.ts`:

```ts
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
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npm run test -- features/games/backgammon/board`
Expected: FAIL — il modulo `./board` non esiste.

- [ ] **Step 3: Scrivi `features/games/backgammon/board.ts`**

```ts
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

// --- Bear-off: implementato nel Task 3, dichiarato qui come promemoria dell'ordine dei task. ---
// canBearOff, isLegalBearOff vengono aggiunte in coda a questo file dal Task 3.
```

**Nota importante**: l'ultima riga del file sopra (`isLegalSingleMove` che chiama `isLegalBearOff`) referenzia una funzione che il Task 3 aggiungerà **in coda allo stesso file**. Il file scritto in questo Task 2 non compila da solo finché il Task 3 non aggiunge `isLegalBearOff` — è previsto: lo Step 4 di questo task esegue i test con `isLegalBearOff` non ancora definita, e i test che non toccano il bear-off passano comunque a runtime perché TypeScript compila l'intero modulo ma la funzione mancante darebbe errore SOLO se effettivamente chiamata con una mossa che esce dal tabellone — nessuno dei test di questo Task 2 include una mossa che esce dal tabellone. Se preferisci non lasciare una referenza a una funzione non ancora definita, scrivi al suo posto una funzione temporanea `function isLegalBearOff(): boolean { throw new Error('not implemented until Task 3'); }` in fondo al file — verrà sostituita per intero dal Task 3.

- [ ] **Step 4: Esegui e verifica che i test passino**

Run: `npm run test -- features/games/backgammon/board`
Expected: 16 test PASS.

- [ ] **Step 5: Commit**

```bash
git add features/games/backgammon/board.ts features/games/backgammon/board.test.ts
git commit -m "feat: movimento, cattura e barra di Backgammon"
```

### Task 3: Bear-off

**Files:**
- Modify: `features/games/backgammon/board.ts`
- Modify: `features/games/backgammon/board.test.ts`

**Interfaces:**
- Consumes: `homeRange`, `direction`, `isOffBoard`, `type BoardState`, `type PointState` (Task 2).
- Produces: `canBearOff(state: BoardState, person: Person, startedBy: Person): boolean`, esportata e consumata da Task 4. Aggiunge anche una funzione interna non esportata `isLegalBearOff(state, person, startedBy, from, die): boolean`, chiamata solo da `isLegalSingleMove` nello stesso file (sostituisce la dichiarazione/funzione segnaposto del Task 2) — Task 4 non la importa mai direttamente, la raggiunge solo attraverso `isLegalSingleMove`/`legalSources`.

- [ ] **Step 1: Rimuovi il commento segnaposto (o la funzione temporanea) alla fine di `features/games/backgammon/board.ts`**

Cerca queste righe alla fine del file (scritte nel Task 2):

```ts
// --- Bear-off: implementato nel Task 3, dichiarato qui come promemoria dell'ordine dei task. ---
// canBearOff, isLegalBearOff vengono aggiunte in coda a questo file dal Task 3.
```

(oppure la funzione temporanea `function isLegalBearOff(): boolean { throw new Error(...); }` se il Task 2 ha usato quella variante) e cancellale: verranno sostituite dal contenuto dello Step 3 qui sotto.

- [ ] **Step 2: Scrivi il test che deve fallire**

Aggiungi in fondo a `features/games/backgammon/board.test.ts` (dopo il `describe('isWin', ...)` esistente, senza toccarlo). `isLegalBearOff` resta una funzione interna del modulo (non esportata, chiamata solo da `isLegalSingleMove`): i nuovi test la esercitano indirettamente attraverso `isLegalSingleMove`, già importata in cima al file dal Task 2 — nessun nuovo import di `isLegalBearOff` va aggiunto:

```ts
import { canBearOff } from './board';

describe('canBearOff', () => {
  it('è vero quando tutte le proprie pedine sono nella propria casa e la barra è vuota', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 2 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(canBearOff(state, 'fabrizio', 'fabrizio')).toBe(true);
  });

  it('è falso se una propria pedina è fuori dalla casa', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 1 }, 10: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(canBearOff(state, 'fabrizio', 'fabrizio')).toBe(false);
  });

  it('è falso con pedine sulla barra, anche se il resto è tutto in casa', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 1, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(canBearOff(state, 'fabrizio', 'fabrizio')).toBe(false);
  });
});

describe('isLegalBearOff — regola dell\'eccedenza', () => {
  it('un dado che porta esattamente a 0 (o 25) toglie la pedina', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 4, 4)).toBe(true);
  });

  it('un dado in eccedenza è legale se nessuna propria pedina resta più lontana dalla casa', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    // Dal punto 4, un dado di 6 supera lo 0: legale solo se 5 e 6 sono vuoti per fabrizio.
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 4, 6)).toBe(true);
  });

  it('un dado in eccedenza è illegale se esiste una propria pedina più lontana dalla casa', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 1 }, 6: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    // La pedina sul 6 è più lontana dalla casa (dal punto di vista dell'uscita) di quella sul 4:
    // il dado 6 va usato per spostare/togliere quella, non per togliere la pedina sul 4.
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 4, 6)).toBe(false);
    // La stessa pedina sul 6 invece può uscire con un dado 6 (esatto).
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 6, 6)).toBe(true);
  });

  it('nessun bear-off finché canBearOff è falso, anche con un dado esatto', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 4: { owner: 'fabrizio', count: 1 }, 10: { owner: 'fabrizio', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    expect(isLegalSingleMove(state, 'fabrizio', 'fabrizio', 4, 4)).toBe(false);
  });

  it('la stessa regola vale simmetrica per chi si muove in crescente (casa 19-24, esce sopra il 25)', () => {
    const state: BoardState = {
      points: { ...emptyPoints(), 21: { owner: 'emily', count: 1 } },
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 0, emily: 0 },
    };
    // emily (l'altro rispetto a startedBy='fabrizio') si muove in crescente, casa 19-24, esce sopra 25.
    // Dal 21, un dado di 4 porta a 25 esatto.
    expect(isLegalSingleMove(state, 'emily', 'fabrizio', 21, 4)).toBe(true);
    // Un dado di 6 dal 21 porta a 27, eccedenza: legale solo se 19-20 sono vuoti per emily.
    expect(isLegalSingleMove(state, 'emily', 'fabrizio', 21, 6)).toBe(true);
  });
});
```

- [ ] **Step 3: Esegui e verifica che falliscano**

Run: `npm run test -- features/games/backgammon/board`
Expected: FAIL — `canBearOff` non esiste ancora (l'import fallisce, l'intero file di test va in errore).

- [ ] **Step 4: Aggiungi a `features/games/backgammon/board.ts`** (in fondo al file, al posto del commento/funzione temporanea rimossi allo Step 1)

```ts
export function canBearOff(state: BoardState, person: Person, startedBy: Person): boolean {
  if (state.bar[person] > 0) return false;
  const [homeStart, homeEnd] = homeRange(person, startedBy);
  for (let p = 1; p <= POINTS; p++) {
    if (p >= homeStart && p <= homeEnd) continue;
    const point = state.points[p];
    if (point && point.owner === person && point.count > 0) return false;
  }
  return true;
}

/**
 * Chiamata solo quando la mossa esce dal tabellone (isOffBoard(to, dir) è vero).
 * A quel punto vale già `from` ≤ die (direzione decrescente) o (25 - from) ≤ die
 * (direzione crescente): o è l'uscita esatta, o è in eccedenza — mai il caso
 * "resta dentro il tabellone", già escluso dal chiamante.
 */
function isLegalBearOff(
  state: BoardState,
  person: Person,
  startedBy: Person,
  from: number,
  die: number,
): boolean {
  if (!canBearOff(state, person, startedBy)) return false;
  const dir = direction(person, startedBy);
  const [homeStart, homeEnd] = homeRange(person, startedBy);

  if (dir === -1) {
    if (from === die) return true; // uscita esatta
    // Eccedenza: legale solo se nessuna propria pedina resta su un punto più lontano dalla casa.
    for (let p = from + 1; p <= homeEnd; p++) {
      const point = state.points[p];
      if (point && point.owner === person && point.count > 0) return false;
    }
    return true;
  }

  if (25 - from === die) return true; // uscita esatta
  for (let p = homeStart; p < from; p++) {
    const point = state.points[p];
    if (point && point.owner === person && point.count > 0) return false;
  }
  return true;
}
```

- [ ] **Step 5: Esegui e verifica che i test passino**

Run: `npm run test -- features/games/backgammon/board`
Expected: 24 test PASS (16 del Task 2 + 8 nuovi: 3 `canBearOff`, 5 `isLegalBearOff`).

- [ ] **Step 6: Verifica l'intera suite unit**

Run: `npm run test`
Expected: tutti i test PASS.

- [ ] **Step 7: Commit**

```bash
git add features/games/backgammon/board.ts features/games/backgammon/board.test.ts
git commit -m "feat: regole di bear-off di Backgammon (con l'eccedenza)"
```

### Task 4: Schermata di gioco ed elenco giochi

**Files:**
- Modify: `features/games/games.module.css`
- Create: `features/games/backgammon/BackgammonBoard.tsx`
- Create: `features/games/backgammon/BackgammonBoard.test.tsx`
- Create: `app/games/backgammon/page.tsx`
- Create: `app/games/backgammon/page.test.tsx`
- Modify: `app/games/page.tsx`
- Modify: `app/games/page.test.tsx`

**Interfaces:**
- Consumes: `initialState`, `rollDice`, `dieValuesForRoll`, `legalSources`, `applySingleMove`, `isWin`, `type BoardState` (Task 2-3).
- Produces: `<BackgammonBoard who={who} />`; rotta `/games/backgammon`; `/games` con Backgammon come link giocabile.

- [ ] **Step 1: Aggiungi le classi di Backgammon a `features/games/games.module.css`**

Aggiungi in fondo al file (non toccare le regole esistenti):

```css
.backgammonInfo { text-align: center; font: var(--font-small); color: var(--fg-muted); margin: 0 0 var(--space-2); }
.backgammonDiceRow { display: flex; gap: var(--space-2); justify-content: center; margin: 0 0 var(--space-2); }
.backgammonDie {
  min-width: 40px;
  min-height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-lead);
}
.backgammonDie.backgammonDieSelected { background: var(--accent); color: var(--accent-fg); }
.backgammonBoard {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1px;
  margin: 0 auto var(--space-2);
}
.backgammonPoint {
  min-height: 44px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-small);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.backgammonPointLegal { background: var(--accent); color: var(--accent-fg); }
.backgammonPointNumber { font-size: 9px; color: var(--fg-muted); }
.backgammonActionsRow { display: flex; gap: var(--space-2); justify-content: center; margin: var(--space-3) 0; }
.backgammonActionButton {
  min-height: 44px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--fg);
  font: var(--font-body);
}
.backgammonActionButton:disabled { opacity: 0.45; }
```

- [ ] **Step 2: Scrivi il test di `BackgammonBoard` (deve fallire: il componente non esiste ancora)**

`features/games/backgammon/BackgammonBoard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BackgammonBoard } from './BackgammonBoard';
import { initialState } from './board';
import type { Match } from '../types';
import type { BoardState } from './board';

const createMatch = vi.fn();
const makeMove = vi.fn();
vi.mock('../queries', () => ({
  createMatch: (...a: unknown[]) => createMatch(...a),
  makeMove: (...a: unknown[]) => makeMove(...a),
}));

const useActiveMatch = vi.fn();
vi.mock('../useActiveMatch', () => ({ useActiveMatch: (...args: unknown[]) => useActiveMatch(...args) }));

const useGameHistory = vi.fn();
vi.mock('../useGameHistory', () => ({ useGameHistory: (...args: unknown[]) => useGameHistory(...args) }));

const baseState = { loading: false, error: null, offline: false, refetch: vi.fn() };
const baseHistory = { ...baseState, data: { fabrizio: 0, emily: 0, draws: 0 } };

const openMatch = (
  over: Partial<Match> & { boardState?: BoardState } = {},
): Match => ({
  id: 'm1',
  game_type: 'backgammon',
  state: over.boardState ?? initialState(over.started_by ?? 'fabrizio'),
  started_by: over.started_by ?? 'fabrizio',
  current_turn: over.current_turn ?? 'fabrizio',
  winner: over.winner ?? null,
  created_at: '2026-08-27T10:00:00Z',
  closed_at: over.closed_at ?? null,
});

describe('BackgammonBoard', () => {
  beforeEach(() => {
    createMatch.mockReset();
    makeMove.mockReset();
    useActiveMatch.mockReset();
    useGameHistory.mockReset();
    useGameHistory.mockReturnValue(baseHistory);
    createMatch.mockResolvedValue({ data: null, error: null });
    makeMove.mockResolvedValue({ data: null, error: null });
  });

  it('nessuna partita attiva: mostra "New game"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });

  it('interroga useActiveMatch/useGameHistory con il game_type "backgammon"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<BackgammonBoard who="fabrizio" />);
    expect(useActiveMatch).toHaveBeenCalledWith('backgammon');
    expect(useGameHistory).toHaveBeenCalledWith('backgammon');
  });

  it('avviando una partita, chiama createMatch con la disposizione iniziale standard', async () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    render(<BackgammonBoard who="emily" />);
    screen.getByRole('button', { name: 'New game' }).click();
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    const [gameType, person, initialBoardState] = createMatch.mock.calls[0];
    expect(gameType).toBe('backgammon');
    expect(person).toBe('emily');
    expect(initialBoardState).toEqual(initialState('emily'));
  });

  it('il mio turno: il pulsante "Roll dice" tira i dadi localmente', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDefined();
  });

  it('non il mio turno: nessun pulsante "Roll dice"', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch({ current_turn: 'emily' }) });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.queryByRole('button', { name: 'Roll dice' })).toBeNull();
  });

  it('tirando i dadi con Math.random forzato, poi scegliendo dado e pedina, chiama makeMove con la mossa applicata', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // entrambi i dadi = 4 (1+floor(0.5*6)=4)
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'Roll dice' }).click();
    // Doppio 4: 4 dadi da 4. Sceglie il primo dado, poi la pedina sul 24 (fabrizio, disposizione standard).
    screen.getByRole('button', { name: 'Die 4' }).click();
    screen.getByRole('button', { name: /Point 24/ }).click();
    randomSpy.mockRestore();
    screen.getByRole('button', { name: 'End turn' }).click();
    await waitFor(() => expect(makeMove).toHaveBeenCalled());
    const [matchId, person, nextState, result, winner] = makeMove.mock.calls[0];
    expect(matchId).toBe('m1');
    expect(person).toBe('fabrizio');
    expect(nextState.points[24]).toEqual({ owner: 'fabrizio', count: 1 });
    expect(nextState.points[20]).toEqual({ owner: 'fabrizio', count: 1 });
    expect(result).toBeNull();
    expect(winner).toBeNull();
  });

  it('"Reset turn" scarta le mosse locali e fa ripartire dal tiro originale', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    useActiveMatch.mockReturnValue({ ...baseState, data: openMatch() });
    render(<BackgammonBoard who="fabrizio" />);
    screen.getByRole('button', { name: 'Roll dice' }).click();
    screen.getByRole('button', { name: 'Die 4' }).click();
    screen.getByRole('button', { name: /Point 24/ }).click();
    randomSpy.mockRestore();
    screen.getByRole('button', { name: 'Reset turn' }).click();
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
  });

  it('mostra il tally delle partite vinte con i nomi', () => {
    useActiveMatch.mockReturnValue({ ...baseState, data: null });
    useGameHistory.mockReturnValue({ ...baseHistory, data: { fabrizio: 3, emily: 2, draws: 0 } });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByText('Fabrizio 3 – Emily 2 – 0 draws')).toBeDefined();
  });

  it('partita chiusa: mostra il vincitore e "New game"', () => {
    const closedState: BoardState = {
      points: {},
      bar: { fabrizio: 0, emily: 0 },
      borneOff: { fabrizio: 15, emily: 8 },
    };
    for (let p = 1; p <= 24; p++) closedState.points[p] = null;
    useActiveMatch.mockReturnValue({
      ...baseState,
      data: openMatch({ boardState: closedState, closed_at: '2026-08-27T10:30:00Z', winner: 'fabrizio' }),
    });
    render(<BackgammonBoard who="fabrizio" />);
    expect(screen.getByText('You won!')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
```

- [ ] **Step 3: Esegui e verifica che falliscano**

Run: `npm run test -- features/games/backgammon/BackgammonBoard`
Expected: FAIL — il modulo `./BackgammonBoard` non esiste.

- [ ] **Step 4: Scrivi `features/games/backgammon/BackgammonBoard.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { displayName, type Person } from '@/features/auth/identity';
import { useActiveMatch } from '../useActiveMatch';
import { useGameHistory } from '../useGameHistory';
import { createMatch, makeMove } from '../queries';
import { MatchStatus } from '../MatchStatus';
import {
  initialState, rollDice, dieValuesForRoll, legalSources, applySingleMove, isWin,
  type BoardState,
} from './board';
import styles from '../games.module.css';

const TOP_ROW = Array.from({ length: 12 }, (_, i) => 24 - i); // 24..13
const BOTTOM_ROW = Array.from({ length: 12 }, (_, i) => 12 - i); // 12..1

export function BackgammonBoard({ who }: { who: Person }) {
  const { data: match, loading, error: loadError, refetch } = useActiveMatch('backgammon');
  const { data: tally } = useGameHistory('backgammon');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDice, setPendingDice] = useState<number[]>([]);
  const [pendingState, setPendingState] = useState<BoardState | null>(null);
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  // Stessa guardia sincrona degli altri giochi: il `disabled` da solo non
  // basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await createMatch('backgammon', who, initialState(who));
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  function roll() {
    if (pendingDice.length > 0 || !match) return;
    const dice = rollDice();
    setPendingDice(dieValuesForRoll(dice));
    setPendingState(match.state as BoardState);
    setSelectedDieIndex(null);
  }

  function resetTurn() {
    setPendingDice([]);
    setPendingState(null);
    setSelectedDieIndex(null);
  }

  function selectDie(index: number) {
    setSelectedDieIndex(index);
  }

  function playFrom(from: number) {
    if (selectedDieIndex === null || !pendingState || !match) return;
    const die = pendingDice[selectedDieIndex];
    const sources = legalSources(pendingState, who, match.started_by, die);
    if (!sources.includes(from)) return;
    const next = applySingleMove(pendingState, who, match.started_by, from, die);
    const remaining = pendingDice.filter((_, i) => i !== selectedDieIndex);
    setPendingState(next);
    setPendingDice(remaining);
    setSelectedDieIndex(null);
  }

  async function endTurn() {
    if (sending.current || !match || !pendingState) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const winner = isWin(pendingState, who) ? who : null;
    const result = winner ? 'win' : null;
    const { error: failure } = await makeMove(match.id, who, pendingState, result, winner);
    setBusy(false);
    sending.current = false;
    resetTurn();
    if (failure) {
      setError(failure);
      refetch();
    }
  }

  if (loading && !match) return <p className={styles.muted}>Loading…</p>;

  const newGameButton = (
    <button type="button" className={styles.newGame} onClick={start} disabled={busy}>
      {busy ? 'Starting…' : 'New game'}
    </button>
  );

  return (
    <div className={styles.gameShell}>
      {tally && (
        <p className={styles.tally}>
          {displayName('fabrizio')} {tally.fabrizio} – {displayName('emily')} {tally.emily} – {tally.draws} draws
        </p>
      )}
      {loadError && (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      )}

      {!match && newGameButton}

      {match && match.closed_at === null && (() => {
        const myTurn = match.current_turn === who;
        const state = pendingState ?? (match.state as BoardState);

        return (
          <>
            <MatchStatus currentTurn={match.current_turn} who={who} />
            <p className={styles.backgammonInfo}>
              Bar — {displayName('fabrizio')}: {state.bar.fabrizio}, {displayName('emily')}: {state.bar.emily}
            </p>
            <p className={styles.backgammonInfo}>
              Borne off — {displayName('fabrizio')}: {state.borneOff.fabrizio}, {displayName('emily')}: {state.borneOff.emily}
            </p>
            {myTurn && pendingDice.length > 0 && (
              <div className={styles.backgammonDiceRow}>
                {pendingDice.map((die, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.backgammonDie} ${selectedDieIndex === i ? styles.backgammonDieSelected : ''}`}
                    onClick={() => selectDie(i)}
                    disabled={busy}
                  >
                    Die {die}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.backgammonBoard}>
              {[...TOP_ROW, ...BOTTOM_ROW].map((point) => {
                const pointState = state.points[point];
                const isLegalTarget =
                  myTurn &&
                  selectedDieIndex !== null &&
                  pendingState !== null &&
                  legalSources(pendingState, who, match.started_by, pendingDice[selectedDieIndex]).includes(point);
                return (
                  <button
                    key={point}
                    type="button"
                    className={`${styles.backgammonPoint} ${isLegalTarget ? styles.backgammonPointLegal : ''}`}
                    onClick={() => isLegalTarget && playFrom(point)}
                    disabled={!isLegalTarget || busy}
                    aria-label={`Point ${point}${pointState ? `, ${displayName(pointState.owner)} ×${pointState.count}` : ''}`}
                  >
                    <span className={styles.backgammonPointNumber}>{point}</span>
                    {pointState && <span>{pointState.owner === 'fabrizio' ? '●' : '○'}×{pointState.count}</span>}
                  </button>
                );
              })}
            </div>
            {myTurn && (
              <div className={styles.backgammonActionsRow}>
                {pendingDice.length === 0 && (
                  <button type="button" className={styles.backgammonActionButton} onClick={roll} disabled={busy}>
                    Roll dice
                  </button>
                )}
                {pendingState !== null && (
                  <>
                    <button type="button" className={styles.backgammonActionButton} onClick={resetTurn} disabled={busy}>
                      Reset turn
                    </button>
                    <button type="button" className={styles.backgammonActionButton} onClick={endTurn} disabled={busy}>
                      {busy ? 'Sending…' : 'End turn'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        );
      })()}

      {match && match.closed_at !== null && (
        <>
          <p className={styles.result}>
            {/* Backgammon non pareggia mai: si vince togliendo tutte e 15 le pedine. */}
            {match.winner === who ? 'You won!' : `${displayName(match.winner as Person)} won.`}
          </p>
          {newGameButton}
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Esegui e verifica che i test passino**

Run: `npm run test -- features/games/backgammon/BackgammonBoard`
Expected: 9 test PASS.

**Nota sul test "tirando i dadi con Math.random forzato"**: `Math.random()` mockato a restituire sempre `0.5` fa sì che `rollDice()` produca `[4, 4]` (`1 + Math.floor(0.5 * 6) = 1 + 3 = 4` per entrambi i dadi), quindi un doppio → 4 valori da 4 (`dieValuesForRoll` li espande). Dal punto 24 (dove `initialState('fabrizio')` mette 2 pedine di fabrizio), un dado 4 porta a 24-4=20, casella vuota nella disposizione standard: mossa semplice, nessuna cattura.

- [ ] **Step 6: Scrivi il test della pagina (deve fallire: la pagina non esiste ancora)**

`app/games/backgammon/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackgammonPage from './page';

vi.mock('@/features/auth/IdentityProvider', () => ({
  useIdentity: () => ({ who: 'fabrizio', partner: 'emily', setWho: vi.fn(), forget: vi.fn() }),
}));

vi.mock('@/features/games/useActiveMatch', () => ({
  useActiveMatch: () => ({ data: null, loading: false, error: null, offline: false, refetch: vi.fn() }),
}));
vi.mock('@/features/games/useGameHistory', () => ({
  useGameHistory: () => ({
    data: { fabrizio: 0, emily: 0, draws: 0 },
    loading: false,
    error: null,
    offline: false,
    refetch: vi.fn(),
  }),
}));

describe('BackgammonPage', () => {
  it('renderizza la schermata di Backgammon', () => {
    render(<BackgammonPage />);
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined();
  });
});
```

- [ ] **Step 7: Esegui e verifica che fallisca**

Run: `npm run test -- "app/games/backgammon/page"`
Expected: FAIL — il modulo `./page` non esiste.

- [ ] **Step 8: Scrivi `app/games/backgammon/page.tsx`**

```tsx
'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { BackgammonBoard } from '@/features/games/backgammon/BackgammonBoard';

export default function BackgammonPage() {
  const { who } = useIdentity();
  return <BackgammonBoard who={who} />;
}
```

- [ ] **Step 9: Esegui e verifica che il test della pagina passi**

Run: `npm run test -- "app/games/backgammon/page"`
Expected: 1 test PASS.

- [ ] **Step 10: Aggiorna l'elenco giochi**

Il file attuale `app/games/page.tsx` è:

```tsx
import Link from 'next/link';
import styles from '@/features/games/games.module.css';

const GAMES = [
  { slug: 'tic-tac-toe', label: 'Tic-tac-toe', available: true },
  { slug: 'connect-four', label: 'Connect 4', available: true },
  { slug: 'blackjack', label: 'Blackjack', available: false },
  { slug: 'trivia', label: 'Trivia', available: true },
  { slug: 'goose', label: 'Goose Game', available: true },
  { slug: 'quoridor', label: 'Quoridor', available: true },
];

export default function GamesPage() {
  return (
    <div className={styles.list}>
      {GAMES.map((game) =>
        game.available ? (
          <Link key={game.slug} href={`/games/${game.slug}`} className={styles.gameCard}>
            {game.label}
          </Link>
        ) : (
          <div key={game.slug} className={styles.gameCardDisabled}>
            {game.label}
            <span className={styles.soon}>Coming soon</span>
          </div>
        ),
      )}
    </div>
  );
}
```

Cambia l'array `GAMES` in:

```tsx
const GAMES = [
  { slug: 'tic-tac-toe', label: 'Tic-tac-toe', available: true },
  { slug: 'connect-four', label: 'Connect 4', available: true },
  { slug: 'blackjack', label: 'Blackjack', available: false },
  { slug: 'trivia', label: 'Trivia', available: true },
  { slug: 'goose', label: 'Goose Game', available: true },
  { slug: 'quoridor', label: 'Quoridor', available: true },
  { slug: 'backgammon', label: 'Backgammon', available: true },
];
```

Nessun'altra modifica al file.

- [ ] **Step 11: Aggiorna il test dell'elenco giochi**

Il file attuale `app/games/page.test.tsx` ha 6 test. Aggiungi un settimo test, prima della chiusura di `describe` (dopo il test "Quoridor è ora un link giocabile"):

```tsx
  it('Backgammon è ora un link giocabile', () => {
    render(<GamesPage />);
    const link = screen.getByRole('link', { name: /Backgammon/ });
    expect(link.getAttribute('href')).toBe('/games/backgammon');
  });
```

Il test "mostra Blackjack come coming soon" resta invariato (Blackjack è l'unico gioco non ancora disponibile, il conteggio di "Coming soon" resta 1).

- [ ] **Step 12: Esegui e verifica che i test dell'elenco giochi passino**

Run: `npm run test -- "app/games/page"`
Expected: 7 test PASS.

- [ ] **Step 13: Esegui l'intera suite unit**

Run: `npm run test`
Expected: tutti i test PASS.

- [ ] **Step 14: Verifica manuale end-to-end**

1. `npm run dev`, apri l'app, scegli "Sei Fabrizio".
2. Vai su Games → Backgammon, avvia una nuova partita.
3. Tira i dadi: appaiono i chip dei dadi (4 se doppio). Scegli un dado, poi tocca una pedina di partenza evidenziata: la mossa si applica localmente, il dado si consuma.
4. Verifica una cattura: sposta una pedina su una casella con un solo blot avversario (puoi forzare la posizione da SQL locale se serve, `update game_matches set state = ...`), controlla che vada sulla barra.
5. Verifica il rientro obbligato: con una pedina sulla barra, solo il rientro deve risultare disponibile.
6. Tocca "Reset turn" a metà mossa: il tabellone torna allo stato di inizio turno, i dadi ripartono dal tiro originale.
7. Tocca "End turn": la mossa/le mosse si inviano, il turno passa.
8. Forza una posizione vicina al bear-off e verifica sia l'uscita esatta sia quella in eccedenza.
9. Ricontrolla che non si possa aprire una seconda partita finché quella attiva non è chiusa.

Expected: tutti i passaggi funzionano come descritto, nessun errore in console.

- [ ] **Step 15: Verifica `tsc` e build**

Run: `npx tsc --noEmit && npm run build`
Expected: entrambi puliti, `/games/backgammon` compare fra le rotte generate.

- [ ] **Step 16: Commit**

```bash
git add features/games/games.module.css features/games/backgammon/BackgammonBoard.tsx features/games/backgammon/BackgammonBoard.test.tsx app/games/backgammon app/games/page.tsx app/games/page.test.tsx
git commit -m "feat: schermata di gioco di Backgammon ed elenco giochi"
```

### Task 5: Doc di deploy in produzione

**Files:**
- Create: `docs/schema-f3-backgammon.sql`

**Interfaces:**
- Consumes: la migrazione del Task 1.
- Produces: file da incollare manualmente nel SQL Editor di Supabase in produzione.

- [ ] **Step 1: Scrivi `docs/schema-f3-backgammon.sql`**

```sql
-- Schema di Backgammon di Fabrizio & Emily — aggiunta al motore giochi.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) E F2
-- (docs/schema-f2-motore-giochi.sql) sono già stati applicati: questo script
-- presuppone che esista già il tipo game_type.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.
-- Una sola riga: si aggiunge solo un valore all'enum esistente, nessuna
-- nuova tabella o funzione.

-- ============================================================
-- 20260827090000_backgammon_game_type.sql
-- ============================================================
alter type game_type add value 'backgammon';
```

- [ ] **Step 2: Commit**

```bash
git add docs/schema-f3-backgammon.sql
git commit -m "docs: schema di deploy in produzione per Backgammon"
```
