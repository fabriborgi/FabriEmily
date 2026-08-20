'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { BackgammonBoard } from '@/features/games/backgammon/BackgammonBoard';

export default function BackgammonPage() {
  const { who } = useIdentity();
  return <BackgammonBoard who={who} />;
}
