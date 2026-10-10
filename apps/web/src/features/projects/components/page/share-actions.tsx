'use client';

import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { Button, CopyButton, Link } from '@/components/ui';
import { shareLinks } from '../../lib/share';

/** The share sheet of the browser does not come and go while the page is open. */
const noSubscription = () => () => undefined;

/**
 * Sharing a project (§11.2): copy its address, the share sheet of the phone (Web Share, offered
 * once the browser says it has one), and the plain share addresses of WhatsApp, LinkedIn and X,
 * without any script of theirs.
 */
export function ShareActions({ url, title }: { url: string; title: string }) {
  const t = useTranslations('web.projects.share');
  // Known only in the browser: the server renders the plain links, the sheet joins afterwards.
  const native = useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === 'function',
    () => false,
  );
  const links = shareLinks(url, title);
  const external = { newTabLabel: t('newTab') };
  return (
    <div className="grid gap-2" role="group" aria-label={t('title')}>
      <p className="text-sm font-medium">{t('title')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={url} label={t('copy')} copiedLabel={t('copied')} variant="outline" />
        {native ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigator.share({ title, url }).catch(() => undefined)}
          >
            <Share2 aria-hidden />
            {t('native')}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li>
          <Link href={links.whatsapp} variant="standalone" external={external}>
            {t('whatsapp')}
          </Link>
        </li>
        <li>
          <Link href={links.linkedin} variant="standalone" external={external}>
            {t('linkedin')}
          </Link>
        </li>
        <li>
          <Link href={links.x} variant="standalone" external={external}>
            {t('x')}
          </Link>
        </li>
      </ul>
    </div>
  );
}
