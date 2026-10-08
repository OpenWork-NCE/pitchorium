import type { ReactNode } from 'react';
import { AuthShell } from '@/components/layout/shells/auth-shell';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
