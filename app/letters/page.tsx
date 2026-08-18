import { EmptyState } from '@/components/ui/EmptyState';

// Segnaposto: l'archivio vero arriva nel task 14. Esiste gia' adesso perche' la
// voce "Letters" e' nella tab bar dal task 11, e senza questa pagina il tocco
// finirebbe sul 404 generico di Next, rompendo la coerenza visiva proprio nella
// sezione principale dell'app.
export default function LettersPage() {
  return <EmptyState title="Letters" body="Your letters and drawings will live here." />;
}
