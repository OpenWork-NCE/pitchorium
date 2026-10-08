'use client';

import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

const loadAnimation = () => import('./features-animation').then((module) => module.default);
const loadLayout = () => import('./features-layout').then((module) => module.default);

/**
 * Motion for a shell (ADR 0094): `m` components only (`strict` refuses `motion.*`), their
 * animation features loaded after the first paint. Until then an `m` component renders its
 * final state, as the server did. The nonce signs the style Motion inserts for `popLayout`.
 */
export function MotionProvider({
  nonce,
  children,
}: {
  nonce: string | undefined;
  children: ReactNode;
}) {
  return (
    <MotionConfig nonce={nonce} reducedMotion="user">
      <LazyMotion features={loadAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

/**
 * Layout animations (`layoutId` of SharedIndicator): wraps the components that use them, so that
 * only their pages load the layout features.
 */
export function LayoutMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadLayout} strict>
      {children}
    </LazyMotion>
  );
}
