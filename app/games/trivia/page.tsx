'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { TriviaBoard } from '@/features/games/trivia/TriviaBoard';

export default function TriviaPage() {
  const { who } = useIdentity();
  return <TriviaBoard who={who} />;
}
