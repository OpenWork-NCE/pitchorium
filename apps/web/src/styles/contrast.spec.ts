import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brandColors } from './brand';

/**
 * WCAG 2.2 AA contrast of every text and background pair of the semantic tokens, in both
 * themes (docs/design/tokens.md): 4.5:1 for text, 3:1 for the non-text indicators.
 */
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return new Map(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]),
  );
}

const light = block(':root');
const dark = new Map([...light, ...block(":root[data-theme='dark']")]);

function resolve(theme: Map<string, string>, name: string): string {
  let value = theme.get(name);
  for (let depth = 0; value?.startsWith('var(') && depth < 5; depth += 1) {
    value = theme.get(value.slice(6, -1));
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`--${name} is not a colour: ${value}`);
  return value;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

const SURFACES = ['background', 'surface', 'surface-elevated', 'surface-sunken'];
const TEXT = 4.5;
const NON_TEXT = 3;

const PAIRS: [string, string, number][] = [
  ...SURFACES.flatMap((surface): [string, string, number][] => [
    ['foreground', surface, TEXT],
    ['muted', surface, TEXT],
  ]),
  ...['background', 'surface'].flatMap((surface): [string, string, number][] => [
    ['link', surface, TEXT],
    ['success', surface, TEXT],
    ['warning', surface, TEXT],
    ['danger', surface, TEXT],
    ['info', surface, TEXT],
    ['border-strong', surface, NON_TEXT],
    ['focus', surface, NON_TEXT],
    ['accent', surface, NON_TEXT],
  ]),
  ['on-accent', 'accent', TEXT],
  ['on-accent', 'accent-strong', TEXT],
  ['on-accent-subtle', 'accent-subtle', TEXT],
  ['on-highlight', 'highlight', TEXT],
  ['on-status', 'success', TEXT],
  ['on-status', 'warning', TEXT],
  ['on-status', 'danger', TEXT],
  ['on-status', 'info', TEXT],
  ['success', 'success-subtle', TEXT],
  ['warning', 'warning-subtle', TEXT],
  ['danger', 'danger-subtle', TEXT],
  ['info', 'info-subtle', TEXT],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('contrast of the %s theme', (_name, theme) => {
  it.each(PAIRS)('%s on %s reaches %s:1', (text, background, minimum) => {
    expect(contrast(resolve(theme, text), resolve(theme, background))).toBeGreaterThanOrEqual(
      minimum,
    );
  });
});

describe('brand colours', () => {
  it('are the values of the brand guide in the tokens and in TypeScript', () => {
    expect(resolve(light, 'brand-violet')).toBe(brandColors.violet);
    expect(resolve(light, 'brand-copper')).toBe(brandColors.copper);
    expect(resolve(light, 'brand-black')).toBe(brandColors.black);
    expect(resolve(light, 'brand-white')).toBe(brandColors.white);
  });

  it('keep copper away from body text, as the guide asks (2.73:1 on white)', () => {
    expect(contrast(brandColors.copper, brandColors.white)).toBeLessThan(TEXT);
    expect(PAIRS.some(([text]) => text === 'highlight')).toBe(false);
  });
});
