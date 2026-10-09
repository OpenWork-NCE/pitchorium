import type { ReactNode } from 'react';
import { Card, Heading, Text } from '@/components/ui';

/** A block of a settings page: its title, what it does, its controls. */
export function SettingsSection({
  title,
  description,
  children,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Card className="grid gap-4" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="grid gap-1">
        <Heading level={2} size="card" id={id ? `${id}-title` : undefined}>
          {title}
        </Heading>
        {description ? (
          <Text size="sm" tone="muted">
            {description}
          </Text>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
