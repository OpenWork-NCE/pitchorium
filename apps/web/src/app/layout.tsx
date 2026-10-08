import type { ReactNode } from 'react';

/** The document is rendered by the layout of the locale (app/[locale]/layout.tsx). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
