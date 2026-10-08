/**
 * Motion tokens shared by CSS (src/styles/tokens.css), Motion and GSAP: two signature curves
 * only, and the durations of the catalogue (docs/design/motion.md). A test checks that the CSS
 * variables hold the same values.
 */
export const EASE = {
  /** Arrivals, micro-interactions, fills: fast start, long soft landing. */
  enter: [0.16, 1, 0.3, 1],
  /** Curtains and circular reveals: symmetric acceleration. */
  curtain: [0.76, 0, 0.24, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EaseName = keyof typeof EASE;

export const DURATION_MS = {
  press: 150,
  micro: 200,
  page: 320,
  reveal: 600,
  fill: 800,
  theme: 700,
  counter: 1400,
} as const;

export type DurationName = keyof typeof DURATION_MS;

/** `cubic-bezier(...)` for CSS and the Web Animations API. */
export function cssEase(name: EaseName): string {
  return `cubic-bezier(${EASE[name].join(', ')})`;
}

/** SVG path of the curve, as GSAP's CustomEase expects it. */
export function gsapEasePath(name: EaseName): string {
  const [x1, y1, x2, y2] = EASE[name];
  return `M0,0 C${x1},${y1} ${x2},${y2} 1,1`;
}

export function seconds(name: DurationName): number {
  return DURATION_MS[name] / 1000;
}
