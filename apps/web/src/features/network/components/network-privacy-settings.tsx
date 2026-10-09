'use client';

import {
  blocksControllerList,
  blocksControllerUnblock,
  profileViewsControllerUpdateSettings,
} from '@pitchorium/api-client';
import type { Block, NetworkSettings } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Button,
  Card,
  Heading,
  Switch,
  Text,
  notify,
  useAnnounce,
} from '@/components/ui';
import { CursorList, useCursorList } from './cursor-list';
import { useProblemMessage } from './use-relationship';

/**
 * The network part of « Confidentialité et réseau » (§10.2): private visits, applied at once and
 * put back if refused, then the blocked members, each unblocked after a confirmation that says
 * what does not come back.
 */
export function NetworkPrivacySettings({ initial }: { initial: NetworkSettings }) {
  const t = useTranslations('web.network.privacy');
  const format = useFormatter();
  const announce = useAnnounce();
  const message = useProblemMessage();
  const [settings, setSettings] = useState(initial);
  const blocks = useCursorList<Block>(['blocks'], (params) => blocksControllerList(params));

  async function setPrivate(privateProfileViews: boolean) {
    const previous = settings;
    setSettings({ ...settings, privateProfileViews });
    try {
      setSettings(await profileViewsControllerUpdateSettings({ privateProfileViews }));
      announce(t('saved'));
    } catch {
      setSettings(previous);
      notify.error(t('failed'));
    }
  }

  return (
    <>
      <Card className="grid gap-4" aria-labelledby="visits-title">
        <Heading level={2} size="card" id="visits-title">
          {t('title')}
        </Heading>
        <Switch
          label={t('privateVisits')}
          description={t('privateVisitsHint')}
          checked={settings.privateProfileViews}
          onCheckedChange={(checked) => void setPrivate(checked)}
        />
      </Card>
      <Card className="grid gap-4" aria-labelledby="blocked-title" id="blocked">
        <div className="grid gap-1">
          <Heading level={2} size="card" id="blocked-title">
            {t('blocked')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('blockedHint')}
          </Text>
        </div>
        <CursorList
          list={blocks}
          label={t('blocked')}
          empty={{ title: t('noBlocked') }}
          renderItem={({ member, blockedAt }) => (
            <li key={member.handle} className="flex flex-wrap items-center gap-3 py-2">
              <Avatar name={member.displayName} src={member.avatarUrl} size="md" decorative />
              <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
                <span className="font-medium">{member.displayName}</span>
                <span className="text-xs text-muted">
                  {t('blockedSince', {
                    date: format.dateTime(new Date(blockedAt), { dateStyle: 'medium' }),
                  })}
                </span>
              </div>
              <AlertDialog
                trigger={
                  <Button size="sm" variant="outline">
                    {t('unblock')}
                  </Button>
                }
                title={t('unblockTitle', { name: member.displayName })}
                description={t('unblockDescription', { name: member.displayName })}
                confirmLabel={t('unblock')}
                tone="primary"
                onConfirm={async () => {
                  try {
                    await blocks.remove(
                      (item) => item.member.handle === member.handle,
                      () => blocksControllerUnblock(member.handle),
                    );
                    announce(t('unblocked', { name: member.displayName }));
                  } catch (error) {
                    notify.error(message(error));
                  }
                }}
              />
            </li>
          )}
        />
      </Card>
    </>
  );
}
