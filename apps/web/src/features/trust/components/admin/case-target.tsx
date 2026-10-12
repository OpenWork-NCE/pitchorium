'use client';

import type {
  ModerationPerson,
  ModerationTarget,
  ReportedMessageContext,
} from '@pitchorium/contracts';
import { ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge, Card, Heading, Icon, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/** The page of a reported target, when it has one the moderators may open. */
export function targetPath(target: ModerationTarget): string | null {
  switch (target.type) {
    case 'profile':
      return routes.member(target.key);
    case 'organization':
      return routes.organization(target.key);
    case 'post':
      return routes.post(target.key);
    case 'comment':
      return target.parentKey ? routes.post(target.parentKey) : null;
    case 'project':
      return routes.project(target.key);
    case 'project_update':
      return target.parentKey ? routes.project(target.parentKey) : null;
    case 'event':
      return routes.event(target.key);
    case 'mission':
      return routes.mission(target.key);
    case 'message':
    case 'media':
      return null;
  }
}

/**
 * What was reported, as the api gives it to the moderators whatever its audience: its name or
 * title, its text, its moderation status and its page; a message is read in the limited context
 * of its report (the reported message and the three before it, never the whole conversation).
 */
export function CaseTarget({
  target,
  messageContext,
  people,
}: {
  target: ModerationTarget | null;
  messageContext: ReportedMessageContext | null;
  people: ReadonlyMap<string, ModerationPerson>;
}) {
  const t = useTranslations('web.admin.moderation.case');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  if (!target) {
    return (
      <Card className="p-5">
        <Text tone="muted">{t('targetGone')}</Text>
      </Card>
    );
  }
  const path = targetPath(target);
  return (
    <Card className="grid gap-3 p-5" aria-labelledby="target-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} size="card" id="target-title">
          {t('target', { type: reference(`reportTargetTypes.${target.type}`) })}
        </Heading>
        {target.moderationStatus && target.moderationStatus !== 'visible' ? (
          <Badge tone="warning">
            {t(`status.${target.moderationStatus === 'hidden' ? 'hidden' : 'removed'}`)}
          </Badge>
        ) : null}
      </div>
      {target.label ? <p className="font-medium">{target.label}</p> : null}
      {target.excerpt ? (
        <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-sunken px-4 py-3 text-sm whitespace-pre-line">
          {target.excerpt}
        </blockquote>
      ) : null}
      {messageContext ? (
        <div className="grid gap-2">
          <Text size="sm" tone="muted">
            {t('messageContext')}
          </Text>
          <ol className="grid gap-2">
            {messageContext.messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.reported
                    ? 'rounded-md border border-danger/40 bg-danger-subtle/40 px-3 py-2 text-sm'
                    : 'rounded-md border border-border px-3 py-2 text-sm'
                }
              >
                <span className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                  <span>{people.get(message.senderId)?.name ?? common('deletedMember')}</span>
                  <span className="font-numeric tabular-nums">
                    {format.dateTime(new Date(message.sentAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </span>
                <span className="block whitespace-pre-line">
                  {message.text ?? t('messageHidden')}
                </span>
                {message.reported ? <Badge tone="danger">{t('reportedMessage')}</Badge> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {path ? (
        <Link
          href={path}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 link-underline-hover text-sm font-medium text-accent"
        >
          {t('openTarget')}
          <Icon icon={ExternalLink} size="sm" />
        </Link>
      ) : null}
    </Card>
  );
}
