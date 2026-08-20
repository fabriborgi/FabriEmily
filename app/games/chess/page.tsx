'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { ChessBoard } from '@/features/games/chess/ChessBoard';

export default function ChessPage() {
  const { who } = useIdentity();
  return <ChessBoard who={who} />;
}
