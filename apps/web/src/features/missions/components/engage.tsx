'use client';

import { missionsControllerEngage, useProjectsControllerMine } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Button,
  DeferredSelect,
  Dialog,
  DialogContent,
  Field,
  FormActions,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { engageVerb } from '../lib/engagement-actions';
import { MISSION_MESSAGE_MAX_LENGTH } from '../lib/limits';
import { useMissionProblem } from './use-mission-problem';

const NONE = 'none';

/**
 * Taking part in a mission (ADR 0071): applying to a request (the member gives their time) or
 * soliciting an offer (the member is helped, for themselves or a project of their team), with a
 * message. The api says who may; a refusal is explained.
 */
export function Engage({
  missionId,
  direction,
  canEngage,
}: {
  missionId: string;
  direction: 'offer' | 'request';
  canEngage: boolean;
}) {
  const t = useTranslations('web.missions.engage');
  const verb = engageVerb(direction);
  const router = useRouter();
  const announce = useAnnounce();
  const withPrerequisites = useWithPrerequisites();
  const problem = useMissionProblem();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [project, setProject] = useState(NONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projects = useProjectsControllerMine({ query: { enabled: open && verb === 'solicit' } });

  async function send() {
    if (!message.trim()) {
      setError(t('messageRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const engagement = await withPrerequisites(() =>
        missionsControllerEngage(missionId, {
          message: message.trim(),
          projectId: project === NONE ? null : project,
        }),
      );
      announce(t(`${verb}Sent`));
      setOpen(false);
      router.push(routes.missionEngagement(engagement.id));
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Text size="sm" tone="muted">
        {t(`${verb}Hint`)}
      </Text>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-fit">
          {t(verb)}
        </Button>
        <DialogContent title={t(`${verb}Title`)} description={t('volunteer')} size="md">
          <form
            className="grid gap-5"
            onSubmit={(submit) => {
              submit.preventDefault();
              void send();
            }}
          >
            {verb === 'solicit' && (projects.data?.items.length ?? 0) > 0 ? (
              <Field label={t('forProject')} optional>
                <DeferredSelect
                  value={project}
                  onValueChange={setProject}
                  options={[
                    { value: NONE, label: t('forMyself') },
                    ...(projects.data?.items ?? []).map(({ project: item }) => ({
                      value: item.id,
                      label: item.title,
                    })),
                  ]}
                />
              </Field>
            ) : null}
            <Field
              label={t('message')}
              description={t(`${verb}MessageHint`)}
              error={error ?? undefined}
            >
              <Textarea
                value={message}
                onChange={(change) => setMessage(change.target.value)}
                maxLength={MISSION_MESSAGE_MAX_LENGTH}
                rows={5}
              />
            </Field>
            <FormActions>
              <Button type="submit" loading={busy} loadingLabel={t('sending')}>
                {t('send')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
      {!canEngage ? (
        <Text size="xs" tone="muted">
          {t('mayNeed')}
        </Text>
      ) : null}
    </div>
  );
}
