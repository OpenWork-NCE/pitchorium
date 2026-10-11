'use client';

import {
  missionsControllerAccept,
  missionsControllerCancel,
  missionsControllerComplete,
  missionsControllerDecline,
} from '@pitchorium/api-client';
import type { MissionEngagement } from '@pitchorium/contracts';
import { Clock, HandHeart } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  Dialog,
  DialogContent,
  DateTimeField,
  Field,
  FormActions,
  Heading,
  Input,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { Link, useRouter } from '@/i18n/navigation';
import { engagementActions } from '../lib/engagement-actions';
import { MISSION_MESSAGE_MAX_LENGTH } from '../lib/limits';
import { useMissionProblem } from './use-mission-problem';

const DESCRIPTION_MAX = 1000;

/** Today in the zone of the browser, `YYYY-MM-DD`: the default day of the hours declared. */
const today = () => new Date().toLocaleDateString('en-CA');

/**
 * An engagement on a mission (§6.3, §9.4, ADR 0071): who gives their time, who is helped, the
 * messages, its state, and the actions of the reader: answer it (the author), complete it (the
 * expert, who declares the hours once: they go to the shared time log, where the beneficiary
 * confirms them; no second entry), cancel or withdraw it. The hours and their confirmation are
 * shown here with the way to the time log.
 */
