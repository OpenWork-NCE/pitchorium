'use client';

import { Avatar as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';

/** A photo of an Avatar (Radix Avatar): its initials until it loads, or if it cannot. */
export function AvatarPhoto({
  src,
  fallback,
  className,
  ...label
}: {
  src: string;
  fallback: ReactNode;
  className: string;
  role: 'img' | undefined;
  'aria-label': string | undefined;
  'aria-hidden': true | undefined;
}) {
  return (
    <Primitive.Root {...label} className={className}>
      <Primitive.Image src={src} alt="" className="size-full object-cover" />
      <Primitive.Fallback delayMs={400} asChild>
        {fallback}
      </Primitive.Fallback>
    </Primitive.Root>
  );
}
