'use client';

import { onlineManager } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Banner, useAnnounce } from '@/components/ui';
import { usePlural } from '@/lib/i18n/plural';
import { useOnline, usePausedMutations } from '@/lib/query/offline';

/**
 * Offline mode of the member space (ADR 0097, patterns.md): a banner while the network is gone,
 * with the actions waiting for it; the return of the network is announced, with the count of the
 * actions sent. The data already loaded stays readable.
 */
export function OfflineBanner() {
  const t = useTranslations('web.banners.offline');
  const plural = usePlural();
  const online = useOnline();
  const paused = usePausedMutations();
  const announce = useAnnounce();
  const [back, setBack] = useState<number | null>(null);
  // Actions waiting at the last render: read when the network comes back, before they leave.
  const waiting = useRef(paused);
  useEffect(() => {
    waiting.current = paused;
  });

  useEffect(() => {
    let wasOnline = onlineManager.isOnline();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onlineManager.subscribe((isOnline) => {
      if (!isOnline) {
        announce(t('title'));
      } else if (!wasOnline) {
        const pending = waiting.current;
        setBack(pending);
        announce(pending > 0 ? t(`sent.${plural(pending)}`, { count: pending }) : t('back'));
        clearTimeout(timer);
        timer = setTimeout(() => setBack(null), 4000);
      }
      wasOnline = isOnline;
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [announce, t, plural]);

  if (!online) {
    return (
      <Banner tone="neutral">
        <span className="font-medium">{t('title')}</span> {t('body')}{' '}
        {paused > 0 ? <span>{t(`pending.${plural(paused)}`, { count: paused })}</span> : null}
      </Banner>
    );
  }
  if (back !== null) {
    return (
      <Banner tone="info">
        {back > 0 ? t(`sent.${plural(back)}`, { count: back }) : t('back')}
      </Banner>
    );
  }
  return null;
}
