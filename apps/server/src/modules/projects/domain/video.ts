import type { ProjectVideo } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import type { VideoRef } from './project';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;

const invalid = () =>
  new DomainError('PROJECTS_VIDEO_URL_INVALID', 'Only YouTube and Vimeo video links are accepted');

function youtubeId(url: URL): string | null {
  const [first, second] = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'youtu.be') return first ?? null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  if (first === 'embed' || first === 'shorts' || first === 'live') return second ?? null;
  return null;
}

/**
 * Validates a YouTube or Vimeo link (page, short or embed URL, https only) and keeps the video
 * identifier only: the page shows a privacy-respecting embed, never the URL given (ADR 0042).
 */
export function parseVideoUrl(value: string): VideoRef {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw invalid();
  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeId(url);
    if (!id || !YOUTUBE_ID.test(id)) throw invalid();
    return { provider: 'youtube', videoId: id, hash: null };
  }
  if (VIMEO_HOSTS.has(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    const [id, hashInPath] =
      host === 'player.vimeo.com' ? (parts[0] === 'video' ? parts.slice(1) : []) : parts;
    const hash = hashInPath ?? url.searchParams.get('h');
    if (!id || !VIMEO_ID.test(id) || (hash !== null && !VIMEO_HASH.test(hash))) throw invalid();
    return { provider: 'vimeo', videoId: id, hash };
  }
  throw invalid();
}

/** youtube-nocookie.com, or player.vimeo.com with dnt=1 (no tracking cookie). */
export function videoView(video: VideoRef): ProjectVideo {
  if (video.provider === 'youtube') {
    return {
      provider: 'youtube',
      videoId: video.videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.videoId}`,
    };
  }
  const hash = video.hash ? `&h=${video.hash}` : '';
  return {
    provider: 'vimeo',
    videoId: video.videoId,
    embedUrl: `https://player.vimeo.com/video/${video.videoId}?dnt=1${hash}`,
  };
}
