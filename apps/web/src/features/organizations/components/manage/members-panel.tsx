'use client';

import {
  getInvitationsControllerPendingQueryKey,
  invitationsControllerInvite,
  invitationsControllerRevoke,
  membersControllerChangeRole,
  membersControllerLeave,
  membersControllerRemove,
  membersControllerTransfer,
  useInvitationsControllerPending,
} from '@pitchorium/api-client';
import type { InvitableRole, Organization, OrganizationRole } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  AlertDialog,
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Form,
  FormActions,
  FormField,
  Heading,
  Input,
  DeferredSelect,
  Skeleton,
  Text,
  notify,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useCurrentMember } from '@/features/identity';
import { MemberHoverCard } from '@/features/profiles';
import { useRouter } from '@/i18n/navigation';
import { usePlural } from '@/lib/i18n/plural';
import { assignableRoles, canManage, isLastOwner } from '../../lib/roles';
import { createInvitationRequest } from '../../lib/schemas';
import { useOrganizationProblem } from './use-organization-problem';

interface PanelProps {
  organization: Organization;
  onChange: (organization: Organization) => void;
}

/**
 * The members of an organisation and what the reader may do with them (README of the module): an
 * owner gives any role and transfers the ownership; an admin manages admins and members; every
 * member may leave. The rule of the last owner is said before it is met, the api enforces it.
 */
export function MembersPanel({ organization, onChange }: PanelProps) {
  const t = useTranslations('web.organizations.manage.members');
  const me = useCurrentMember();
  const handle = me.profile.handle;
  const lastOwner = isLastOwner(organization.members, handle);
  return (
    <div className="grid gap-6">
      {lastOwner ? <Alert tone="info">{t('lastOwner')}</Alert> : null}
      <MembersList organization={organization} onChange={onChange} self={handle} />
      {canManage(organization.viewerRole) ? <Invitations organization={organization} /> : null}
      {organization.viewerRole === 'owner' ? (
        <Transfer organization={organization} onChange={onChange} self={handle} />
      ) : null}
      <Leave organization={organization} lastOwner={lastOwner} />
    </div>
  );
}

