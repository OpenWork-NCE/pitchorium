'use client';

import { notificationsControllerUpdatePreferences } from '@pitchorium/api-client';
import type {
  EmailDigest,
  NotificationChannel,
  NotificationPreferences,
  NotificationType,
} from '@pitchorium/contracts';
import { Lock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Card,
  Field,
  Heading,
  Link,
  notify,
  RadioGroup,
  Switch,
  Text,
  useAnnounce,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { cn } from '@/lib/cn';
import { sectionsOf } from '../lib/sections';

const CHANNELS = ['in_app', 'email'] as const satisfies readonly NotificationChannel[];
const DIGESTS = ['off', 'daily', 'weekly'] as const satisfies readonly EmailDigest[];

/**
 * The preferences of the notifications (§10.5, ADR 0060, ADR 0061): the rhythm of the emails (one
 * email each time, a daily or a weekly digest, at the hour and on the day the api gives in the
 * time zone of the member), then a grid by type and by channel, each change applied at once and
 * put back if refused. A transactional type (security, payments, identity check, legal terms)
 * stays on, locked, with the reason.
 */
export function NotificationSettings({ initial }: { initial: NotificationPreferences }) {
  const t = useTranslations('web.notifications.settings');
  const types = useTranslations('reference.notificationTypes');
  const channels = useTranslations('reference.notificationChannels');
  const digests = useTranslations('reference.emailDigests');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const announce = useAnnounce();
  const [preferences, setPreferences] = useState(initial);

  async function save(change: Parameters<typeof notificationsControllerUpdatePreferences>[0]) {
    const previous = preferences;
    try {
      setPreferences(await notificationsControllerUpdatePreferences(change));
      announce(t('saved'));
    } catch {
      setPreferences(previous);
      notify.error(errors('INTERNAL_ERROR'));
    }
  }

  function toggle(type: NotificationType, channel: NotificationChannel, enabled: boolean) {
    setPreferences((current) => ({
      ...current,
      types: current.types.map((item) =>
        item.type === type ? { ...item, channels: { ...item.channels, [channel]: enabled } } : item,
      ),
    }));
    void save({ changes: [{ type, channel, enabled }] });
  }

  function chooseDigest(emailDigest: EmailDigest) {
    setPreferences((current) => ({ ...current, emailDigest }));
    void save({ emailDigest });
  }

  const { hour, weeklyDay, timeZone } = preferences.digestSchedule;
  const at = format.dateTime(new Date(Date.UTC(2026, 0, 5, hour)), {
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  return (
    <div className="grid gap-6">
      <Card className="grid gap-4" aria-labelledby="email-rhythm-title">
        <div className="grid gap-1">
          <Heading level={2} size="card" id="email-rhythm-title">
            {t('rhythmTitle')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('rhythmHint')}
          </Text>
        </div>
        <Field label={t('rhythmTitle')} hideLabel>
          <RadioGroup
            value={preferences.emailDigest}
            onValueChange={(next) => chooseDigest(next)}
            variant="card"
            options={DIGESTS.map((value) => ({
              value,
              label: digests(value),
              description:
                value === 'off'
                  ? t('immediate')
                  : value === 'daily'
                    ? t('daily', { time: at })
                    : t('weekly', { time: at, day: t(`weekdays.${weeklyDay}`) }),
            }))}
          />
        </Field>
        <Text size="sm" tone="muted">
          {t.rich('timeZone', {
            zone: timeZone,
            link: (chunks) => <Link href={routes.settingsPreferences}>{chunks}</Link>,
          })}
        </Text>
      </Card>

      {sectionsOf(preferences.types).map(({ section, types: items }) => (
        <Card key={section} className="grid gap-3" aria-labelledby={`notifications-${section}`}>
          <Heading level={2} size="card" id={`notifications-${section}`}>
            {t(`sections.${section}`)}
          </Heading>
          <table className="w-full text-sm">
            <caption className="sr-only">{t(`sections.${section}`)}</caption>
            <thead className="max-sm:hidden">
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-2 font-medium">
                  {t('type')}
                </th>
                {CHANNELS.map((channel) => (
                  <th key={channel} scope="col" className="w-28 py-2 text-center font-medium">
                    {channels(channel)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.type}
                  className="border-t border-border max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:py-2"
                >
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-normal max-sm:col-span-2 max-sm:pb-1"
                  >
                    <span className="font-medium text-foreground">{types(item.type)}</span>
                    {item.transactional ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <Lock aria-hidden className="size-3.5" />
                        {t('locked')}
                      </span>
                    ) : null}
                  </th>
                  {CHANNELS.map((channel) => (
                    <td key={channel} className={cn('py-2 sm:text-center')}>
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="text-xs text-muted sm:hidden">
                          {channels(channel)}
                        </span>
                        <Switch
                          aria-label={t('switch', {
                            type: types(item.type),
                            channel: channels(channel),
                          })}
                          checked={item.channels[channel]}
                          disabled={item.transactional}
                          onCheckedChange={(checked) => toggle(item.type, channel, checked)}
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
      <Text size="sm" tone="muted">
        {t('lockedHint')}
      </Text>
    </div>
  );
}
