import type { ReactNode } from 'react';
import '@/styles/globals.css';

/** Document of the scaffold; the locale layout takes over with the localised routes. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
