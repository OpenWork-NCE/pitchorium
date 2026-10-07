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

/** Variants of a private, servable asset with presigned URLs. */
export async function signedVariantsOf(
  asset: MediaAssetRecord,
  storage: ObjectStorage,
  signature: { signedAt: Date; expiresInSeconds: number },
): Promise<Record<string, MediaVariant>> {
  const sign = async (key: string | null) =>
    key
      ? (
          await storage.createDownloadUrl({
            visibility: asset.visibility,
            key,
            signedAt: signature.signedAt,
            expiresInSeconds: signature.expiresInSeconds,
          })
        ).url
      : null;
  const entries = await Promise.all(
    Object.entries(asset.files?.variants ?? {}).map(
      async ([name, variant]) =>
        [
          name,
          {
            width: variant.width,
            height: variant.height,
            webp: await sign(variant.webpKey),
            avif: await sign(variant.avifKey),
          },
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
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
