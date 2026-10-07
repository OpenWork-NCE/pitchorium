import type {
  MediaContentType,
  MediaUsage,
  MediaUsageLimits,
  MediaUsageVisibility,
  MediaVisibility,
} from '@pitchorium/contracts';

/** Rendition of an image: `inside` keeps the ratio, `cover` crops, `contain` pads (logos). */
export interface VariantSpec {
  name: string;
  width: number;
  height: number | null;
  fit: 'inside' | 'cover' | 'contain';
}

export interface ImageRule {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  variants: readonly VariantSpec[];
}

export interface UsageRule {
  contentTypes: readonly MediaContentType[];
  maxBytes: number;
  /** Null when the usage accepts no image. */
  image: ImageRule | null;
  /** Null when the usage accepts no PDF. */
  pdf: { maxPages: number } | null;
  maxPerResource: number;
  /**
   * `resource`: the files are public only while the resource they are attached to is public
   * (ADR 0026). Documents (PDF) are always private.
   */
  visibility: MediaUsageVisibility;
}

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PDF_CONTENT_TYPE = 'application/pdf';

const MB = 1024 * 1024;

/** Thumbnail of the first page of a PDF. */
export const PDF_THUMBNAIL: VariantSpec = {
  name: 'thumbnail',
  width: 800,
  height: null,
  fit: 'inside',
};

const SQUARE = (fit: VariantSpec['fit']): VariantSpec[] => [
  { name: 'large', width: 400, height: 400, fit },
  { name: 'small', width: 128, height: 128, fit },
];

/** Banner ratio 4:1, as on the main professional networks. */
const COVER: ImageRule = {
  minWidth: 1200,
  minHeight: 300,
  maxWidth: 10_000,
  maxHeight: 10_000,
  variants: [
    { name: 'large', width: 1584, height: 396, fit: 'cover' },
    { name: 'small', width: 792, height: 198, fit: 'cover' },
  ],
};

const FEED_IMAGE: ImageRule = {
  minWidth: 200,
  minHeight: 200,
  maxWidth: 10_000,
  maxHeight: 10_000,
  variants: [
    { name: 'large', width: 1600, height: null, fit: 'inside' },
    { name: 'medium', width: 800, height: null, fit: 'inside' },
  ],
};

/**
 * Limits of each usage. Provisional values (docs/open-questions.md): the cahier des charges
 * gives none.
 */
