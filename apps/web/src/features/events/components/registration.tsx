'use client';

import { eventsControllerRegister, eventsControllerWithdraw } from '@pitchorium/api-client';
import type { EventStatus, EventViewer } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Hourglass } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AnimatedNumber, LabelSwap } from '@/components/motion';
import { AlertDialog, Button, Checkbox, Text, useAnnounce } from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { onRealtime, REALTIME_EVENTS } from '@/lib/realtime/realtime-bus';
import { registrationState } from '../lib/registration';
import { useEventProblem } from './use-event-problem';
import { COUNTERS_QUERY_KEY } from '@/lib/query/keys';

interface RegistrationProps {
  eventId: string;
  status: EventStatus;
  startsAt: string;
  full: boolean;
  viewer: EventViewer | null;
}

type Kept = Pick<EventViewer, 'registration' | 'waitlistPosition' | 'showInAttendees'>;

/**
 * Registration of a member to an event (ADR 0070): a seat while one is free, else the waiting
 * list with its position, promoted when a seat frees (said as soon as its notification arrives);
 * withdrawal confirmed. The button changes its label in place, without a jump of its width; the
 * position counts to its value. The consent to appear among the participants is asked, refused by
 * default. The api decides each time; its refusal is said with its reason.
 */
export function Registration({ eventId, status, startsAt, full, viewer }: RegistrationProps) {
  const t = useTranslations('web.events.registration');
  const format = useFormatter();
  const announce = useAnnounce();
  const router = useRouter();
  const queryClient = useQueryClient();
  const withPrerequisites = useWithPrerequisites();
  const problem = useEventProblem();
  const [kept, setKept] = useState<Kept>({
    registration: viewer?.registration ?? null,
    waitlistPosition: viewer?.waitlistPosition ?? null,
    showInAttendees: viewer?.showInAttendees ?? false,
  });
  const [consent, setConsent] = useState(viewer?.showInAttendees ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = registrationState({
    status,
    startsAt,
    full,
    viewer: viewer ? { registration: kept.registration } : null,
  });

  // A seat freed for a member of the waiting list: its notification says it, the page follows.
  useEffect(() => {
    if (kept.registration !== 'waitlisted') return;
    return onRealtime(REALTIME_EVENTS.notification, (payload) => {
      const type = (payload as { notification?: { type?: string } }).notification?.type;
      if (type !== 'event_waitlist_promoted') return;
      setKept((current) => ({ ...current, registration: 'registered', waitlistPosition: null }));
      announce(t('promoted'));
      router.refresh();
    });
  }, [kept.registration, announce, t, router]);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const registration = await withPrerequisites(() =>
        eventsControllerRegister(eventId, { showInAttendees: consent }),
      );
      setKept({
        registration: registration.status,
        waitlistPosition: registration.waitlistPosition,
        showInAttendees: registration.showInAttendees,
      });
      announce(
        registration.status === 'registered'
          ? t('registered')
          : t('waitlisted', { position: registration.waitlistPosition ?? 1 }),
      );
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setError(null);
    try {
      await eventsControllerWithdraw(eventId);
      setKept({ registration: null, waitlistPosition: null, showInAttendees: false });
      announce(t('withdrawn'));
      await queryClient.invalidateQueries({
        queryKey: COUNTERS_QUERY_KEY,
      });
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }

  if (state === 'draft' || state === 'sign_in') return null;
  if (state === 'canceled' || state === 'closed') {
    return (
      <Text size="sm" tone="muted" data-registration-state={state}>
        {t(state)}
      </Text>
    );
  }
  const enrolled = state === 'registered' || state === 'waitlisted';
  return (
    <div className="grid gap-3" data-registration-state={state}>
      {state === 'registered' ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
          <CircleCheck aria-hidden className="size-4" />
          {t('youAreRegistered')}
        </p>
      ) : null}
      {state === 'waitlisted' ? (
        <p className="flex items-center gap-2 text-sm font-medium" role="status">
          <Hourglass aria-hidden className="size-4 text-muted" />
          <span>
            {t('position')}{' '}
            <AnimatedNumber
              value={kept.waitlistPosition ?? 1}
              format={(value) => format.number(value)}
              className="font-numeric tabular-nums"
            />
          </span>
        </p>
      ) : null}
      {enrolled ? null : (
        <Checkbox
          label={t('consent')}
          description={t('consentHint')}
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {enrolled ? (
        <AlertDialog
          trigger={
            <Button variant="outline" className="w-full sm:w-fit">
              <LabelSwap
                state={state}
                labels={{ registered: t('withdraw'), waitlisted: t('leaveWaitlist') }}
              />
            </Button>
          }
          title={state === 'registered' ? t('withdrawTitle') : t('leaveWaitlistTitle')}
          description={state === 'registered' && full ? t('withdrawFullBody') : t('withdrawBody')}
          confirmLabel={state === 'registered' ? t('withdraw') : t('leaveWaitlist')}
          tone="primary"
          onConfirm={withdraw}
        />
      ) : (
        <Button
          className="w-full sm:w-fit"
          loading={busy}
          loadingLabel={t('registering')}
          onClick={() => void register()}
        >
          <LabelSwap state={state} labels={{ open: t('register'), full: t('joinWaitlist') }} />
        </Button>
      )}
      {state === 'full' ? (
        <Text size="sm" tone="muted">
          {t('fullHint')}
        </Text>
      ) : null}
    </div>
  );
}