function MembersList({ organization, onChange, self }: PanelProps & { self: string }) {
  const t = useTranslations('web.organizations.manage.members');
  const roles = useTranslations('reference.organizationRoles');
  const announce = useAnnounce();
  const problem = useOrganizationProblem();
  const plural = usePlural();

  async function changeRole(handle: string, name: string, role: OrganizationRole) {
    try {
      onChange(await membersControllerChangeRole(organization.id, handle, { role }));
      announce(t('roleChanged', { name, role: roles(role) }));
    } catch (error) {
      notify.error(problem(error));
    }
  }

  return (
    <Card className="grid gap-4" aria-labelledby="members-title">
      <Heading level={2} size="card" id="members-title">
        {t(`title.${plural(organization.members.length)}`, { count: organization.members.length })}
      </Heading>
      <ul className="grid gap-1" aria-label={t('list')}>
        {organization.members.map((member) => {
          const assignable =
            member.handle === self ? [] : assignableRoles(organization.viewerRole, member.role);
          return (
            <li
              key={member.handle}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2"
              data-member={member.handle}
            >
              <Avatar name={member.displayName} src={member.avatarUrl} size="md" decorative />
              <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
                <MemberHoverCard member={member} signedIn />
                {member.headline ? (
                  <span className="line-clamp-1 text-xs text-muted">{member.headline}</span>
                ) : null}
              </div>
              {assignable.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-44">
                    <DeferredSelect<OrganizationRole>
                      aria-label={t('roleOf', { name: member.displayName })}
                      value={member.role}
                      options={assignable.map((role) => ({ value: role, label: roles(role) }))}
                      onValueChange={(role) =>
                        void changeRole(member.handle, member.displayName, role)
                      }
                    />
                  </div>
                  <AlertDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="text-danger">
                        {t('remove')}
                      </Button>
                    }
                    title={t('removeTitle', { name: member.displayName })}
                    description={t('removeDescription', { name: member.displayName })}
                    confirmLabel={t('remove')}
                    onConfirm={async () => {
                      try {
                        await membersControllerRemove(organization.id, member.handle);
                      } catch (error) {
                        notify.error(problem(error));
                        return;
                      }
                      onChange({
                        ...organization,
                        members: organization.members.filter(
                          (item) => item.handle !== member.handle,
                        ),
                      });
                      announce(t('removed', { name: member.displayName }));
                    }}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted">{roles(member.role)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const INVITABLE: readonly InvitableRole[] = ['member', 'admin'];

/** Invitations by email, for a member or a person without an account; pending ones revoked. */
function Invitations({ organization }: { organization: Organization }) {
  const t = useTranslations('web.organizations.manage.invitations');
  const roles = useTranslations('reference.organizationRoles');
  const format = useFormatter();
  const announce = useAnnounce();
  const problem = useOrganizationProblem();
  const queryClient = useQueryClient();
  const key = getInvitationsControllerPendingQueryKey(organization.id);
  const pending = useInvitationsControllerPending(organization.id);
  const form = useZodForm(createInvitationRequest, {
    defaultValues: { email: '', role: 'member' },
  });
  const applyProblem = useApplyProblem(form);

  async function invite(values: { email: string; role: InvitableRole }) {
    try {
      await invitationsControllerInvite(organization.id, values);
    } catch (error) {
      applyProblem(error);
      return;
    }
    form.reset({ email: '', role: values.role });
    announce(t('sent', { email: values.email }));
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return (
    <Card className="grid gap-4" aria-labelledby="invitations-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="invitations-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description')}
        </Text>
      </div>
      <Form form={form} onSubmit={invite} aria-label={t('title')}>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormField
            control={form.control}
            name="email"
            label={t('email')}
            render={({ field }) => <Input {...field} type="email" autoComplete="off" />}
          />
          <FormField
            control={form.control}
            name="role"
            label={t('role')}
            render={({ field }) => (
              <DeferredSelect<InvitableRole>
                value={field.value}
                options={INVITABLE.map((role) => ({ value: role, label: roles(role) }))}
                onValueChange={field.onChange}
              />
            )}
          />
        </div>
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('sending')}>
            {t('send')}
          </Button>
        </FormActions>
      </Form>
      <div className="grid gap-2 border-t border-border pt-4">
        <Heading level={3} size="label">
          {t('pending')}
        </Heading>
        {pending.isPending ? (
          <Skeleton className="h-10" />
        ) : !pending.data || pending.data.items.length === 0 ? (
          <EmptyState size="inline" title={t('none')} />
        ) : (
          <ul className="grid gap-1" aria-label={t('pending')}>
            {pending.data.items.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
                  <span className="font-medium break-all">{invitation.email}</span>
                  <span className="text-xs text-muted">
                    {t('meta', {
                      role: roles(invitation.role),
                      date: format.dateTime(new Date(invitation.expiresAt), {
                        dateStyle: 'medium',
                      }),
                    })}
                  </span>
                </div>
                <AlertDialog
                  trigger={
                    <Button size="sm" variant="ghost" className="text-danger">
                      {t('revoke')}
                    </Button>
                  }
                  title={t('revokeTitle', { email: invitation.email })}
                  description={t('revokeDescription')}
                  confirmLabel={t('revoke')}
                  onConfirm={async () => {
                    try {
                      await invitationsControllerRevoke(organization.id, invitation.id);
                    } catch (error) {
                      notify.error(problem(error));
                      return;
                    }
                    announce(t('revoked', { email: invitation.email }));
                    await queryClient.invalidateQueries({ queryKey: key });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** An owner names another member owner; they stay admin themselves. */
function Transfer({ organization, onChange, self }: PanelProps & { self: string }) {
  const t = useTranslations('web.organizations.manage.transfer');
  const announce = useAnnounce();
  const problem = useOrganizationProblem();
  const candidates = organization.members.filter((member) => member.handle !== self);
  const [target, setTarget] = useState<string | undefined>(undefined);
  const chosen = candidates.find((member) => member.handle === target);
  return (
    <Card className="grid gap-4" aria-labelledby="transfer-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="transfer-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description')}
        </Text>
      </div>
      {candidates.length === 0 ? (
        <Text size="sm" tone="muted">
          {t('alone')}
        </Text>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label={t('to')}>
              <DeferredSelect<string>
                value={target}
                placeholder={t('choose')}
                options={candidates.map((member) => ({
                  value: member.handle,
                  label: member.displayName,
                }))}
                onValueChange={setTarget}
              />
            </Field>
          </div>
          <AlertDialog
            trigger={
              <Button variant="outline" disabled={!chosen}>
                {t('action')}
              </Button>
            }
            title={t('confirmTitle', { name: chosen?.displayName ?? '' })}
            description={t('confirmDescription', { name: chosen?.displayName ?? '' })}
            confirmLabel={t('action')}
            tone="primary"
            onConfirm={async () => {
              if (!chosen) return;
              try {
                onChange(
                  await membersControllerTransfer(organization.id, { handle: chosen.handle }),
                );
              } catch (error) {
                notify.error(problem(error));
                return;
              }
              setTarget(undefined);
              announce(t('done', { name: chosen.displayName }));
            }}
          />
        </div>
      )}
    </Card>
  );
}

/** Leave the organisation; refused to its last owner, who transfers first. */
function Leave({ organization, lastOwner }: { organization: Organization; lastOwner: boolean }) {
  const t = useTranslations('web.organizations.manage.leave');
  const router = useRouter();
  const problem = useOrganizationProblem();
  return (
    <Card className="grid gap-4" aria-labelledby="leave-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="leave-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t(lastOwner ? 'lastOwner' : 'description')}
        </Text>
      </div>
      <AlertDialog
        trigger={
          <Button
            variant="outline"
            className="justify-self-start"
            disabledReason={lastOwner ? t('lastOwner') : undefined}
          >
            {t('action')}
          </Button>
        }
        title={t('confirmTitle', { name: organization.name })}
        description={t('confirmDescription')}
        confirmLabel={t('action')}
        onConfirm={async () => {
          try {
            await membersControllerLeave(organization.id);
          } catch (error) {
            notify.error(problem(error));
            return;
          }
          notify.success(t('left', { name: organization.name }));
          router.replace(routes.settingsOrganizations);
        }}
      />
    </Card>
  );
}
