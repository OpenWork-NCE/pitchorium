import {
  ApiProblemError,
  mediaControllerConfirm,
  mediaControllerGet,
  mediaControllerRequestUpload,
} from '@pitchorium/api-client';
import type { MediaUsage } from '@pitchorium/contracts';

/**
 * The checks of the worker are polled at a growing interval (1 s, then up to 5 s), for two
 * minutes at most: nine photos sent at once stay under the rate limit of the api (120 calls a
 * minute), and a refusal for the limit only delays the next look.
 */
const POLL_FIRST_MS = 1000;
const POLL_MAX_MS = 5000;
const POLL_DEADLINE_MS = 120_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where an upload stands: sending (with its share, 0 to 1), then the checks of the worker. */
export type UploadStep = { step: 'sending'; progress: number } | { step: 'checking' };

/** Refusal of a file by the checks of the media module (antivirus, real type, size). */
export class MediaRejectedError extends Error {
  constructor(readonly reason: string | null) {
    super('media rejected');
  }
}

/** Headers only the browser may set (Fetch standard); the signature still covers the length. */
const FORBIDDEN_HEADERS = new Set(['content-length', 'host', 'connection']);

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
    for (const [name, value] of Object.entries(headers)) {
      // The browser sets the length itself and refuses a script that tries (forbidden header).
      if (FORBIDDEN_HEADERS.has(name.toLowerCase())) continue;
      request.setRequestHeader(name, value);
    }
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
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let delay = POLL_FIRST_MS;
  while (Date.now() < deadline) {
    await wait(delay);
    delay = Math.min(POLL_MAX_MS, Math.round(delay * 1.5));
    let media;
    try {
      media = await mediaControllerGet(ticket.media.id);
    } catch (error) {
      if (error instanceof ApiProblemError && error.problem.status === 429) continue;
      throw error;
    }
    if (media.status === 'ready') return media.id;
    if (media.status === 'rejected') throw new MediaRejectedError(media.rejectionReason);
  }
  throw new Error('processing timeout');
}
