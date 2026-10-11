'use client';

import {
  messagingControllerUpdateSettings,
  notificationsControllerUpdatePreferences,
} from '@pitchorium/api-client';
import type { MessagePolicy, MessagingSettings as Settings } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
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
import * as routes from '@/config/paths';
import { useMessagingProblem } from '../hooks/use-messaging-problem';

const POLICIES = [
  'connections_only',
  'connections_and_second_degree',
  'verified_members',
] as const satisfies readonly MessagePolicy[];

/**
 * « Messagerie » of the settings (§10.4): who may write to the member out of their network (a
 * first message then waits as a request), applied at once and put back if refused; and the copy
 * by email of the messages left unread, which is the email channel of the type « message » in the
 * preferences of the notifications.
 */
export function MessagingSettings({
  initial,
  unreadCopy,
}: {
  initial: Settings;
  /** The email of the type « message » is on (copy of unread messages). */
  unreadCopy: boolean;
}) {
  const t = useTranslations('web.messaging.settings');
  const announce = useAnnounce();
  const problem = useMessagingProblem();
  const [policy, setPolicy] = useState<MessagePolicy>(initial.messagePolicy);
  const [copy, setCopy] = useState(unreadCopy);

  async function choose(next: MessagePolicy) {
    const previous = policy;
    setPolicy(next);
    try {
      await messagingControllerUpdateSettings({ messagePolicy: next });
      announce(t('saved'));
    } catch (error) {
      setPolicy(previous);
      notify.error(problem(error));
    }
  }

  async function toggleCopy(enabled: boolean) {
    setCopy(enabled);
    try {
      await notificationsControllerUpdatePreferences({
        changes: [{ type: 'message', channel: 'email', enabled }],
      });
      announce(t('saved'));
    } catch (error) {
      setCopy(!enabled);
      notify.error(problem(error));
    }
  }

  return (
    <>
      <Card className="grid gap-4" aria-labelledby="message-policy-title">
        <div className="grid gap-1">
          <Heading level={2} size="card" id="message-policy-title">
            {t('policyTitle')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('policyHint')}
          </Text>
        </div>
        <Field label={t('policyLabel')} hideLabel>
          <RadioGroup
            value={policy}
            onValueChange={(next) => void choose(next)}
            variant="card"
            options={POLICIES.map((value) => ({
              value,
              label: t(`policies.${value}.label`),
              description: t(`policies.${value}.description`),
            }))}
          />
        </Field>
      </Card>
      <Card className="grid gap-4" aria-labelledby="unread-copy-title">
        <Heading level={2} size="card" id="unread-copy-title">
          {t('emailTitle')}
        </Heading>
        <Switch
          label={t('unreadCopy')}
          description={t('unreadCopyHint')}
          checked={copy}
          onCheckedChange={(checked) => void toggleCopy(checked)}
        />
        <Text size="sm" tone="muted">
          {t.rich('allNotifications', {
            link: (chunks) => <Link href={routes.settingsNotifications}>{chunks}</Link>,
          })}
        </Text>
      </Card>
    </>
  );
}
