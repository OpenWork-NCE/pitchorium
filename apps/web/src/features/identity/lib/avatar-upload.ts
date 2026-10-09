import {
  mediaControllerConfirm,
  mediaControllerGet,
  mediaControllerRequestUpload,
  meControllerSetAvatar,
} from '@pitchorium/api-client';

/** Image types accepted for a profile photo (media module). */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type AvatarType = (typeof AVATAR_TYPES)[number];

const POLL_INTERVAL_MS = 1000;
const POLL_ATTEMPTS = 60;

export type AvatarUploadStep = 'uploading' | 'processing';

/** Refusal of a file by the checks of the media module (antivirus, real type, size). */
export class AvatarRejectedError extends Error {
  constructor(readonly reason: string | null) {
    super('avatar rejected');
  }
}

/**
 * Profile photo through the media module (frontend handoff): a signed upload URL, the file sent
 * straight to the storage, the confirmation, then the checks of the worker (antivirus, real type,
 * variants without metadata) until the file is ready, and only then attached to the profile.
 */
export async function uploadAvatar(
  file: File,
  onStep: (step: AvatarUploadStep) => void,
): Promise<void> {
  onStep('uploading');
  const ticket = await mediaControllerRequestUpload({
    usage: 'avatar',
    contentType: file.type as AvatarType,
    size: file.size,
  });
  const sent = await fetch(ticket.upload.url, {
    method: 'PUT',
    headers: ticket.upload.headers,
    body: file,
  });
  if (!sent.ok) throw new Error(`upload ${sent.status}`);
  onStep('processing');
  await mediaControllerConfirm(ticket.media.id);
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const media = await mediaControllerGet(ticket.media.id);
    if (media.status === 'ready') {
      await meControllerSetAvatar({ mediaId: media.id });
      return;
    }
    if (media.status === 'rejected') throw new AvatarRejectedError(media.rejectionReason);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('processing timeout');
}
