'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { QuoridorBoard } from '@/features/games/quoridor/QuoridorBoard';

export default function QuoridorPage() {
  const { who } = useIdentity();
  return <QuoridorBoard who={who} />;
}
