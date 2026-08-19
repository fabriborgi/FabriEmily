import { describe, it, expect } from 'vitest';
import {
  legalMoves, wallBlocksEdge, hasPath, isLegalWallPlacement, applyWall, wallsConflict,
  initialState, goalRow, isWin, applyMove,
  type BoardState, type Wall,
} from './board';

describe('wallBlocksEdge', () => {
  it('un muro orizzontale blocca gli spostamenti verticali sotto di sé, non quelli laterali', () => {
    const wall: Wall = { row: 4, col: 4, orientation: 'horizontal' };
    expect(wallBlocksEdge(wall, { row: 4, col: 4 }, { row: 5, col: 4 })).toBe(true);
    expect(wallBlocksEdge(wall, { row: 4, col: 5 }, { row: 5, col: 5 })).toBe(true);
    expect(wallBlocksEdge(wall, { row: 4, col: 3 }, { row: 5, col: 3 })).toBe(false);
    expect(wallBlocksEdge(wall, { row: 4, col: 4 }, { row: 4, col: 5 })).toBe(false);
  });

  it('un muro verticale blocca gli spostamenti laterali accanto a sé, non quelli verticali', () => {
    const vwall: Wall = { row: 3, col: 4, orientation: 'vertical' };
    expect(wallBlocksEdge(vwall, { row: 3, col: 4 }, { row: 3, col: 5 })).toBe(true);
    expect(wallBlocksEdge(vwall, { row: 4, col: 4 }, { row: 4, col: 5 })).toBe(true);
    expect(wallBlocksEdge(vwall, { row: 2, col: 4 }, { row: 2, col: 5 })).toBe(false);
    expect(wallBlocksEdge(vwall, { row: 3, col: 4 }, { row: 4, col: 4 })).toBe(false);
  });
});

describe('legalMoves', () => {
  it('include le 4 celle ortogonalmente adiacenti su un tabellone vuoto', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 0, col: 0 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toEqual(
      expect.arrayContaining([
        { row: 3, col: 4 }, { row: 5, col: 4 }, { row: 4, col: 3 }, { row: 4, col: 5 },
      ]),
    );
    expect(moves).toHaveLength(4);
  });

  it('un muro blocca la mossa in quella direzione', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 0, col: 0 } },
      walls: [{ row: 4, col: 4, orientation: 'horizontal' }],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).not.toContainEqual({ row: 5, col: 4 });
    expect(moves).toHaveLength(3);
  });

  it('il bordo del tabellone limita le mosse disponibili in un angolo', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 0, col: 0 }, emily: { row: 8, col: 8 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toEqual(expect.arrayContaining([{ row: 1, col: 0 }, { row: 0, col: 1 }]));
    expect(moves).toHaveLength(2);
  });

  it("salto dritto oltre l'avversario adiacente", () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 3, col: 4 }, emily: { row: 4, col: 4 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toContainEqual({ row: 5, col: 4 });
    expect(moves).not.toContainEqual({ row: 4, col: 4 });
  });

  it('salto diagonale quando il salto dritto è bloccato da un muro', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 3, col: 4 }, emily: { row: 4, col: 4 } },
      walls: [{ row: 4, col: 4, orientation: 'horizontal' }],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).not.toContainEqual({ row: 5, col: 4 });
    expect(moves).toContainEqual({ row: 4, col: 3 });
    expect(moves).toContainEqual({ row: 4, col: 5 });
  });

  it('nessun salto disponibile quando anche entrambe le diagonali sono bloccate', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 3, col: 4 }, emily: { row: 4, col: 4 } },
      walls: [
        { row: 4, col: 4, orientation: 'horizontal' },
        { row: 4, col: 3, orientation: 'vertical' },
        { row: 3, col: 4, orientation: 'vertical' },
      ],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const moves = legalMoves(state, 'fabrizio');
    expect(moves).toEqual(expect.arrayContaining([{ row: 2, col: 4 }, { row: 3, col: 3 }]));
    expect(moves).toHaveLength(2);
  });
});

// Tabellone 9×9, fabrizio in (4,4) completamente murato su tutti e 4 i
// lati con 4 muri che NON si scontrano fra loro (verificato a mano: due
// muri orizzontali su righe diverse, due muri verticali su colonne
// diverse, nessuna coppia condivide un'ancora né si sovrappone).
const boxWalls: Wall[] = [
  { row: 3, col: 3, orientation: 'horizontal' }, // blocca (3,4)-(4,4) [sopra]
  { row: 4, col: 4, orientation: 'horizontal' }, // blocca (4,4)-(5,4) [sotto]
  { row: 3, col: 4, orientation: 'vertical' },   // blocca (4,4)-(4,5) [destra]
  { row: 4, col: 3, orientation: 'vertical' },   // blocca (4,4)-(4,3) [sinistra]
];

