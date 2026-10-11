'use client';

import {
  eventsControllerRevokeCalendar,
  eventsControllerRotateCalendar,
} from '@pitchorium/api-client';
import { CalendarSync, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  CopyButton,
  Field,
  Heading,
  Input,
  Text,
  useAnnounce,
} from '@/components/ui';
import { useEventProblem } from './use-event-problem';

const APPS = ['google', 'apple', 'outlook'] as const;

/**
 * The personal calendar of the member (§14, ADR 0153): an address of the events they are
 * registered to, for Google Agenda, Apple Calendrier or Outlook. The api keeps only its hash: the
 * address is shown once, when it is created or replaced, with the warning that it is secret; a
 * new one replaces the former, and a revocation stops it. The api does not tell whether one
 * exists: both actions stay available.
 */
export function CalendarSettings() {
  const t = useTranslations('web.events.calendar');
  const announce = useAnnounce();
  const problem = useEventProblem();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      const feed = await eventsControllerRotateCalendar();
      setUrl(feed.url);
      setRevoked(false);
      announce(t('created'));
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="grid gap-4" aria-labelledby="calendar-feed">
        <div className="grid gap-1">
          <Heading level={2} size="card" id="calendar-feed">
            {t('title')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('description')}
          </Text>
        </div>
        {url ? (
          <div className="grid gap-3" data-calendar-url="">
            <Alert tone="warning" title={t('secretTitle')}>
              {t('secret')}
            </Alert>
            <Field label={t('address')}>
              <Input value={url} readOnly onFocus={(focus) => focus.currentTarget.select()} />
            </Field>
            <CopyButton value={url} label={t('copy')} copiedLabel={t('copied')} />
          </div>
        ) : null}
        {revoked ? (
          <Text size="sm" role="status">
            {t('revoked')}
          </Text>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {url ? (
            <AlertDialog
              trigger={
                <Button variant="outline">
                  <CalendarSync aria-hidden />
                  {t('regenerate')}
                </Button>
              }
              title={t('regenerateTitle')}
              description={t('regenerateBody')}
              confirmLabel={t('regenerate')}
              tone="primary"
              onConfirm={rotate}
            />
          ) : (
            <Button loading={busy} loadingLabel={t('creating')} onClick={() => void rotate()}>
              <CalendarSync aria-hidden />
              {t('create')}
            </Button>
          )}
          <AlertDialog
            trigger={
              <Button variant="ghost">
                <TriangleAlert aria-hidden />
                {t('revoke')}
              </Button>
            }
            title={t('revokeTitle')}
            description={t('revokeBody')}
            confirmLabel={t('revoke')}
            onConfirm={async () => {
              setError(null);
              try {
                await eventsControllerRevokeCalendar();
                setUrl(null);
                setRevoked(true);
                announce(t('revoked'));
              } catch (failure) {
                setError(problem(failure));
              }
            }}
          />
        </div>
      </Card>
      <Card className="grid gap-4" aria-labelledby="calendar-howto">
        <Heading level={2} size="card" id="calendar-howto">
          {t('howTo')}
        </Heading>
        <ol className="grid gap-4">
          {APPS.map((app) => (
            <li key={app} className="grid gap-1">
              <Heading level={3} size="card" className="text-base">
                {t(`apps.${app}.name`)}
              </Heading>
              <Text size="sm" tone="muted">
                {t(`apps.${app}.steps`)}
              </Text>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
