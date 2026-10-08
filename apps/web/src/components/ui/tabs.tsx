'use client';

import { Tabs as Primitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { LayoutMotion, SharedIndicator } from '@/components/motion';
import { cn } from '@/lib/cn';

interface TabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  tabs: readonly { value: T; label: ReactNode; count?: number; disabled?: boolean }[];
  /** Accessible name of the list of tabs. */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Views of one subject on the same page (Radix Tabs: arrows move, the panel follows): the active
 * tab is underlined by an indicator that glides (`layoutId`, LayoutMotion). The value may live in
 * the URL (nuqs) so that a tab can be shared.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  tabs,
  label,
  children,
  className,
}: TabsProps<T>) {
  const layoutId = useId();
  return (
    <Primitive.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn('grid gap-6', className)}
    >
      <LayoutMotion>
        <Primitive.List
          aria-label={label}
          className="flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border"
        >
          {tabs.map((tab) => (
            <Primitive.Trigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-3 text-sm font-medium whitespace-nowrap text-muted outline-none hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground"
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className="rounded-full bg-surface-sunken px-1.5 text-xs tabular-nums">
                  {tab.count}
                </span>
              ) : null}
              {tab.value === value ? (
                <SharedIndicator
                  layoutId={layoutId}
                  className="inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                />
              ) : null}
            </Primitive.Trigger>
          ))}
        </Primitive.List>
      </LayoutMotion>
      {children}
    </Primitive.Root>
  );
}

/** Content of a tab, focusable for the keyboard (Radix). */
export function TabsPanel({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      className={cn(
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus',
        className,
      )}
      {...props}
    />
  );
}
