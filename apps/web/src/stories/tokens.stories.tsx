import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DURATION_MS, EASE } from '@/components/motion/tokens';

const meta = { title: 'Tokens' } satisfies Meta;
export default meta;

const SEMANTIC = [
  ['background', 'foreground'],
  ['surface', 'foreground'],
  ['surface-elevated', 'foreground'],
  ['surface-sunken', 'muted'],
  ['accent', 'on-accent'],
  ['accent-strong', 'on-accent'],
  ['accent-subtle', 'on-accent-subtle'],
  ['highlight', 'on-highlight'],
  ['success', 'on-status'],
  ['warning', 'on-status'],
  ['danger', 'on-status'],
  ['info', 'on-status'],
  ['success-subtle', 'success'],
  ['warning-subtle', 'warning'],
  ['danger-subtle', 'danger'],
  ['info-subtle', 'info'],
] as const;

/** Semantic pairs of the current theme (toolbar): each is tested at WCAG AA. */
export const Colors: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {SEMANTIC.map(([background, text]) => (
        <div
          key={background}
          className="rounded-lg border border-border p-4 text-sm"
          style={{ backgroundColor: `var(--${background})`, color: `var(--${text})` }}
        >
          <p className="font-semibold">{background}</p>
          <p>{text}</p>
        </div>
      ))}
    </div>
  ),
};

const SCALE = ['5xl', '4xl', '3xl', '2xl', 'xl', 'lg', 'base', 'sm', 'xs'] as const;

/** Bricolage Grotesque 800 for titles, Poppins for the text, fluid scale 18 / 29 / 47. */
export const Typography: StoryObj = {
  render: () => (
    <div className="grid gap-4">
      {SCALE.map((size) => (
        <p
          key={size}
          className={size.endsWith('xl') ? 'font-display font-extrabold' : ''}
          style={{ fontSize: `var(--text-${size})` }}
        >
          {size} Un collectif qui avance. ŋ ɛ ɔ ẹ ọ ɓ ɗ ƙ
        </p>
      ))}
      <p>
        <span className="font-medium">Poppins 500</span> ·{' '}
        <span className="font-semibold">Poppins 600</span>
      </p>
      <p className="font-hand text-2xl text-accent">Annotation personnelle</p>
    </div>
  ),
};

/** The two signature curves and the durations of the catalogue. */
export const Motion: StoryObj = {
  render: () => (
    <dl className="grid grid-cols-[10rem_1fr] gap-2 font-mono text-sm">
      {Object.entries(EASE).map(([name, curve]) => (
        <div key={name} className="contents">
          <dt>ease-{name}</dt>
          <dd>cubic-bezier({curve.join(', ')})</dd>
        </div>
      ))}
      {Object.entries(DURATION_MS).map(([name, value]) => (
        <div key={name} className="contents">
          <dt>duration-{name}</dt>
          <dd>{value} ms</dd>
        </div>
      ))}
    </dl>
  ),
};
