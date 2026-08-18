import type { Person } from '@/features/auth/identity';

export type GameType = 'tic_tac_toe';

export type Match = {
  id: string;
  game_type: GameType;
  state: unknown; // ogni gioco lo restringe al proprio formato (vedi board.ts per il Tris)
  started_by: Person;
  current_turn: Person;
  winner: Person | null;
  created_at: string;
  closed_at: string | null;
};

export type GameTally = { fabrizio: number; emily: number; draws: number };
