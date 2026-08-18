'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { TicTacToeBoard } from '@/features/games/ticTacToe/TicTacToeBoard';

export default function TicTacToePage() {
  const { who } = useIdentity();
  return <TicTacToeBoard who={who} />;
}
