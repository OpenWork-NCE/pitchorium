'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useMotionPreference } from './use-motion-preference';

/** GSAP is never part of the first load: the animator arrives when the heading comes near. */
const SplitAnimator = dynamic(() => import('./split-animator'), { ssr: false });

/** True once the element is within a viewport height of the screen: time to load GSAP. */
function useNearViewport(ref: { current: Element | null }, disabled: boolean): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (disabled || !element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px 100% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, disabled]);
  return near;
}

interface SplitHeadingProps {
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Editorial heading revealed line by line (H13). The text is rendered on the server as is;
 * placed below the fold so that its lines are masked before they come into view. Reserved to
 * the public editorial pages (docs/design/motion.md).
 */
export function SplitHeading({ as: Tag = 'h2', id, children, className }: SplitHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useMotionPreference() === 'reduced';
  const near = useNearViewport(ref, reduced);
  return (
    <>
      <Tag ref={ref} id={id} className={className}>
        {children}
      </Tag>
      {near ? <SplitAnimator target={ref} /> : null}
    </>
  );
}
