'use client';

import type { FollowState } from '@pitchorium/contracts';
import { HandCoins } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui';
import { FollowButton } from '@/features/network';

const InterestDialog = lazy(() => import('./interest-dialog'));

/**
 * What a member does on the page of a project (§11.2): follow it, its updates then reaching their
 * feed, and express an interest (grant, honour loan, stake, contact). « Contribuer » and
 * « Contacter » come with their prompts (FRONT 5B and 6).
 */
export function MemberActions({
  project,
  follow,
  layout = 'stack',
}: {
  project: { id: string; title: string };
  follow: FollowState;
  /** `stack` in the funding block, `bar` in the action bar of a phone. */
  layout?: 'stack' | 'bar';
}) {
  const t = useTranslations('web.projects.actions');
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <div
      className={
        layout === 'bar'
          ? 'flex w-full flex-wrap items-center justify-between gap-2'
          : 'grid gap-2 sm:flex sm:flex-wrap'
      }
    >
      <FollowButton type="project" targetKey={project.id} name={project.title} initial={follow} />
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setOpened(true);
          setOpen(true);
        }}
      >
        <HandCoins aria-hidden />
        {t('interest')}
      </Button>
      {opened ? (
        <Suspense fallback={null}>
          <InterestDialog
            projectId={project.id}
            projectTitle={project.title}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
