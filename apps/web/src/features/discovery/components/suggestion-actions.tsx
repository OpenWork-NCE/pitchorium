'use client';

import {
  ApiProblemError,
  connectionsControllerRequest,
  discoveryControllerDismiss,
  discoveryControllerUndoDismissal,
  followsControllerFollow,
} from '@pitchorium/api-client';
import type { DiscoveryCard } from '@pitchorium/contracts';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, notify } from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';

/**
 * The action of a suggestion (§10.2, ADR 0067): « Se connecter » for a person (a connection
 * request, its prerequisites completed in place), « Suivre » for an organization or a project;
 * and « Pas intéressé », done at once and undone from its toast.
 */
export function SuggestionActions({
  candidate,
  onDismissed,
  onRestored,
}: {
  candidate: DiscoveryCard;
  onDismissed: () => void;
  onRestored: () => void;
}) {
  const t = useTranslations('web.discovery.suggestion');
  const errors = useTranslations('errors');
  const withPrerequisites = useWithPrerequisites();
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const connects = candidate.kind === 'person';

  const fail = (error: unknown) => {
    const code = error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR';
    notify.error(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'));
  };

  async function act() {
    setState('pending');
    try {
      await withPrerequisites<unknown>(() =>
        connects
          ? connectionsControllerRequest({ handle: candidate.key })
          : followsControllerFollow(candidate.kind, candidate.key),
      );
      setState('done');
    } catch (error) {
      setState('idle');
      fail(error);
    }
  }

  async function dismiss() {
    onDismissed();
    try {
      await discoveryControllerDismiss({ kind: candidate.kind, key: candidate.key });
      notify.undoable(t('dismissed'), {
        label: t('undo'),
        onUndo: () => {
          onRestored();
          void discoveryControllerUndoDismissal(candidate.kind, candidate.key).catch(fail);
        },
      });
    } catch (error) {
      onRestored();
      fail(error);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {state === 'done' ? (
        <span
          role="status"
          className="inline-flex items-center gap-1 text-xs font-medium text-success"
        >
          <Check aria-hidden className="size-3.5" />
          {t(connects ? 'requested' : 'following')}
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          loading={state === 'pending'}
          loadingLabel={t('sending')}
          aria-label={t(connects ? 'connectWith' : 'followName', { name: candidate.title })}
          onClick={() => void act()}
        >
          {t(connects ? 'connect' : 'follow')}
        </Button>
      )}
      <Button
        size="sm"
        variant="link"
        className="min-h-6 text-xs text-muted"
        aria-label={t('dismissName', { name: candidate.title })}
        onClick={() => void dismiss()}
      >
        {t('dismiss')}
      </Button>
    </div>
  );
}
