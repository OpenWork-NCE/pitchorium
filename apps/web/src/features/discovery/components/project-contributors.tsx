'use client';

import {
  ApiProblemError,
  connectionsControllerRequest,
  discoveryControllerProjectContributors,
} from '@pitchorium/api-client';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  notify,
  Skeleton,
  Text,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { IntroduceButton, MessageButton } from '@/features/messaging';
import { SuggestionItem } from './suggestion-item';
import { useSuggestionReason } from './use-suggestion-reason';

/** « Se connecter » with a member suggested to the team, said once sent. */
function ConnectAction({ handle }: { handle: string }) {
  const t = useTranslations('web.discovery.contributors');
  const errors = useTranslations('errors');
  const withPrerequisites = useWithPrerequisites();
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  if (state === 'done') {
    return (
      <Text size="xs" role="status" className="font-medium text-success">
        {t('requested')}
      </Text>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      loading={state === 'pending'}
      loadingLabel={t('connecting')}
      onClick={() => {
        setState('pending');
        void withPrerequisites(() => connectionsControllerRequest({ handle }))
          .then(() => setState('done'))
          .catch((error: unknown) => {
            setState('idle');
            const code = error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR';
            notify.error(
              errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR'),
            );
          });
      }}
    >
      {t('connect')}
    </Button>
  );
}

/**
 * « Contributeurs potentiels » of a project (§11.4, ADR 0067), for its team only (the api answers
 * nobody else): the members the matching proposes, each with the reason why, then « Se
 * connecter », « Présenter à… » and « Message ».
 */
export function ProjectContributors({ projectId }: { projectId: string }) {
  const t = useTranslations('web.discovery.contributors');
  const reason = useSuggestionReason();
  const list = useQuery({
    queryKey: ['discovery', 'project-contributors', projectId],
    queryFn: ({ signal }) =>
      discoveryControllerProjectContributors(projectId, { limit: 20 }, { signal }),
    staleTime: 60_000,
  });
  return (
    <section aria-labelledby="project-contributors" className="grid gap-4">
      <div className="grid gap-1">
        <Heading level={2} size="section" id="project-contributors">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description')}
        </Text>
      </div>
      {list.isPending ? (
        <Loading className="grid gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </Loading>
      ) : list.isError ? (
        <ErrorState
          title={t('error')}
          headingLevel={3}
          retrying={list.isRefetching}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          size="inline"
          headingLevel={3}
          icon={<Users />}
          title={t('none')}
          description={t('noneHint')}
        />
      ) : (
        <ul className="grid gap-5">
          {list.data.items.flatMap((suggestion) =>
            suggestion.candidate.kind === 'person'
              ? [
                  <SuggestionItem
                    key={suggestion.candidate.key}
                    person={suggestion.candidate}
                    reason={reason(suggestion.sentence)}
                    actions={
                      <div className="flex flex-wrap gap-2">
                        <ConnectAction handle={suggestion.candidate.key} />
                        <IntroduceButton
                          member={{
                            handle: suggestion.candidate.key,
                            displayName: suggestion.candidate.title,
                            headline: suggestion.candidate.subtitle,
                            avatarUrl: suggestion.candidate.imageUrl,
                          }}
                        />
                        <MessageButton handle={suggestion.candidate.key} variant="outline" />
                      </div>
                    }
                  />,
                ]
              : [],
          )}
        </ul>
      )}
    </section>
  );
}
