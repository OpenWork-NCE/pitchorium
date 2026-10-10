'use client';

import {
  getProjectsControllerPreviewQueryKey,
  teamControllerInvite,
  teamControllerLeave,
  teamControllerRemove,
  teamControllerUpdate,
  useProjectsControllerPreview,
} from '@pitchorium/api-client';
import type { ProjectTeamMember, ProjectTeamRole } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DeferredSelect,
  Field,
  FormActions,
  Heading,
  Input,
  Loading,
  Skeleton,
  Text,
  useAnnounce,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useCurrentMember } from '@/features/identity';
import { useRouter } from '@/i18n/navigation';
import { PROJECT_LIMITS } from '../../lib/limits';
import { useProblemText } from '../shared/use-problem-text';
import { useProjectEditor } from './editor-context';

const ROLES: readonly ProjectTeamRole[] = ['owner', 'editor'];

/**
 * The team of a project (§11.2, ADR 0040): its active members with their role and their function,
 * the invitations waiting for an answer, an invitation by the handle of a member (owners only),
 * the change of a role, a departure. The rule of the last owner is said before it is met: a
 * project never stays without one. Used by the assistant and by the management.
 */
export function TeamPanel() {
  const t = useTranslations('web.projects.editor.team');
  const { project, refresh } = useProjectEditor();
  const me = useCurrentMember().profile.handle;
  const queryClient = useQueryClient();
  // The preview lists every active member, consent or not; the page, those who consented.
  const preview = useProjectsControllerPreview(project.id, { query: { staleTime: 0 } });
  const owner = project.management?.viewerRole === 'owner';
  const members = preview.data?.team ?? [];
  const owners = members.filter((member) => member.role === 'owner').length;
  const reload = async () => {
    await queryClient.invalidateQueries({
      queryKey: getProjectsControllerPreviewQueryKey(project.id),
    });
    await refresh();
  };
  return (
    <div className="grid gap-8">
      <Callout title={t('consentTitle')}>{t('consentBody')}</Callout>
      <section aria-labelledby="team-members-title" className="grid gap-4">
        <Heading level={2} size="card" id="team-members-title">
          {t('members')}
        </Heading>
        {preview.isPending ? (
          <Loading className="grid gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </Loading>
        ) : (
          <ul className="grid gap-3">
            {members.map((member) => (
              <MemberRow
                key={member.member.handle}
                member={member}
                self={member.member.handle === me}
                canManage={owner}
                lastOwner={member.role === 'owner' && owners <= 1}
                onChanged={reload}
              />
            ))}
          </ul>
        )}
        {owners <= 1 ? (
          <Text size="sm" tone="muted">
            {t('lastOwnerRule')}
          </Text>
        ) : null}
      </section>
      {(project.management?.invitations.length ?? 0) > 0 ? (
        <section aria-labelledby="team-invitations-title" className="grid gap-4">
          <Heading level={2} size="card" id="team-invitations-title">
            {t('invitations')}
          </Heading>
          <ul className="grid gap-3">
            {project.management?.invitations.map((invitation) => (
              <MemberRow
                key={invitation.member.handle}
                member={invitation}
                pending
                self={false}
                canManage={owner}
                lastOwner={false}
                onChanged={reload}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {owner ? <InviteForm onInvited={reload} /> : null}
    </div>
  );
}

function MemberRow({
  member,
  self,
  pending = false,
  canManage,
  lastOwner,
  onChanged,
}: {
  member: ProjectTeamMember;
  self: boolean;
  pending?: boolean;
  canManage: boolean;
  lastOwner: boolean;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations('web.projects.editor.team');
  const roles = useTranslations('reference.projectTeamRoles');
  const { project } = useProjectEditor();
  const problemText = useProblemText();
  const announce = useAnnounce();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const handle = member.member.handle;
  const run = async (action: () => Promise<void>, done: string) => {
    setProblem(null);
    try {
      await action();
      announce(done);
      await onChanged();
    } catch (error) {
      setProblem(problemText(error));
    }
  };
  return (
    <li>
      <Card padding="sm" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar
            name={member.member.displayName}
            src={member.member.avatarUrl}
            size="md"
            decorative
          />
          <div className="grid min-w-0 flex-1 text-sm">
            <span className="font-medium">
              {member.member.displayName}
              {self ? <span className="text-muted"> · {t('you')}</span> : null}
            </span>
            <span className="text-muted">{member.function ?? member.member.headline ?? ''}</span>
          </div>
          {pending ? <Badge>{t('pending')}</Badge> : null}
          {canManage && !pending && !self ? (
            <div className="w-40">
              <DeferredSelect
                aria-label={t('roleOf', { name: member.member.displayName })}
                value={member.role}
                options={ROLES.map((role) => ({ value: role, label: roles(role) }))}
                onValueChange={(role) =>
                  void run(
                    () => teamControllerUpdate(project.id, handle, { role }),
                    t('roleChanged', { name: member.member.displayName }),
                  )
                }
              />
            </div>
          ) : (
            <Badge tone="accent">{roles(member.role)}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {self && !pending ? (
            <AlertDialog
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabledReason={lastOwner ? t('lastOwnerRule') : undefined}
                >
                  {t('leave')}
                </Button>
              }
              title={t('leaveTitle', { title: project.title })}
              description={t('leaveBody')}
              confirmLabel={t('leaveConfirm')}
              cancelLabel={t('cancel')}
              onConfirm={async () => {
                setProblem(null);
                try {
                  await teamControllerLeave(project.id);
                  announce(t('left'));
                  router.push(routes.project(project.slug));
                } catch (error) {
                  setProblem(problemText(error));
                }
              }}
            />
          ) : null}
          {canManage && !self ? (
            <AlertDialog
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabledReason={lastOwner ? t('lastOwnerRule') : undefined}
                >
                  {pending ? t('withdraw') : t('remove')}
                </Button>
              }
              title={
                pending
                  ? t('withdrawTitle', { name: member.member.displayName })
                  : t('removeTitle', { name: member.member.displayName })
              }
              description={pending ? t('withdrawBody') : t('removeBody')}
              confirmLabel={pending ? t('withdrawConfirm') : t('removeConfirm')}
              cancelLabel={t('cancel')}
              onConfirm={() =>
                run(
                  () => teamControllerRemove(project.id, handle),
                  t('removed', { name: member.member.displayName }),
                )
              }
            />
          ) : null}
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function InviteForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const t = useTranslations('web.projects.editor.team');
  const roles = useTranslations('reference.projectTeamRoles');
  const { project } = useProjectEditor();
  const problemText = useProblemText();
  const announce = useAnnounce();
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState<ProjectTeamRole>('editor');
  const [fn, setFn] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    const clean = handle.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/.test(clean)) {
      setError(t('handleInvalid'));
      return;
    }
    setError(undefined);
    setProblem(null);
    setBusy(true);
    try {
      await teamControllerInvite(project.id, {
        handle: clean,
        role,
        ...(fn.trim() ? { function: fn.trim() } : {}),
      });
      announce(t('invited', { handle: clean }));
      setHandle('');
      setFn('');
      await onInvited();
    } catch (failure) {
      setProblem(problemText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="team-invite-title" className="grid gap-4">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="team-invite-title">
          {t('invite')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('inviteHint')}
        </Text>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label={t('handle')} description={t('handleHint')} error={error}>
            <Input
              value={handle}
              autoComplete="off"
              onChange={(event) => setHandle(event.target.value)}
            />
          </Field>
          <Field label={t('role')}>
            <DeferredSelect
              value={role}
              options={ROLES.map((item) => ({ value: item, label: roles(item) }))}
              onValueChange={setRole}
            />
          </Field>
        </div>
        <Field
          label={t('function')}
          optional
          description={t('functionHint')}
          counter={{ count: fn.length, max: PROJECT_LIMITS.teamFunction }}
        >
          <Input value={fn} onChange={(event) => setFn(event.target.value)} />
        </Field>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <FormActions>
          <Button type="submit" variant="secondary" loading={busy} loadingLabel={t('inviting')}>
            <UserPlus aria-hidden />
            {t('send')}
          </Button>
        </FormActions>
      </form>
    </section>
  );
}
