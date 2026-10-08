'use client';

import { useEffect, useRef } from 'react';
import { DURATION_MS, EASE } from './tokens';
import { useMotionPreference } from './use-motion-preference';

interface AnimatedNumberProps {
  value: number;
  /** Localised formatter (next-intl `useFormatter`, `formatMoney`): applied to every frame. */
  format: (value: number) => string;
  /** Step of the displayed values: 1 for a count, 0.01 for euros, 1 for CFA francs. */
  step?: number;
  /** Milliseconds to wait once in view, after another beat (a drawn stroke, H18). */
  delay?: number;
  className?: string;
}

/** Same curve as the CSS token `enter`, evaluated in JavaScript for the counter. */
function easeEnter(progress: number): number {
  // Cubic Bézier of the token: solved for x by Newton's method, then evaluated for y.
  const [x1, y1, x2, y2] = EASE.enter;
  const bezier = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let t = progress;
  for (let i = 0; i < 6; i += 1) {
    const x = bezier(t, x1, x2) - progress;
    const dx = 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t ** 2 * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    t -= x / dx;
  }
  return bezier(Math.min(1, Math.max(0, t)), y1, y2);
}

/**
 * Counter (H17): counts up to `value` when it enters the viewport, snapped to `step` and
 * formatted on every frame. The server renders the final value (no JavaScript, search engines);
 * with less motion the final value stays.
 */
export function AnimatedNumber({
  value,
  format,
  step = 1,
  delay = 0,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useMotionPreference() === 'reduced';

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = format(value);
    element.dataset.ready = 'true';
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now() + delay;
        const tick = (now: number) => {
          const progress = Math.min(1, Math.max(0, now - start) / DURATION_MS.counter);
          const current = Math.round((value * easeEnter(progress)) / step) * step;
          element.textContent = format(progress === 1 ? value : current);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        element.textContent = format(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, format, step, delay, reduced]);

  return (
    <span ref={ref} data-counter="" className={className}>
      {format(value)}
    </span>
  );
}
