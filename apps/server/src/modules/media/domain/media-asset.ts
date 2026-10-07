import type {
  MediaContentType,
  MediaModerationStatus,
  MediaRejectionReason,
  MediaStatus,
  MediaUsage,
  MediaVisibility,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { isImageType, PDF_CONTENT_TYPE, type UsageRule, USAGE_RULES } from './usages';

export type MediaSource = 'upload' | 'import';

export interface StoredVariant {
  width: number;
  height: number;
  webpKey: string;
  avifKey: string | null;
}

export interface MediaFiles {
  /** The file itself (PDF); images keep only their variants. */
  fileKey: string | null;
  variants: Record<string, StoredVariant>;
}

export interface MediaResourceRef {
  type: string;
  id: string;
}

export interface MediaAssetRecord {
  id: string;
  ownerId: string;
  usage: MediaUsage;
  source: MediaSource;
  status: MediaStatus;
  visibility: MediaVisibility;
  declaredContentType: MediaContentType;
  declaredSize: number;
  contentType: MediaContentType | null;
  size: number | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  quarantineKey: string;
  files: MediaFiles | null;
  rejectionReason: MediaRejectionReason | null;
  moderationStatus: MediaModerationStatus;
  importUrl: string | null;
  attachedTo: MediaResourceRef | null;
  unattachedSince: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface StorageUsage {
  count: number;
  bytes: number;
}

export interface Quota {
  maxFiles: number;
  maxBytes: number;
}

/** Storage keys are derived from the asset and a digest of the content, never from a name. */
export const storageKeys = {
  quarantine: (id: string) => `quarantine/${id}`,
  variant: (id: string, name: string, digest: string, format: 'webp' | 'avif') =>
    `media/${id}/${name}-${digest.slice(0, 16)}.${format}`,
  file: (id: string, digest: string) => `media/${id}/file-${digest.slice(0, 16)}.pdf`,
};

/** Every stored object of a processed asset (quarantine excluded). */
export function fileKeys(files: MediaFiles): string[] {
  return [
    ...(files.fileKey ? [files.fileKey] : []),
    ...Object.values(files.variants).flatMap((variant) =>
      variant.avifKey ? [variant.webpKey, variant.avifKey] : [variant.webpKey],
    ),
  ];
}

/** Checks the declared type and size before an upload URL is issued. */
export function assertDeclaredUpload(
  usage: MediaUsage,
  contentType: MediaContentType,
  size: number,
): UsageRule {
  const rule = USAGE_RULES[usage];
  if (!rule.contentTypes.includes(contentType)) {
    throw new DomainError('MEDIA_TYPE_NOT_ALLOWED', `${contentType} is not allowed for ${usage}`);
  }
  if (size > rule.maxBytes) {
    throw new DomainError('MEDIA_TOO_LARGE', `${size} bytes exceed ${rule.maxBytes} for ${usage}`);
  }
  return rule;
}

export function assertWithinQuota(used: StorageUsage, size: number, quota: Quota): void {
  if (used.count + 1 > quota.maxFiles || used.bytes + size > quota.maxBytes) {
    throw new DomainError('MEDIA_QUOTA_EXCEEDED', 'Storage quota exceeded');
  }
}

/**
 * Checks the real content against the usage. The declared type is never trusted: the detected
 * type must be allowed and, for an upload, equal to the declared one.
 */
export function checkContent(
  rule: UsageRule,
  declared: MediaContentType | null,
  detected: string | null,
  size: number,
): MediaRejectionReason | null {
  if (size > rule.maxBytes) return 'size_exceeded';
  if (!detected || !(rule.contentTypes as readonly string[]).includes(detected)) {
    return 'type_not_allowed';
  }
  if (declared !== null && detected !== declared) return 'type_mismatch';
  return null;
}

export function checkImageDimensions(
  rule: UsageRule,
  width: number,
  height: number,
): MediaRejectionReason | null {
  if (!rule.image) return 'type_not_allowed';
  if (width < rule.image.minWidth || height < rule.image.minHeight) return 'image_too_small';
  if (width > rule.image.maxWidth || height > rule.image.maxHeight) return 'image_too_large';
  return null;
}

export function checkPdfPages(rule: UsageRule, pages: number): MediaRejectionReason | null {
  if (!rule.pdf) return 'type_not_allowed';
  return pages > rule.pdf.maxPages ? 'pdf_too_many_pages' : null;
}

export function kindOf(contentType: string): 'image' | 'pdf' | null {
  if (isImageType(contentType)) return 'image';
  return contentType === PDF_CONTENT_TYPE ? 'pdf' : null;
}

export function assertConfirmable(asset: MediaAssetRecord): void {
  if (asset.status !== 'pending' || asset.source !== 'upload') {
    throw new DomainError('MEDIA_INVALID_STATE', `Media ${asset.id} is ${asset.status}`);
  }
}

/**
 * A ready asset of the right usage, uploaded by `ownerId`, may be attached. Another owner's
 * asset is reported as missing, so that identifiers cannot be probed.
 */
export function assertAttachable(
  asset: MediaAssetRecord | null,
  ownerId: string,
  usage: MediaUsage,
): MediaAssetRecord {
  if (!asset || asset.ownerId !== ownerId || asset.status === 'deleted') {
    throw new DomainError('MEDIA_NOT_FOUND', 'Media not found');
  }
  if (asset.usage !== usage) {
    throw new DomainError('MEDIA_USAGE_MISMATCH', `Media is for ${asset.usage}, not ${usage}`);
  }
  if (asset.status !== 'ready') throw new DomainError('MEDIA_NOT_READY', 'Media is not ready');
  return asset;
}

export function assertDeletable(asset: MediaAssetRecord): void {
  if (asset.status === 'deleted') throw new DomainError('MEDIA_NOT_FOUND', 'Media not found');
  if (asset.attachedTo) {
    throw new DomainError('MEDIA_ATTACHED', 'Detach the media from its resource first');
  }
}

/** A file is served only when ready and not removed by moderation. */
export function isServable(asset: MediaAssetRecord): boolean {
  return asset.status === 'ready' && asset.moderationStatus !== 'removed';
}