export const USAGE_RULES: Readonly<Record<MediaUsage, UsageRule>> = {
  avatar: {
    contentTypes: IMAGE_CONTENT_TYPES,
    maxBytes: 5 * MB,
    image: {
      minWidth: 200,
      minHeight: 200,
      maxWidth: 8000,
      maxHeight: 8000,
      variants: SQUARE('cover'),
    },
    pdf: null,
    maxPerResource: 1,
    visibility: 'resource',
  },
  profile_cover: {
    contentTypes: IMAGE_CONTENT_TYPES,
    maxBytes: 8 * MB,
    image: COVER,
    pdf: null,
    maxPerResource: 1,
    visibility: 'resource',
  },
  organization_logo: {
    contentTypes: IMAGE_CONTENT_TYPES,
    maxBytes: 5 * MB,
    image: {
      minWidth: 200,
      minHeight: 200,
      maxWidth: 8000,
      maxHeight: 8000,
      variants: SQUARE('contain'),
    },
    pdf: null,
    maxPerResource: 1,
    visibility: 'public',
  },
  organization_cover: {
    contentTypes: IMAGE_CONTENT_TYPES,
    maxBytes: 8 * MB,
    image: COVER,
    pdf: null,
    maxPerResource: 1,
    visibility: 'public',
  },
  post_image: {
    contentTypes: IMAGE_CONTENT_TYPES,
    maxBytes: 10 * MB,
    image: FEED_IMAGE,
    pdf: null,
    maxPerResource: 10,
    visibility: 'resource',
  },
  post_document: {
    contentTypes: [PDF_CONTENT_TYPE],
    maxBytes: 20 * MB,
    image: null,
    pdf: { maxPages: 50 },
    maxPerResource: 5,
    visibility: 'private',
  },
  project_gallery: {
    contentTypes: IMAGE_CONTENT_TYPES,
    maxBytes: 10 * MB,
    image: {
      minWidth: 600,
      minHeight: 400,
      maxWidth: 10_000,
      maxHeight: 10_000,
      variants: [
        ...FEED_IMAGE.variants,
        { name: 'thumbnail', width: 400, height: 300, fit: 'cover' },
      ],
    },
    pdf: null,
    maxPerResource: 20,
    visibility: 'resource',
  },
  project_document: {
    contentTypes: [PDF_CONTENT_TYPE],
    maxBytes: 20 * MB,
    image: null,
    pdf: { maxPages: 50 },
    maxPerResource: 10,
    visibility: 'private',
  },
  message_attachment: {
    contentTypes: [...IMAGE_CONTENT_TYPES, PDF_CONTENT_TYPE],
    maxBytes: 10 * MB,
    image: {
      minWidth: 1,
      minHeight: 1,
      maxWidth: 10_000,
      maxHeight: 10_000,
      variants: [
        { name: 'large', width: 1600, height: null, fit: 'inside' },
        { name: 'thumbnail', width: 400, height: null, fit: 'inside' },
      ],
    },
    pdf: { maxPages: 50 },
    maxPerResource: 5,
    visibility: 'private',
  },
  verification_document: {
    contentTypes: ['image/jpeg', 'image/png', PDF_CONTENT_TYPE],
    maxBytes: 10 * MB,
    image: {
      minWidth: 600,
      minHeight: 600,
      maxWidth: 10_000,
      maxHeight: 10_000,
      variants: [{ name: 'large', width: 2000, height: null, fit: 'inside' }],
    },
    pdf: { maxPages: 100 },
    maxPerResource: 10,
    // Always private, whatever the resource: identity and registration documents.
    visibility: 'private',
  },
};

export function ruleOf(usage: MediaUsage): UsageRule {
  return USAGE_RULES[usage];
}

/** Bucket of a new asset: a usage following its resource starts private until attached. */
export function initialVisibility(rule: UsageRule): MediaVisibility {
  return rule.visibility === 'public' ? 'public' : 'private';
}

/** Bucket the files of an asset attached to a resource of this visibility belong in. */
export function visibilityFor(rule: UsageRule, resource: MediaVisibility): MediaVisibility {
  return rule.visibility === 'resource' ? resource : rule.visibility;
}

/** Files of an always public usage never change under their key: cached for a year. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
/**
 * Public files of a usage following its resource may become private: a shared cache keeps them
 * one hour at most after the move (no CDN purge, ADR 0026).
 */
const RESOURCE_PUBLIC_CACHE = 'public, max-age=3600';

export function cacheControlFor(rule: UsageRule, visibility: MediaVisibility): string {
  if (visibility === 'private') return 'private, no-store';
  return rule.visibility === 'resource' ? RESOURCE_PUBLIC_CACHE : IMMUTABLE_CACHE;
}

export function isImageType(contentType: string): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/** Limits as published to clients (GET /v1/media/usages). */
export function usageLimits(usage: MediaUsage): MediaUsageLimits {
  const rule = USAGE_RULES[usage];
  return {
    usage,
    contentTypes: [...rule.contentTypes],
    maxBytes: rule.maxBytes,
    minWidth: rule.image?.minWidth ?? null,
    minHeight: rule.image?.minHeight ?? null,
    maxWidth: rule.image?.maxWidth ?? null,
    maxHeight: rule.image?.maxHeight ?? null,
    maxPages: rule.pdf?.maxPages ?? null,
    maxPerResource: rule.maxPerResource,
    visibility: rule.visibility,
  };
}
