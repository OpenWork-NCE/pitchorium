'use client';

import {
  ApiProblemError,
  privacyControllerCancelErasure,
  privacyControllerDownload,
  privacyControllerOverview,
  privacyControllerRequestErasure,
  privacyControllerRequestExport,
} from '@pitchorium/api-client';
import type { DataExport, ErasureBlockerView, PrivacyOverview } from '@pitchorium/contracts';
import { Download, FileArchive } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  Card,
  Heading,
  Text,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useSignOut } from '@/features/identity';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { REALTIME_EVENTS } from '@/lib/realtime/realtime-bus';
import { useRealtime } from '@/lib/realtime/use-realtime';

/** How often a scheduled erasure that is due is read again, until the account is gone. */
const DUE_POLL_MS = 5_000;

const problemCode = (error: unknown) =>
  error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR';

/**
 * « Données personnelles » (§13, GDPR articles 15, 17 and 20): the export of an archive, its state
 * and its download by a short link, the next possible request as the api tells it; the deletion
 * of the account, with what is deleted and what is kept, the blockers and the action each one
 * asks for, a recent sign-in and a typed phrase to confirm, the grace period, its cancellation
 * and its reminder. Once the account is erased, the member is signed out on this device and sees
 * a neutral page.
 */
export function PersonalDataSettings({
  initial,
  erase = false,
}: {
  initial: PrivacyOverview;
  /** Back from signing in again to confirm the deletion: the confirmation opens. */
  erase?: boolean;
}) {
  const t = useTranslations('web.privacy');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'long' });
  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'long', timeStyle: 'short' });
  const announce = useAnnounce();
  const signOut = useSignOut();
  const [overview, setOverview] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // The time of the reading, not of each render.
  const [now] = useState(() => Date.now());

  const read = useCallback(
    () =>
      privacyControllerOverview().then(
        (next) => setOverview(next),
        (failure: unknown) => {
          // The account is gone: the erasure ran (ADR 0164).
          if (failure instanceof ApiProblemError && failure.problem.status === 401) {
            void signOut(routes.accountDeleted);
          }
        },
      ),
    [signOut],
  );
  // The archive is ready: the api says it by a notification.
  useRealtime(REALTIME_EVENTS.notification, () => void read());
  const erasure = overview.erasure;
  const due =
    erasure !== null &&
    (erasure.status === 'running' ||
      (erasure.status === 'scheduled' && Date.parse(erasure.scheduledFor) <= now));
  useEffect(() => {
    if (!due) return;
    const timer = setInterval(() => void read(), DUE_POLL_MS);
    return () => clearInterval(timer);
  }, [due, read]);

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <Heading level={2} size="section">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('lede')}</Text>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <ExportSection
        overview={overview}
        date={date}
        dateTime={dateTime}
        onChange={read}
        onError={(failure) => setError(errors(problemCode(failure) as never))}
        announce={announce}
      />
      <ErasureSection
        overview={overview}
        date={date}
        now={now}
        erase={erase}
        onChange={() => {
          setError(null);
          void read();
        }}
        onError={(failure) => setError(errors(problemCode(failure) as never))}
        announce={announce}
      />
    </div>
  );
}

