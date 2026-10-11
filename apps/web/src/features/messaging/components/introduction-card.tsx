'use client';

import {
  getMessagingControllerListIntroductionsQueryKey,
  getNotificationsControllerCountersQueryKey,
  messagingControllerAcceptIntroduction,
  messagingControllerDeclineIntroduction,
} from '@pitchorium/api-client';
import type { Introduction, IntroductionAnswer, MemberCard } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AvatarGroup, Badge, Button, Card, notify, RelativeTime } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { useMessagingProblem } from '../hooks/use-messaging-problem';

const ANSWER_ICONS = { pending: Clock, accepted: Check, declined: X } as const;

/** My answer, for an introduced member; null for the introducer. */
export function answerOf(introduction: Introduction): IntroductionAnswer | null {
  if (introduction.role === 'first') return introduction.answers.first;
  if (introduction.role === 'second') return introduction.answers.second;
  return null;
}

/**
 * An introduction between three members (§10.4, ADR 0058), as its reader sees it: who presents
 * whom, the note, where each answer stands (the introducer never learns who declined), and for an
 * introduced member who has not answered, accept or decline; once both accepted, the group
 * conversation it opened.
 */
export function IntroductionCard({
  introduction,
  onChange,
  headingLevel = 2,
}: {
  introduction: Introduction;
  onChange?: (introduction: Introduction) => void;
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations('web.messaging.introductions');
  const queryClient = useQueryClient();
  const problem = useMessagingProblem();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const someone = t('someone');
  const name = (card: MemberCard | null) => card?.displayName ?? someone;
  const { introducer, first, second } = introduction;
  const other = introduction.role === 'first' ? second : first;
  const mine = answerOf(introduction);
  const Heading = `h${headingLevel}` as const;

  const title =
    introduction.role === 'introducer'
      ? t('youIntroduced', { first: name(first), second: name(second) })
      : t('introducedYou', { introducer: name(introducer), other: name(other) });

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline');
    try {
      await (accept
        ? messagingControllerAcceptIntroduction(introduction.id)
        : messagingControllerDeclineIntroduction(introduction.id));
      const role = introduction.role === 'first' ? 'first' : 'second';
      const answer = accept ? 'accepted' : 'declined';
      const answers = { ...introduction.answers, [role]: answer };
      const status =
        answer === 'declined'
          ? 'declined'
          : answers.first === 'accepted' && answers.second === 'accepted'
            ? 'completed'
            : 'pending';
      onChange?.({ ...introduction, answers, status });
      notify.success(accept ? t('accepted') : t('declined'));
      void queryClient.invalidateQueries({
        queryKey: getMessagingControllerListIntroductionsQueryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: getNotificationsControllerCountersQueryKey(),
      });
    } catch (error) {
      notify.error(problem(error));
    } finally {
      setBusy(null);
    }
  }

  const people = [introducer, first, second].filter((card): card is MemberCard => card !== null);
  return (
    <Card padding="md" className="grid gap-4" data-card="">
      <div className="flex items-start gap-3">
        <AvatarGroup
          size="sm"
          max={3}
          label={people.map((card) => card.displayName).join(', ')}
          people={people.map((card) => ({ name: card.displayName, src: card.avatarUrl }))}
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <Heading className="text-base font-semibold text-pretty text-foreground">{title}</Heading>
          <RelativeTime date={introduction.createdAt} className="text-xs text-muted" />
        </div>
        <Badge
          tone={
            introduction.status === 'completed'
              ? 'success'
              : introduction.status === 'declined'
                ? 'neutral'
                : 'info'
          }
        >
          {t(`status.${introduction.status}`)}
        </Badge>
      </div>
      {introduction.note ? (
        <blockquote className="border-l-2 border-accent pl-4 text-sm text-pretty whitespace-pre-line text-foreground">
          {introduction.note}
        </blockquote>
      ) : null}
      {introduction.role === 'introducer' && introduction.status === 'pending' ? (
        <ul className="grid gap-1 text-sm text-muted">
          {(['first', 'second'] as const).map((side) => {
            const Icon = ANSWER_ICONS[introduction.answers[side]];
            return (
              <li key={side} className="flex items-center gap-2">
                <Icon aria-hidden className="size-4" />
                {t(`answer.${introduction.answers[side]}`, { name: name(introduction[side]) })}
              </li>
            );
          })}
        </ul>
      ) : null}
      {mine === 'pending' && introduction.status === 'pending' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={busy === 'accept'}
            loadingLabel={t('accepting')}
            onClick={() => void respond(true)}
          >
            {t('accept')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'decline'}
            loadingLabel={t('declining')}
            onClick={() => void respond(false)}
          >
            {t('decline')}
          </Button>
        </div>
      ) : mine === 'accepted' && introduction.status === 'pending' ? (
        <p className="text-sm text-muted">{t('waitingOther', { name: name(other) })}</p>
      ) : null}
      {introduction.status === 'completed' && introduction.conversationId ? (
        <Button asChild variant="secondary" size="sm" className="justify-self-start">
          <Link href={routes.conversation(introduction.conversationId)}>
            {t('openConversation')}
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}
