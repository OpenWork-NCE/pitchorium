'use client';

import type { ProfileElement, ProfileStrength as Strength } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { Button, Card, Heading, Progress } from '@/components/ui';
import { type ProfileSection, useOpenEditor } from './profile-editor';

/** The part of the profile where each missing element is filled. */
const SECTION_OF: Record<Exclude<ProfileElement, 'facet'>, ProfileSection> = {
  avatar: 'photo',
  display_name: 'intro',
  headline: 'intro',
  location: 'intro',
  bio: 'about',
  languages: 'intro',
  links: 'intro',
  cover: 'cover',
  intention: 'intention',
};

/**
 * Strength of the profile of its owner (§7.2: « on encourage, on ne bloque pas »): the level and
 * the share computed by the api, the bar gliding to it after each save, then each missing
 * element, heaviest first, as a direct way to the part where it is filled.
 */
export function ProfileStrengthCard({ strength }: { strength: Strength }) {
  const t = useTranslations('web.profile.strength');
  const elements = useTranslations('reference.profileElements');
  const levels = useTranslations('reference.profileStrengthLevels');
  const open = useOpenEditor();
  const percent = t('percent', { percent: strength.percent });
  return (
    <Card padding="sm" className="grid gap-3" data-profile-strength="">
      <div className="flex items-baseline justify-between gap-3">
        <Heading level={2} size="label">
          {t('title')}
        </Heading>
        <span className="text-sm font-medium">{levels(strength.level)}</span>
      </div>
      <Progress value={strength.percent} label={t('title')} valueText={percent} size="sm" />
      {strength.missing.length > 0 ? (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted">{t('missing')}</p>
          <ul className="flex flex-wrap gap-1.5">
            {strength.missing.map((element) =>
              element === 'facet' ? (
                <li key={element} className="contents">
                  <Button size="sm" variant="outline" onClick={() => open('entrepreneur')}>
                    {t('facets.entrepreneur')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => open('contributor')}>
                    {t('facets.contributor')}
                  </Button>
                </li>
              ) : (
                <li key={element}>
                  <Button size="sm" variant="outline" onClick={() => open(SECTION_OF[element])}>
                    {elements(element)}
                  </Button>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-success">{t('complete')}</p>
      )}
    </Card>
  );
}
