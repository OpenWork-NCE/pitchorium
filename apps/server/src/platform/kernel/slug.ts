export interface SlugOptions {
  minLength: number;
  /** Room is left for a `-NNNNNN` suffix. */
  maxLength: number;
  /** Used when the text gives too short or a reserved slug. */
  fallback: string;
  reserved: ReadonlySet<string>;
}

const SUFFIX_ROOM = 7;

/**
 * URL slug of a free text: `Aminata Diallo-Ndiaye` gives `aminata-diallo-ndiaye`. Accents are
 * dropped, other characters become single hyphens, and a long text is cut at a word boundary.
 */
export function slugify(text: string, options: SlugOptions): string {
  const max = options.maxLength - SUFFIX_ROOM;
  const full = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let slug = full.slice(0, max).replace(/-+$/g, '');
  if (full.length > max && full[max] !== '-') {
    const boundary = slug.lastIndexOf('-');
    if (boundary >= options.minLength) slug = slug.slice(0, boundary);
  }
  if (slug.length < options.minLength || options.reserved.has(slug)) return options.fallback;
  return slug;
}

const SEQUENTIAL_SUFFIXES = 8;
const RANDOM_SUFFIXES = 5;

/**
 * Candidates for a unique slug: the base, base-2 to base-9, then random suffixes from
 * `randomSuffix` (six digits at most, to fit the room left by slugify).
 */
export function* slugCandidates(base: string, randomSuffix: () => number): Generator<string> {
  yield base;
  for (let suffix = 2; suffix < 2 + SEQUENTIAL_SUFFIXES; suffix += 1) yield `${base}-${suffix}`;
  for (let attempt = 0; attempt < RANDOM_SUFFIXES; attempt += 1) {
    yield `${base}-${randomSuffix()}`;
  }
}