function ExportSection({
  overview,
  date,
  dateTime,
  onChange,
  onError,
  announce,
}: {
  overview: PrivacyOverview;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  onChange: () => Promise<void>;
  onError: (error: unknown) => void;
  announce: (message: string) => void;
}) {
  const t = useTranslations('web.privacy.export');
  const [requesting, setRequesting] = useState(false);
  const limited = overview.nextExportAt !== null;
  async function request() {
    setRequesting(true);
    try {
      await privacyControllerRequestExport();
      announce(t('requested'));
      await onChange();
    } catch (failure) {
      onError(failure);
    } finally {
      setRequesting(false);
    }
  }
  return (
    <Card className="grid gap-5 p-5 sm:p-6" aria-labelledby="export-title">
      <div className="grid gap-1">
        <Heading level={3} size="card" id="export-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('body')}
        </Text>
      </div>
      <div className="grid gap-2">
        <Button
          type="button"
          className="justify-self-start"
          loading={requesting}
          loadingLabel={t('requesting')}
          disabledReason={
            limited && overview.nextExportAt
              ? t('nextAt', { date: dateTime(overview.nextExportAt) })
              : undefined
          }
          onClick={() => void request()}
        >
          <FileArchive aria-hidden />
          {t('request')}
        </Button>
        {limited && overview.nextExportAt ? (
          <Text size="sm" tone="muted">
            {t('nextAt', { date: dateTime(overview.nextExportAt) })}
          </Text>
        ) : null}
      </div>
      <div className="grid gap-3">
        <Heading level={4} size="card" className="text-base">
          {t('historyTitle')}
        </Heading>
        {overview.exports.length === 0 ? (
          <Text size="sm" tone="muted">
            {t('empty')}
          </Text>
        ) : (
          <ul className="grid divide-y divide-border rounded-xl border border-border">
            {overview.exports.map((item) => (
              <ExportRow
                key={item.id}
                item={item}
                date={date}
                dateTime={dateTime}
                onError={onError}
                announce={announce}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function ExportRow({
  item,
  date,
  dateTime,
  onError,
  announce,
}: {
  item: DataExport;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  onError: (error: unknown) => void;
  announce: (message: string) => void;
}) {
  const t = useTranslations('web.privacy.export');
  const statuses = useTranslations('reference.exportStatuses');
  const format = useFormatter();
  const [preparing, setPreparing] = useState(false);
  async function download() {
    setPreparing(true);
    try {
      const link = await privacyControllerDownload(item.id);
      announce(t('downloadReady', { date: dateTime(link.expiresAt) }));
      window.location.assign(link.url);
    } catch (failure) {
      onError(failure);
    } finally {
      setPreparing(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="grid gap-0.5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t('requestedOn', { date: date(item.requestedAt) })}
          <Badge
            tone={
              item.status === 'ready' ? 'success' : item.status === 'failed' ? 'danger' : 'neutral'
            }
          >
            {statuses(item.status)}
          </Badge>
        </p>
        <Text size="sm" tone="muted">
          {item.status === 'ready' && item.expiresAt
            ? [
                t('readyUntil', { date: dateTime(item.expiresAt) }),
                ...(item.sizeBytes !== null
                  ? [
                      format.number(item.sizeBytes / 1_000_000, {
                        style: 'unit',
                        unit: 'megabyte',
                        maximumFractionDigits: 1,
                      }),
                    ]
                  : []),
              ].join(' · ')
            : item.status === 'failed'
              ? t('failed')
              : null}
        </Text>
      </div>
      {item.status === 'ready' ? (
        <Button
          type="button"
          variant="secondary"
          loading={preparing}
          loadingLabel={t('downloading')}
          onClick={() => void download()}
        >
          <Download aria-hidden />
          {t('download')}
        </Button>
      ) : null}
    </li>
  );
}

function ErasureSection({
  overview,
  date,
  now,
  erase,
  onChange,
  onError,
  announce,
}: {
  overview: PrivacyOverview;
  date: (iso: string) => string;
  now: number;
  erase: boolean;
  onChange: () => void;
  onError: (error: unknown) => void;
  announce: (message: string) => void;
}) {
  const t = useTranslations('web.privacy.erasure');
  const errors = useTranslations('errors');
  const locale = useLocale();
  const [stale, setStale] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirming, setConfirming] = useState(erase);
  const { erasure, erasureBlockers } = overview;
  const scheduled =
    erasure !== null && (erasure.status === 'scheduled' || erasure.status === 'blocked');

  async function schedule() {
    try {
      await privacyControllerRequestErasure({ confirm: true });
      announce(t('scheduled'));
      onChange();
    } catch (failure) {
      if (problemCode(failure) === 'ACCESS_REAUTHENTICATION_REQUIRED') setStale(true);
      else onError(failure);
    }
  }

  async function cancel() {
    setCanceling(true);
    try {
      await privacyControllerCancelErasure();
      announce(t('canceled'));
      onChange();
    } catch (failure) {
      onError(failure);
    } finally {
      setCanceling(false);
    }
  }

  return (
    <Card className="grid gap-5 p-5 sm:p-6" aria-labelledby="erasure-title">
      <div className="grid gap-1">
        <Heading level={3} size="card" id="erasure-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('body')}
        </Text>
      </div>
      {erasure?.status === 'running' ? (
        <Alert tone="info">{t('running')}</Alert>
      ) : scheduled && erasure ? (
        <div className="grid gap-3">
          <Alert tone="warning" title={t('scheduledTitle', { date: date(erasure.scheduledFor) })}>
            <span className="grid gap-1">
              <span>{t('scheduledBody')}</span>
              {erasure.reminderAt ? (
                <span>
                  {Date.parse(erasure.reminderAt) <= now
                    ? t('reminderSent', { date: date(erasure.reminderAt) })
                    : t('reminder', { date: date(erasure.reminderAt) })}
                </span>
              ) : null}
              {erasure.status === 'blocked' && erasure.blockedBy ? (
                <span>{t('postponed', { reason: errors(erasure.blockedBy as never) })}</span>
              ) : null}
            </span>
          </Alert>
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            loading={canceling}
            loadingLabel={t('canceling')}
            onClick={() => void cancel()}
          >
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <>
          <WhatHappens />
          {erasureBlockers.length > 0 ? (
            <Blockers blockers={erasureBlockers} />
          ) : (
            <div className="grid gap-3">
              {stale ? (
                <Alert tone="warning" title={t('staleTitle')}>
                  <span className="grid gap-2">
                    <span>{t('staleBody')}</span>
                    <Link
                      href={withRedirect(
                        routes.signIn,
                        `/${locale}${routes.settingsPersonalData}?erase=1`,
                      )}
                      className="link-underline-hover font-medium text-accent"
                    >
                      {t('staleAction')}
                    </Link>
                  </span>
                </Alert>
              ) : null}
              <AlertDialog
                trigger={
                  <Button variant="danger" className="justify-self-start">
                    {t('action')}
                  </Button>
                }
                open={confirming}
                onOpenChange={setConfirming}
                title={t('confirmTitle')}
                description={t('confirmDescription')}
                confirmLabel={t('confirm')}
                confirmPhrase={t('phrase')}
                onConfirm={schedule}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function WhatHappens() {
  const t = useTranslations('web.privacy.erasure');
  return (
    <div className="grid gap-2 text-sm">
      <Heading level={4} size="card" className="text-base">
        {t('whatTitle')}
      </Heading>
      <ul className="grid list-disc gap-1.5 ps-5">
        <li>{t('deleted')}</li>
        <li>{t('pseudonymized')}</li>
        <li>{t('legal')}</li>
      </ul>
    </div>
  );
}

function Blockers({ blockers }: { blockers: ErasureBlockerView[] }) {
  const t = useTranslations('web.privacy.erasure');
  return (
    <Alert tone="warning" title={t('blockedTitle')}>
      <ul className="grid gap-2">
        {blockers.map((blocker) => (
          <li key={`${blocker.code}:${blocker.resource.slug}`} className="grid gap-1">
            <span>{t(`blockers.${blocker.code}`, { name: blocker.resource.name })}</span>
            <Link
              href={
                blocker.resource.type === 'project'
                  ? routes.project(blocker.resource.slug)
                  : `${routes.organizationManage(blocker.resource.slug)}?tab=members`
              }
              className="justify-self-start link-underline-hover font-medium text-accent"
            >
              {t(`blockerActions.${blocker.code}`)}
            </Link>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
