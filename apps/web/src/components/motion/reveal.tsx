'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useMotionPreference } from './use-motion-preference';

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reveal on scroll (E1): a scroll-driven CSS animation (`animation-timeline: view()`), rewound
 * when scrolling back. Browsers without scroll-driven animations get the same rise through an
 * IntersectionObserver; with less motion the content is simply there. Styles in globals.css.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference() === 'reduced';

  useEffect(() => {
    const element = ref.current;
    if (!element || CSS.supports('animation-timeline: view()')) return;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      element.dataset.revealed = 'true';
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.revealed = 'true';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div ref={ref} data-reveal="" className={cn(className)}>
      {children}
    </div>
  );
}