describe('hasPath', () => {
  it('è vero su un tabellone senza muri', () => {
    expect(hasPath({ row: 4, col: 4 }, 8, [])).toBe(true);
    expect(hasPath({ row: 0, col: 0 }, 8, [])).toBe(true);
  });

  it('è vero quando la casella di partenza è già nella riga obiettivo', () => {
    expect(hasPath({ row: 4, col: 4 }, 4, boxWalls)).toBe(true);
  });

  it('è falso quando la cella di partenza è completamente murata su tutti e 4 i lati', () => {
    expect(hasPath({ row: 4, col: 4 }, 0, boxWalls)).toBe(false);
    expect(hasPath({ row: 4, col: 4 }, 8, boxWalls)).toBe(false);
  });
});

describe('isLegalWallPlacement — conflitti fra muri', () => {
  const baseState: BoardState = {
    positions: { fabrizio: { row: 0, col: 4 }, emily: { row: 8, col: 4 } },
    walls: [{ row: 4, col: 4, orientation: 'horizontal' }],
    wallsRemaining: { fabrizio: 9, emily: 9 },
  };

  it('rifiuta un muro che si sovrappone a uno esistente (stesso orientamento, colonne che si toccano)', () => {
    expect(isLegalWallPlacement(baseState, { row: 4, col: 5, orientation: 'horizontal' }, 'fabrizio', 'fabrizio')).toBe(false);
  });

  it('accetta un muro adiacente che non si sovrappone (stesso orientamento, colonne separate)', () => {
    expect(isLegalWallPlacement(baseState, { row: 4, col: 6, orientation: 'horizontal' }, 'fabrizio', 'fabrizio')).toBe(true);
  });

  it('rifiuta un muro perpendicolare ancorato sulla stessa intersezione', () => {
    expect(isLegalWallPlacement(baseState, { row: 4, col: 4, orientation: 'vertical' }, 'fabrizio', 'fabrizio')).toBe(false);
  });

  it("accetta un muro perpendicolare su un'intersezione diversa", () => {
    expect(isLegalWallPlacement(baseState, { row: 2, col: 2, orientation: 'vertical' }, 'fabrizio', 'fabrizio')).toBe(true);
  });

  it('rifiuta un muro fuori dai limiti del tabellone (SIZE=9, ancore valide 0-7)', () => {
    expect(isLegalWallPlacement(baseState, { row: 8, col: 4, orientation: 'horizontal' }, 'fabrizio', 'fabrizio')).toBe(false);
    expect(isLegalWallPlacement(baseState, { row: 4, col: 8, orientation: 'vertical' }, 'fabrizio', 'fabrizio')).toBe(false);
  });

  it('rifiuta se il giocatore non ha più muri disponibili', () => {
    const noWallsLeft: BoardState = { ...baseState, wallsRemaining: { fabrizio: 0, emily: 9 } };
    expect(isLegalWallPlacement(noWallsLeft, { row: 2, col: 2, orientation: 'vertical' }, 'fabrizio', 'fabrizio')).toBe(false);
  });
});

