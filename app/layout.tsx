import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthGate } from '@/features/auth/AuthGate';
import { AppChrome } from '@/components/AppChrome';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'Fabrizio & Emily',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Fabrizio & Emily' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
};

// `viewportFit: cover` è ciò che rende utile env(safe-area-inset-*) sugli iPhone con notch.
// Nessun maximumScale: lo zoom con le dita resta disponibile. Di solito lo si blocca per
// impedire a iOS di ingrandire da solo la pagina al focus su un campo di testo, ma quel
// problema è già risolto dando ai campi un carattere da 17px (sopra i 16px iOS non
// interviene). Bloccarlo qui lascerebbe solo il danno: un'app fatta per leggere lettere
// in cui non si può ingrandire il testo.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf6f0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorker />
        <AuthGate>
          <AppChrome>{children}</AppChrome>
        </AuthGate>
      </body>
    </html>
  );
}
