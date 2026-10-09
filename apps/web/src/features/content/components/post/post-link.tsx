import type { LinkPreview } from '@pitchorium/contracts';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui';

/** The site of an address, for a link without its name. */
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * The preview of the link of a publication: its image imported by the platform (never loaded
 * from the site, ADR 0033), its title, its description and its site; the address alone while it
 * is prepared or when the site gave nothing.
 */
export function PostLink({ link }: { link: LinkPreview }) {
  const t = useTranslations('web.content.link');
  const site = link.siteName ?? siteOf(link.url);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      aria-label={`${link.title ?? site} (${t('label')})`}
      className="group grid overflow-hidden rounded-lg border border-border bg-surface-sunken outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus"
    >
      {link.imageUrl ? (
        <span className="block aspect-video overflow-hidden bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element -- variant of the CDN, sized. */}
          <img
            src={link.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-(--duration-page) ease-(--ease-enter) group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </span>
      ) : null}
      <span className="grid gap-1 p-3">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <ExternalLink aria-hidden className="size-3.5" />
          {site}
        </span>
        {link.status === 'pending' ? (
          <>
            <Skeleton className="h-4 w-3/4" />
            <span className="sr-only">{t('pending')}</span>
          </>
        ) : link.title ? (
          <span className="line-clamp-2 font-semibold">{link.title}</span>
        ) : (
          <span className="line-clamp-1 break-all">{link.url}</span>
        )}
        {link.description ? (
          <span className="line-clamp-2 text-sm text-muted">{link.description}</span>
        ) : null}
      </span>
    </a>
  );
}
