'use client';

import type { FollowState } from '@pitchorium/contracts';
import { HandCoins } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui';
import { MessageButton } from '@/features/messaging';
import { FollowButton } from '@/features/network';

const InterestDialog = lazy(() => import('./interest-dialog'));

/**
 * What a member does on the page of a project (§11.2): follow it, its updates then reaching their
 * feed, and express an interest (grant, honour loan, stake, contact). The interest also opens from
 * the address (`?interest=1`), where the journey of a contribution sends an instrument that is
 * never paid online (§9.1). « Contacter » opens a conversation with its owner (§10.4).
 */
export function MemberActions({
  project,
  follow,
  layout = 'stack',
  contact = null,
}: {
  project: { id: string; title: string };
  follow: FollowState;
  /** Handle of the owner to contact, in the funding block; none for the team. */
  contact?: string | null;
  /** `stack` in the funding block, `bar` in the action bar of a phone. */
  layout?: 'stack' | 'bar';
}) {
  const t = useTranslations('web.projects.actions');
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  // Asked from the address (one instance only: the block of the page); closing it leaves the
  // address without the parameter.
  const asked = layout === 'stack' && params.get('interest') !== null;
  function change(next: boolean) {
    setOpen(next);
    if (next || !asked) return;
    const query = new URLSearchParams(params.toString());
    query.delete('interest');
    const rest = query.toString();
    router.replace(`${window.location.pathname}${rest ? `?${rest}` : ''}`, { scroll: false });
  }
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
      {contact && layout === 'stack' ? (
        <MessageButton handle={contact} variant="outline" label={t('contact')} />
      ) : null}
      {opened || asked ? (
        <Suspense fallback={null}>
          <InterestDialog
            projectId={project.id}
            projectTitle={project.title}
            open={open || asked}
            onOpenChange={change}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
