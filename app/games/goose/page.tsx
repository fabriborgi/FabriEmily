'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { GooseBoard } from '@/features/games/goose/GooseBoard';

export default function GoosePage() {
  const { who } = useIdentity();
  return <GooseBoard who={who} />;
}
