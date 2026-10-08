import type { ReactNode } from 'react';
import { fontVariables } from '@/styles/fonts';
import '@/styles/globals.css';

/** Document of the scaffold; the locale layout takes over with the localised routes. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
