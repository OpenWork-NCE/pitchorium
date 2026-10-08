import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const alertVariants = cva('flex items-start gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-info/30 bg-info-subtle text-info',
      success: 'border-success/30 bg-success-subtle text-success',
      warning: 'border-warning/30 bg-warning-subtle text-warning',
      danger: 'border-danger/30 bg-danger-subtle text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;

type AlertProps = VariantProps<typeof alertVariants> & {
  title?: ReactNode;
  children?: ReactNode;
  /** An action that resolves the situation (a button, a link). */
  action?: ReactNode;
  /**
   * `alert` for a message that appears after an action and needs attention at once (announced);
   * `status` for a calmer one; none for a message present from the start.
   */
  live?: 'alert' | 'status';
  className?: string;
};

/**
 * Message about the state of a page or an action, in a status colour: what happens and what to
 * do. Different from a Callout, which explains, and from a Banner, which concerns the account or
 * the site.
 */
export function Alert({ tone, title, children, action, live, className }: AlertProps) {
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div role={live} className={cn(alertVariants({ tone }), className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="grid flex-1 gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-foreground">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