export function EngagementView({
  engagement,
  viewerHandle,
}: {
  engagement: MissionEngagement;
  viewerHandle: string;
}) {
  const t = useTranslations('web.missions.engagement');
  const statuses = useTranslations('reference.missionEngagementStatuses');
  const entryStatuses = useTranslations('reference.timeEntryStatuses');
  const format = useFormatter();
  const router = useRouter();
  const announce = useAnnounce();
  const problem = useMissionProblem();
  const expert = engagement.expert.handle === viewerHandle;
  const beneficiary = engagement.beneficiary.handle === viewerHandle;
  const responder = engagement.mission.author.member.handle === viewerHandle;
  const actions = engagementActions({ status: engagement.status, expert, beneficiary, responder });
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [completing, setCompleting] = useState(false);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('0');
  const [day, setDay] = useState(today);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(name: string, action: () => Promise<unknown>, done: string) {
    setBusy(name);
    setError(null);
    try {
      await action();
      announce(done);
      router.refresh();
      return true;
    } catch (failure) {
      setError(problem(failure));
      return false;
    } finally {
      setBusy(null);
    }
  }

  const total = Number(hours || 0) * 60 + Number(minutes || 0);
  return (
    <div className="grid gap-6" data-engagement-status={engagement.status}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{statuses(engagement.status)}</Badge>
        <Link href={routes.mission(engagement.mission.id)} className="link-underline-hover text-sm">
          {t('seeMission')}
        </Link>
      </div>
      <Callout icon={<HandHeart />}>{t('volunteer')}</Callout>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['expert', engagement.expert],
            ['beneficiary', engagement.beneficiary],
          ] as const
        ).map(([role, member]) => (
          <Card key={role} className="flex items-center gap-3">
            <Avatar name={member.displayName} src={member.avatarUrl} size="md" decorative />
            <div className="grid min-w-0">
              <Text size="xs" tone="muted">
                {t(`roles.${role}`)}
              </Text>
              <Link
                href={routes.member(member.handle)}
                className="truncate link-underline-hover font-medium"
              >
                {member.displayName}
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {engagement.project ? (
        <Text size="sm">
          {t('forProject')}{' '}
          <Link href={routes.project(engagement.project.slug)} className="link-underline-hover">
            {engagement.project.title}
          </Link>
        </Text>
      ) : null}
      <section aria-labelledby="engagement-messages" className="grid gap-3">
        <Heading level={2} size="section" id="engagement-messages">
          {t('messages')}
        </Heading>
        <Card className="grid gap-1">
          <Text size="xs" tone="muted">
            {t('askedOn', {
              date: format.dateTime(new Date(engagement.requestedAt), { dateStyle: 'long' }),
            })}
          </Text>
          <Text className="whitespace-pre-line">{engagement.message}</Text>
        </Card>
        {engagement.answerMessage ? (
          <Card className="grid gap-1">
            <Text size="xs" tone="muted">
              {t('answer')}
            </Text>
            <Text className="whitespace-pre-line">{engagement.answerMessage}</Text>
          </Card>
        ) : null}
      </section>
      {engagement.timeEntry ? (
        <Card className="grid gap-2" data-time-entry={engagement.timeEntry.status}>
          <Heading level={2} size="card" className="flex items-center gap-2">
            <Clock aria-hidden className="size-5 text-muted" />
            {t('time')}
          </Heading>
          <Text className="tabular-nums">
            {t('timeDeclared', {
              hours: format.number(engagement.timeEntry.minutes / 60, {
                maximumFractionDigits: 2,
              }),
              status: entryStatuses(engagement.timeEntry.status),
            })}
          </Text>
          <Text size="sm" tone="muted">
            {engagement.timeEntry.status === 'declared'
              ? beneficiary
                ? t('timeToConfirm')
                : t('timeAwaiting')
              : t('timeAnswered')}
          </Text>
          <Button
            asChild
            variant={
              beneficiary && engagement.timeEntry.status === 'declared' ? 'primary' : 'outline'
            }
            size="sm"
            className="w-fit"
          >
            <Link href={routes.timeLog}>{t('timeLog')}</Link>
          </Button>
        </Card>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {actions.length > 0 ? (
        <div className="grid gap-3" data-engagement-actions="">
          {actions.includes('accept') ? (
            <Field label={t('answerMessage')} optional>
              <Textarea
                value={answer}
                onChange={(change) => setAnswer(change.target.value)}
                maxLength={MISSION_MESSAGE_MAX_LENGTH}
                rows={3}
              />
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {actions.includes('accept') ? (
              <>
                <Button
                  loading={busy === 'accept'}
                  loadingLabel={t('accepting')}
                  onClick={() =>
                    void run(
                      'accept',
                      () =>
                        missionsControllerAccept(engagement.id, {
                          message: answer.trim() || null,
                        }),
                      t('accepted'),
                    )
                  }
                >
                  {t('accept')}
                </Button>
                <Button
                  variant="outline"
                  loading={busy === 'decline'}
                  loadingLabel={t('declining')}
                  onClick={() =>
                    void run(
                      'decline',
                      () =>
                        missionsControllerDecline(engagement.id, {
                          message: answer.trim() || null,
                        }),
                      t('declined'),
                    )
                  }
                >
                  {t('decline')}
                </Button>
              </>
            ) : null}
            {actions.includes('complete') ? (
              <Dialog open={completing} onOpenChange={setCompleting}>
                <Button onClick={() => setCompleting(true)}>{t('complete')}</Button>
                <DialogContent title={t('completeTitle')} description={t('completeBody')} size="md">
                  <form
                    className="grid gap-5"
                    onSubmit={(submit) => {
                      submit.preventDefault();
                      void run(
                        'complete',
                        () =>
                          missionsControllerComplete(engagement.id, {
                            minutes: total,
                            date: day,
                            description: description.trim(),
                          }),
                        t('completed'),
                      ).then((done) => {
                        if (done) setCompleting(false);
                      });
                    }}
                  >
                    <fieldset className="grid gap-2">
                      <legend className="mb-1 text-sm font-medium">{t('duration')}</legend>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label={t('hours')}>
                          <Input
                            inputMode="numeric"
                            value={hours}
                            onChange={(change) => setHours(change.target.value.replace(/\D/g, ''))}
                          />
                        </Field>
                        <Field label={t('minutes')}>
                          <Input
                            inputMode="numeric"
                            value={minutes}
                            onChange={(change) =>
                              setMinutes(change.target.value.replace(/\D/g, ''))
                            }
                          />
                        </Field>
                      </div>
                    </fieldset>
                    <Field label={t('date')}>
                      <DateTimeField
                        granularity="day"
                        value={day || null}
                        maxDate={today()}
                        onChange={(next) => setDay(next ?? '')}
                      />
                    </Field>
                    <Field label={t('description')} description={t('descriptionHint')}>
                      <Textarea
                        value={description}
                        onChange={(change) => setDescription(change.target.value)}
                        maxLength={DESCRIPTION_MAX}
                        rows={3}
                      />
                    </Field>
                    {error ? (
                      <p role="alert" className="text-sm text-danger">
                        {error}
                      </p>
                    ) : null}
                    <FormActions>
                      <Button
                        type="submit"
                        loading={busy === 'complete'}
                        loadingLabel={t('completing')}
                      >
                        {t('completeSubmit')}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setCompleting(false)}>
                        {t('back')}
                      </Button>
                    </FormActions>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
            {actions.includes('cancel') || actions.includes('withdraw') ? (
              <AlertDialog
                trigger={
                  <Button variant="ghost">
                    {actions.includes('withdraw') ? t('withdraw') : t('cancel')}
                  </Button>
                }
                title={actions.includes('withdraw') ? t('withdrawTitle') : t('cancelTitle')}
                description={actions.includes('withdraw') ? t('withdrawBody') : t('cancelBody')}
                confirmLabel={actions.includes('withdraw') ? t('withdraw') : t('cancel')}
                onConfirm={async () => {
                  await run('cancel', () => missionsControllerCancel(engagement.id), t('canceled'));
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
