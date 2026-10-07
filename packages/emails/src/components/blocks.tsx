import type { ReactNode } from 'react';
import { Button, Heading, Text } from 'react-email';
import { theme } from '../theme.js';

export function Title({ children }: { children: ReactNode }) {
  return (
    <Heading as="h1" style={{ fontSize: 22, margin: '0 0 16px' }}>
      {children}
    </Heading>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 15, lineHeight: '24px', margin: '0 0 16px' }}>{children}</Text>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: theme.muted, fontSize: 13, lineHeight: '20px', margin: '16px 0 0' }}>
      {children}
    </Text>
  );
}

/** Call to action, followed by the raw URL for clients that block buttons. */
export function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <>
      <Button
        href={href}
        style={{
          backgroundColor: theme.text,
          borderRadius: 6,
          color: theme.surface,
          display: 'inline-block',
          fontSize: 15,
          fontWeight: 600,
          padding: '12px 20px',
          textDecoration: 'none',
        }}
      >
        {label}
      </Button>
      <Text
        style={{ color: theme.muted, fontSize: 12, lineHeight: '18px', wordBreak: 'break-all' }}
      >
        {href}
      </Text>
    </>
  );
}
