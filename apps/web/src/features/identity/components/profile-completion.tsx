'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Avatar, Button, Card, Heading, Progress, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { useCurrentMember } from './current-member';

/** Elements of the profile named in the module, the rest summed up by the percentage. */
const NAMED_MISSING = 3;

/**
 * Strength of the profile of the member (§10.1) and what it misses. `card`: the left column of a
 * wide screen, with the identity of the member; `module`: at the top of the feed on a narrow
 * screen, only while the profile is incomplete.
 */
export function ProfileCompletion({ variant }: { variant: 'card' | 'module' }) {
  const t = useTranslations('web.profile.completion');
  const elements = useTranslations('reference.profileElements');
  const locale = useLocale();
  const member = useCurrentMember();
  const { percent, missing } = member.profileStrength;
  const incomplete = percent < 100;
  if (variant === 'module' && !incomplete) return null;
  const named = missing
    .slice(0, NAMED_MISSING)
    .map((element) =>
      elements.has(element as Parameters<typeof elements.has>[0])
        ? elements(element as Parameters<typeof elements>[0])
        : element,
    );
  const strength = (
    <div className="grid w-full gap-1.5 text-left">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-muted">{t('strength')}</span>
        <span className="font-medium tabular-nums">{t('percent', { percent })}</span>
      </div>
      <Progress
        value={percent}
        label={t('strength')}
        valueText={t('percent', { percent })}
        size="sm"
      />
      {named.length > 0 ? (
        <p className="text-xs text-muted">
          {t('missing', {
            list: new Intl.ListFormat(locale, { type: 'conjunction' }).format(named),
          })}
        </p>
      ) : null}
    </div>
  );
  const action = (
    <Button asChild variant="outline" size="sm" className="w-full">
      <Link href={routes.settings}>{t('action')}</Link>
    </Button>
  );

  if (variant === 'module') {
    return (
      <Card padding="sm" className="grid gap-3">
        <section className="grid gap-3" aria-label={t('title')}>
          <Heading level={2} size="label">
            {t('title')}
          </Heading>
          {strength}
          {action}
        </section>
      </Card>
    );
  }
  return (
    <Card padding="none" className="overflow-hidden">
      <div
        aria-hidden
        className="h-16 bg-accent-subtle bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center"
      />
      <div className="-mt-8 grid justify-items-center gap-2 px-5 pb-5 text-center">
        <Avatar
          name={member.profile.displayName}
          src={member.profile.avatarUrl}
          size="lg"
          className="ring-4 ring-surface"
          decorative
        />
        <div className="grid gap-0.5">
          <Heading level={2} size="label">
            {member.profile.displayName}
          </Heading>
          {member.profile.headline ? (
            <Text size="sm" tone="muted">
              {member.profile.headline}
            </Text>
          ) : null}
        </div>
        {incomplete ? (
          <>
            <div className="mt-2 w-full">{strength}</div>
            <div className="mt-2 w-full">{action}</div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
