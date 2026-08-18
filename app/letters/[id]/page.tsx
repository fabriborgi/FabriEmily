'use client';

import { useParams } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { useLetter } from '@/features/letters/useLetter';
import { LetterDetail } from '@/features/letters/LetterDetail';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineStrip } from '@/components/ui/OfflineStrip';

export default function LetterPage() {
  const { id } = useParams<{ id: string }>();
  const { who } = useIdentity();
  const { data, loading, offline } = useLetter(id);

  if (loading && !data) return <p>Opening…</p>;
  if (!data) return <EmptyState title="Not found" body="This letter isn't here anymore." />;

  return (
    <>
      {offline && <OfflineStrip />}
      <LetterDetail letter={data} who={who} />
    </>
  );
}
