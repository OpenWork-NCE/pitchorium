import type { ReactNode } from 'react';
import { Heading, Text } from '@/components/ui';

/** Title, lede and content of a screen of the authentication: one question per screen. */
export function AuthScreen({
  title,
  lede,
  icon,
  children,
}: {
  title: ReactNode;
  lede?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        {icon}
        <Heading level={1} size="page">
          {title}
        </Heading>
        {lede ? <Text tone="muted">{lede}</Text> : null}
      </div>
      {children}
    </div>
  );
}