describe('isLegalWallPlacement — non può mai chiudere completamente una strada', () => {
  // Gli stessi 3 muri di boxWalls, MENO quello sinistro: (4,3) resta l'unica
  // via di fuga per chi è in (4,4). Verificato a mano che da (4,3) esistono
  // percorsi aperti verso il resto del tabellone (nessun altro muro nei
  // paraggi lo richiude).
  const nearBoxWalls: Wall[] = [
    { row: 3, col: 3, orientation: 'horizontal' },
    { row: 4, col: 4, orientation: 'horizontal' },
    { row: 3, col: 4, orientation: 'vertical' },
  ];
  const state: BoardState = {
    positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 8, col: 4 } },
    walls: nearBoxWalls,
    wallsRemaining: { fabrizio: 9, emily: 9 },
  };

  it("rifiuta il muro che chiuderebbe l'ultima via di fuga rimasta", () => {
    expect(isLegalWallPlacement(state, { row: 4, col: 3, orientation: 'vertical' }, 'emily', 'fabrizio')).toBe(false);
  });

  it('accetta un muro innocuo altrove sullo stesso tabellone', () => {
    expect(isLegalWallPlacement(state, { row: 0, col: 0, orientation: 'horizontal' }, 'emily', 'fabrizio')).toBe(true);
  });

  it("rifiuta il muro anche quando è CHI LO PIAZZA a restare senza via d'uscita, non solo l'avversario", () => {
    // Stessa configurazione, ma stavolta è fabrizio (che sta per restare
    // intrappolato) a piazzare il muro fatale su se stesso — il controllo
    // vale per entrambi i giocatori, non solo per l'avversario di chi gioca.
    expect(isLegalWallPlacement(state, { row: 4, col: 3, orientation: 'vertical' }, 'fabrizio', 'fabrizio')).toBe(false);
  });

  it('accetta un muro che lascia un solo corridoio stretto, senza richiuderlo del tutto', () => {
    // Solo sopra e sotto bloccati (2 dei 3 muri di nearBoxWalls): aggiungendo
    // anche il muro a destra resta comunque aperta la sinistra — un
    // corridoio stretto, non un vicolo cieco.
    const twoWalls: Wall[] = [
      { row: 3, col: 3, orientation: 'horizontal' },
      { row: 4, col: 4, orientation: 'horizontal' },
    ];
    const narrowState: BoardState = {
      positions: { fabrizio: { row: 4, col: 4 }, emily: { row: 8, col: 4 } },
      walls: twoWalls,
      wallsRemaining: { fabrizio: 9, emily: 9 },
    };
    expect(isLegalWallPlacement(narrowState, { row: 3, col: 4, orientation: 'vertical' }, 'emily', 'fabrizio')).toBe(true);
  });
});

describe('wallsConflict', () => {
  it('muri con lo stesso orientamento confliggono se vicini, non se separati da almeno una casella', () => {
    expect(wallsConflict({ row: 4, col: 4, orientation: 'horizontal' }, { row: 4, col: 5, orientation: 'horizontal' })).toBe(true);
    expect(wallsConflict({ row: 4, col: 4, orientation: 'horizontal' }, { row: 4, col: 6, orientation: 'horizontal' })).toBe(false);
  });

  it('muri perpendicolari confliggono solo se ancorati sulla stessa identica intersezione', () => {
    expect(wallsConflict({ row: 4, col: 4, orientation: 'horizontal' }, { row: 4, col: 4, orientation: 'vertical' })).toBe(true);
    expect(wallsConflict({ row: 4, col: 4, orientation: 'horizontal' }, { row: 3, col: 4, orientation: 'vertical' })).toBe(false);
  });
});

describe('initialState, goalRow, isWin, applyMove', () => {
  it('posiziona chi inizia in riga 0 e l\'altro in riga 8, entrambi al centro, 10 muri a testa', () => {
    const state = initialState('emily');
    expect(state.positions.emily).toEqual({ row: 0, col: 4 });
    expect(state.positions.fabrizio).toEqual({ row: 8, col: 4 });
    expect(state.wallsRemaining).toEqual({ fabrizio: 10, emily: 10 });
    expect(state.walls).toEqual([]);
  });

  it('goalRow è la riga opposta a quella di partenza', () => {
    expect(goalRow('emily', 'emily')).toBe(8);
    expect(goalRow('fabrizio', 'emily')).toBe(0);
  });

  it('isWin è vero solo sulla riga obiettivo', () => {
    expect(isWin({ row: 8, col: 3 }, 8)).toBe(true);
    expect(isWin({ row: 7, col: 4 }, 8)).toBe(false);
  });

  it('applyMove aggiorna solo la posizione di chi si muove', () => {
    const state = initialState('fabrizio');
    const next = applyMove(state, 'fabrizio', { row: 1, col: 4 });
    expect(next.positions.fabrizio).toEqual({ row: 1, col: 4 });
    expect(next.positions.emily).toEqual(state.positions.emily);
  });
});

describe('applyWall', () => {
  it('aggiunge il muro allo stato e scala i muri disponibili di chi lo piazza', () => {
    const state: BoardState = {
      positions: { fabrizio: { row: 0, col: 4 }, emily: { row: 8, col: 4 } },
      walls: [],
      wallsRemaining: { fabrizio: 10, emily: 10 },
    };
    const next = applyWall(state, 'fabrizio', { row: 2, col: 2, orientation: 'vertical' });
    expect(next.walls).toEqual([{ row: 2, col: 2, orientation: 'vertical' }]);
    expect(next.wallsRemaining).toEqual({ fabrizio: 9, emily: 10 });
  });
});
