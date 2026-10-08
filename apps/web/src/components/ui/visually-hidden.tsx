import type { ComponentProps } from 'react';

/** Text read by screen readers only (a label that the layout shows otherwise). */
export function VisuallyHidden(props: ComponentProps<'span'>) {
  return <span className="sr-only" {...props} />;
}
