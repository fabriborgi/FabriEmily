'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { ConnectFourBoard } from '@/features/games/connectFour/ConnectFourBoard';

export default function ConnectFourPage() {
  const { who } = useIdentity();
  return <ConnectFourBoard who={who} />;
}
