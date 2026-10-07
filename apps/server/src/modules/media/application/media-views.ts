import type { MediaAsset, MediaVariant } from '@pitchorium/contracts';
import type { ObjectStorage } from '../../../platform/storage';
import { isServable, type MediaAssetRecord } from '../domain/media-asset';

/** Variants of an asset, with public URLs only for a public, servable file. */
export function variantsOf(
  asset: MediaAssetRecord,
  storage: ObjectStorage,
): Record<string, MediaVariant> {
  const exposed = asset.visibility === 'public' && isServable(asset);
  const url = (key: string | null) => (exposed && key ? storage.publicUrl(key) : null);
  return Object.fromEntries(
    Object.entries(asset.files?.variants ?? {}).map(([name, variant]) => [
      name,
      {
        width: variant.width,
        height: variant.height,
        webp: url(variant.webpKey),
        avif: url(variant.avifKey),
      },
    ]),
  );
}

/** The owner's view of an asset (status, limits checked, URLs). */
export function mediaAssetView(asset: MediaAssetRecord, storage: ObjectStorage): MediaAsset {
  const exposed = asset.visibility === 'public' && isServable(asset);
  const fileKey = asset.files?.fileKey ?? null;
  return {
    id: asset.id,
    usage: asset.usage,
    status: asset.status,
    visibility: asset.visibility,
    contentType: asset.contentType ?? asset.declaredContentType,
    size: asset.size ?? asset.declaredSize,
    width: asset.width,
    height: asset.height,
    pageCount: asset.pageCount,
    rejectionReason: asset.rejectionReason,
    variants: variantsOf(asset, storage),
    fileUrl: exposed && fileKey ? storage.publicUrl(fileKey) : null,
    attached: asset.attachedTo !== null,
    createdAt: asset.createdAt.toISOString(),
  };
}
