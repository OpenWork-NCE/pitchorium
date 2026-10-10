'use client';

import type { ProjectVideo } from '@pitchorium/contracts';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

const PROVIDERS = { youtube: 'YouTube', vimeo: 'Vimeo' } as const;

/** The embed address the api gives (privacy-respecting variant, ADR 0042), playing at once. */
export function autoplayUrl(embedUrl: string): string {
  const url = new URL(embedUrl);
  url.searchParams.set('autoplay', '1');
  return url.toString();
}

/**
 * The video of a project behind a facade (ADR 0129): the image of the project and a play button,
 * nothing of YouTube or Vimeo loaded until the click (performance, privacy); then the player in
 * its privacy-respecting variant (youtube-nocookie.com, Vimeo with `dnt=1`), the only frames the
 * policy of the page allows (ADR 0088).
 */
export function VideoFacade({
  video,
  title,
  poster,
}: {
  video: ProjectVideo;
  /** Title of the project: the accessible name of the button and of the player. */
  title: string;
  /** The visual of the project, or the pattern of the brand without one. */
  poster: string | null;
}) {
  const t = useTranslations('web.projects.video');
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const provider = PROVIDERS[video.provider];
  return (
    <figure className="grid gap-2">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-cover-placeholder">
        {playing ? (
          <iframe
            ref={frame}
            src={autoplayUrl(video.embedUrl)}
            title={t('player', { title, provider })}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => frame.current?.focus()}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center dark:brightness-[2.6]"
            />
            {poster ? (
              // The image of the project, not a thumbnail of the provider: nothing leaves for it.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
            ) : null}
            <span className="relative flex items-center gap-3 rounded-full bg-accent px-5 py-3 text-sm font-medium text-on-accent shadow-md transition-transform duration-(--duration-micro) ease-(--ease-enter) group-hover:scale-105 group-active:scale-95">
              <Play aria-hidden className="size-5 fill-current" />
              {t('play', { title })}
            </span>
          </button>
        )}
      </div>
      <figcaption className="text-xs text-muted">{t('notice', { provider })}</figcaption>
    </figure>
  );
}
