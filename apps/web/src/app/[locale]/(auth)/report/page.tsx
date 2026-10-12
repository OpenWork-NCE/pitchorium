import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { Heading, Text } from '@/components/ui';
import { NoticeForm } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { getAuthConfiguration } from '@/lib/auth/configuration';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.trust.notice');
  return { title: t('title'), robots: { index: false, follow: true } };
}

/**
 * Notice of illegal content without an account (§13), linked from the page « Signalement et point
 * de contact » and from the footer; in the frame of the authentication, with Turnstile when the
 * api requires it.
 */
export default async function Page({ params }: PageProps<'/[locale]/report'>) {
  setRequestLocale(asLocale((await params).locale));
  const [t, configuration, member] = await Promise.all([
    getTranslations('web.trust.notice'),
    getAuthConfiguration(),
    getCurrentMember(),
  ]);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Heading level={1} size="page">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('lede')}</Text>
        {member ? <Text size="sm">{t('member')}</Text> : null}
      </div>
      <ScopedMessages scope="notice">
        <NoticeForm turnstile={configuration.turnstile} />
      </ScopedMessages>
    </div>
  );
}
