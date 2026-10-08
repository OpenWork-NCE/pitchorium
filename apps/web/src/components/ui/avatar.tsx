'use client';

import { Avatar as Primitive } from 'radix-ui';
import { cn } from '@/lib/cn';

const SIZES = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-3xl',
} as const;

/** The six pairs of tokens of the initials (tokens.css), AA in both themes. */
const TONES = [
  'bg-avatar-1-bg text-avatar-1-fg',
  'bg-avatar-2-bg text-avatar-2-fg',
  'bg-avatar-3-bg text-avatar-3-fg',
  'bg-avatar-4-bg text-avatar-4-fg',
  'bg-avatar-5-bg text-avatar-5-fg',
  'bg-avatar-6-bg text-avatar-6-fg',
] as const;

/** Initials of a name: first letters of the first and last words (`Aïssatou Ba` gives `AB`). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const first = [...(words[0] ?? '')][0] ?? '';
  const last = words.length > 1 ? ([...(words.at(-1) ?? '')][0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase();
}

/** Same name, same colour: a stable hash of the name picks a pair of tokens. */
export function toneOf(name: string): (typeof TONES)[number] {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return TONES[hash % TONES.length] ?? TONES[0];
}

interface AvatarProps {
  /** Full name: initials and colour when there is no photo, alternative text otherwise. */
  name: string;
  src?: string | null | undefined;
  size?: keyof typeof SIZES;
  /** Organisations are square with rounded corners, people are round (direction.md). */
  shape?: 'circle' | 'square';
  /** The name is said next to the avatar: the image is then decorative. */
  decorative?: boolean;
  className?: string;
}

/**
 * Photo of a person or logo of an organisation (Radix Avatar): initials on a colour derived from
 * the name while the image loads, or without one.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  shape = 'circle',
  decorative = false,
  className,
}: AvatarProps) {
  return (
    <Primitive.Root
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden bg-surface-sunken select-none',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        SIZES[size],
        className,
      )}
    >
      {src ? <Primitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <Primitive.Fallback
        delayMs={src ? 400 : 0}
        className={cn('flex size-full items-center justify-center font-semibold', toneOf(name))}
      >
        {initialsOf(name)}
      </Primitive.Fallback>
    </Primitive.Root>
  );
}

interface AvatarGroupProps {
  people: readonly { name: string; src?: string | null }[];
  /** Avatars drawn before "+N". */
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  /** Spoken summary ("Aïssatou, Kofi et 3 autres"): the avatars themselves are decorative. */
  label: string;
  /** Text of the remainder bubble, "+3". */
  moreLabel?: (count: number) => string;
  /** The remainder bubble; off where the text already counts the others. */
  showRest?: boolean;
  /** Colour of the ring between the avatars: the surface they sit on. */
  ring?: 'surface' | 'background';
  className?: string;
}

/** Overlap by size: small enough never to hide the initials of the avatar underneath. */
const OVERLAPS = { xs: '-space-x-0.5', sm: '-space-x-1', md: '-space-x-1.5' } as const;
const RINGS = { surface: 'ring-2 ring-surface', background: 'ring-2 ring-background' } as const;

/** Overlapping avatars of a few people, with a ring of the colour of their surface between them. */
export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
  label,
  moreLabel,
  showRest = true,
  ring = 'surface',
  className,
}: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const rest = showRest ? people.length - shown.length : 0;
  return (
    <div role="img" aria-label={label} className={cn('flex', OVERLAPS[size], className)}>
      {shown.map((person, index) => (
        <Avatar
          // Two people may share a name: the position is part of the key.
          key={`${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size={size}
          decorative
          className={RINGS[ring]}
        />
      ))}
      {rest > 0 ? (
        <span
          aria-hidden
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center rounded-full bg-surface-sunken font-medium text-muted',
            RINGS[ring],
            SIZES[size],
          )}
        >
          {moreLabel ? moreLabel(rest) : `+${rest}`}
        </span>
      ) : null}
    </div>
  );
}
