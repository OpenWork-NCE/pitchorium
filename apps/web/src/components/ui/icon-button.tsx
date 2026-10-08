import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button';
import { Tooltip } from './tooltip';

type IconButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'asChild'> & {
  /** Accessible name, required: the button has no visible text. */
  label: string;
  /** A lucide icon element (decorative: the label names the button). */
  icon: ReactNode;
  size?: 'md' | 'sm';
  /** Tooltip text, the label by default. */
  tooltip?: ReactNode;
  tooltipSide?: ComponentProps<typeof Tooltip>['side'];
};

/**
 * Button with an icon only: its label is its accessible name and its tooltip on hover and focus.
 * 44 px on a phone whatever the size (touch target).
 */
export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'ghost',
  tooltip,
  tooltipSide,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={tooltip ?? label} side={tooltipSide}>
      <Button
        variant={variant}
        size={size === 'sm' ? 'icon-sm' : 'icon'}
        aria-label={label}
        {...props}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}
