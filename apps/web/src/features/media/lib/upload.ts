import {
  mediaControllerConfirm,
  mediaControllerGet,
  mediaControllerRequestUpload,
} from '@pitchorium/api-client';
import type { MediaUsage } from '@pitchorium/contracts';

const POLL_INTERVAL_MS = 1000;
const POLL_ATTEMPTS = 90;

/** Where an upload stands: sending (with its share, 0 to 1), then the checks of the worker. */
export type UploadStep = { step: 'sending'; progress: number } | { step: 'checking' };

/** Refusal of a file by the checks of the media module (antivirus, real type, size). */
export class MediaRejectedError extends Error {
  constructor(readonly reason: string | null) {
    super('media rejected');
  }
}

/** PUT of the file to its signed address, with the progress of the browser (XHR, not fetch). */
function put(
  url: string,
  headers: Record<string, string>,
  file: Blob,
  onProgress: (share: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status < 300 ? resolve() : reject(new Error(`upload ${request.status}`));
    request.onerror = () => reject(new Error('upload network'));
    request.send(file);
  });
}

/**
 * A file through the media module (frontend handoff): a signed upload address, the file sent
 * straight to the storage with its progress, the confirmation, then the checks of the worker
 * (antivirus, real type, variants without metadata) until the file is ready. Resolves with its
 * id, to attach it to a resource; a refusal rejects with its reason.
 */
export async function uploadMedia(
  file: Blob,
  usage: MediaUsage,
  onStep: (step: UploadStep) => void,
): Promise<string> {
  onStep({ step: 'sending', progress: 0 });
  const ticket = await mediaControllerRequestUpload({
    usage,
    contentType: file.type as never,
    size: file.size,
  });
  await put(ticket.upload.url, ticket.upload.headers, file, (progress) =>
    onStep({ step: 'sending', progress }),
  );
  onStep({ step: 'checking' });
  await mediaControllerConfirm(ticket.media.id);
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const media = await mediaControllerGet(ticket.media.id);
    if (media.status === 'ready') return media.id;
    if (media.status === 'rejected') throw new MediaRejectedError(media.rejectionReason);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('processing timeout');
}
