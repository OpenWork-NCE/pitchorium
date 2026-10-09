'use client';

import { meControllerUpdateVisibility } from '@pitchorium/api-client';
import type { ProfileVisibility, VisibilityLevel } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, Heading, Switch, Text, ToggleGroup, notify, useAnnounce } from '@/components/ui';

type LevelKey = Exclude<keyof ProfileVisibility, 'publicPageEnabled'>;
const LEVELS: readonly LevelKey[] = ['entrepreneurDetails', 'contributorDetails', 'networkLists'];

/**
 * The levels of the contracts in their order, from the widest: every level is listed (a missing
 * key fails the typecheck), without loading the contracts and Zod in the page.
 */
const ORDER: Record<VisibilityLevel, number> = { public: 0, members: 1, private: 2 };
const VISIBILITY_LEVELS = (Object.keys(ORDER) as VisibilityLevel[]).sort(
  (a, b) => ORDER[a] - ORDER[b],
);

/**
 * Who sees the profile (§10.1, ADR 0029): the public page, then the details of each facet and
 * the network lists by level. Each change is sent at once, shown before the answer and put back
 * if the api refuses it.
 */
export function VisibilitySettings({ initial }: { initial: ProfileVisibility }) {
  const t = useTranslations('web.profile.privacy');
  const levels = useTranslations('reference.visibilityLevels');
  const announce = useAnnounce();
  const [visibility, setVisibility] = useState(initial);

  async function change(patch: Partial<ProfileVisibility>) {
    const previous = visibility;
    setVisibility({ ...visibility, ...patch });
    try {
      setVisibility((await meControllerUpdateVisibility(patch)).visibility);
      announce(t('saved'));
    } catch {
      setVisibility(previous);
      notify.error(t('failed'));
    }
  }

  return (
    <Card className="grid gap-4" aria-labelledby="visibility-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="visibility-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description')}
        </Text>
      </div>
      <Switch
        label={t('publicPage')}
        description={t('publicPageHint')}
        checked={visibility.publicPageEnabled}
        onCheckedChange={(checked) => void change({ publicPageEnabled: checked })}
      />
      <div className="grid gap-4">
        {LEVELS.map((key) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="text-sm font-medium" aria-hidden>
              {t(key)}
            </span>
            <ToggleGroup<VisibilityLevel>
              type="single"
              label={t(key)}
              value={visibility[key]}
              onValueChange={(level) => void change({ [key]: level })}
              options={VISIBILITY_LEVELS.map((level) => ({ value: level, label: levels(level) }))}
            />
          </div>
        ))}
      </div>
      <Text size="sm" tone="muted">
        {t('levelHint')}
      </Text>
    </Card>
  );
}
