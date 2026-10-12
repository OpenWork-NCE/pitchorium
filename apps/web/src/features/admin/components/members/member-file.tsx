'use client';

import {
  accessControllerGrantRole,
  accessControllerRevokeRole,
  adminControllerRevokeSessions,
} from '@pitchorium/api-client';
import type { AssignableRole, MemberFile as MemberFileView } from '@pitchorium/contracts';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DescriptionList,
  EmptyState,
  Field,
  Heading,
  Icon,
  Money,
  RelativeTime,
  Select,
  Table,
  Text,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { type DeviceKind, describeUserAgent } from '@/features/identity';
import { Link, useRouter } from '@/i18n/navigation';
import { useConsoleAction } from '../console-access';
import {
  ReauthenticationNotice,
  RecentSessionHint,
  useResumeEffect,
  useSensitiveAction,
} from '../sensitive-action';
import { useConsoleProblem } from '../use-console-problem';

const DEVICE_ICONS: Record<DeviceKind, typeof Monitor> = {
  computer: Monitor,
  phone: Smartphone,
  tablet: Tablet,
};

const ASSIGNABLE: readonly AssignableRole[] = ['moderator', 'admin'];

/**
 * The file of a member in the console (§13): account, roles, sessions, standing, decisions of the
 * moderation and contributions, as the api gives them; its reading is audited. Every action shows
 * as the api lets the reader take it (ADR 0172); the suspension comes from the trust feature,
 * composed by the page (`moderation`).
 */
export function MemberFile({
  file,
  moderation,
}: {
  file: MemberFileView;
  /** Suspend or lift, from the trust feature (the page composes it). */
  moderation: ReactNode;
}) {
  const t = useTranslations('web.admin.member');
  const format = useFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
  const yesNo = useTranslations('web.admin.common');
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="grid content-start gap-4 p-5" aria-labelledby="identity-title">
        <Heading level={2} size="card" id="identity-title">
          {t('identity')}
        </Heading>
        <DescriptionList
          layout="columns"
          items={[
            { key: 'email', term: t('email'), description: file.email },
            {
              key: 'handle',
              term: t('handle'),
              description: file.handle ? (
                <Link
                  href={routes.member(file.handle)}
                  className="link-underline-hover text-accent"
                >
                  {file.handle}
                </Link>
              ) : (
                '–'
              ),
            },
            {
              key: 'verified',
              term: t('emailVerified'),
              description: file.emailVerified ? yesNo('yes') : yesNo('no'),
            },
            {
              key: 'two-factor',
              term: t('twoFactor'),
              description: file.twoFactorEnabled ? yesNo('yes') : yesNo('no'),
            },
            {
              key: 'kyc',
              term: t('kyc'),
              description: file.kycVerified ? t('kycVerified') : t('kycNone'),
            },
            { key: 'locale', term: t('locale'), description: file.locale },
            { key: 'zone', term: t('timeZone'), description: file.timeZone },
            {
              key: 'terms',
              term: t('terms'),
              description: file.legal.termsVersion ?? t('notAccepted'),
            },
            {
              key: 'privacy',
              term: t('privacy'),
              description: file.legal.privacyVersion ?? t('notAccepted'),
            },
            { key: 'created', term: t('createdAt'), description: date(file.createdAt) },
          ]}
        />
      </Card>
      <Roles file={file} />
      <Card className="grid content-start gap-4 p-5" aria-labelledby="standing-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading level={2} size="card" id="standing-title">
            {t('standing')}
          </Heading>
          {file.suspension ? (
            <Badge tone="danger">
              {file.suspension.endsAt
                ? t('suspendedUntil', { date: date(file.suspension.endsAt) })
                : t('suspendedForGood')}
            </Badge>
          ) : (
            <Badge tone="neutral">{t('notSuspended')}</Badge>
          )}
        </div>
        {moderation}
        <Decisions file={file} />
      </Card>
      <Sessions file={file} />
      <Contributions file={file} />
    </div>
  );
}

function Roles({ file }: { file: MemberFileView }) {
  const t = useTranslations('web.admin.member');
  const roles = useTranslations('reference.roles');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const manage = useConsoleAction('access.roles.manage');
  const sensitive = useSensitiveAction(`roles:${file.userId}`);
  const held = file.roles.filter((role): role is AssignableRole => role !== 'member');
  const free = ASSIGNABLE.filter((role) => !held.includes(role));
  const [role, setRole] = useState<AssignableRole | undefined>(free[0]);
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState<AssignableRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  useResumeEffect(sensitive.resumed, () => setConfirming(true), sensitive.acknowledge);

  async function grant() {
    if (!role) return;
    setError(null);
    try {
      const outcome = await sensitive.run(() => accessControllerGrantRole(file.userId, { role }));
      if (!outcome.done) return;
      announce(t('roleGranted', { role: roles(role) }));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }

  async function revoke(target: AssignableRole) {
    setError(null);
    try {
      const outcome = await sensitive.run(() => accessControllerRevokeRole(file.userId, target));
      if (!outcome.done) return;
      announce(t('roleRevoked', { role: roles(target) }));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }

  return (
    <Card className="grid content-start gap-4 p-5" aria-labelledby="roles-title">
      <Heading level={2} size="card" id="roles-title">
        {t('roles')}
      </Heading>
      <div className="flex flex-wrap gap-2">
        {held.length === 0 ? (
          <Text size="sm" tone="muted">
            {t('noRole')}
          </Text>
        ) : (
          held.map((assigned) => (
            <span key={assigned} className="inline-flex items-center gap-2">
              <Badge tone="accent">{roles(assigned)}</Badge>
              {manage.visible ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabledReason={manage.disabledReason}
                  onClick={() => setRevoking(assigned)}
                >
                  {t('revokeRole')}
                </Button>
              ) : null}
            </span>
          ))
        )}
      </div>
      <Text size="sm" tone="muted">
        {t('roleExplanation')}
      </Text>
      {manage.visible && free.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('grantRoleLabel')}>
            <Select
              value={role}
              onValueChange={setRole}
              options={free.map((value) => ({ value, label: roles(value) }))}
            />
          </Field>
          <Button
            variant="secondary"
            disabledReason={manage.disabledReason}
            onClick={() => setConfirming(true)}
          >
            {t('grantRole')}
          </Button>
        </div>
      ) : null}
      {manage.visible ? <RecentSessionHint /> : null}
      {sensitive.stale ? <ReauthenticationNotice resumeKey={`roles:${file.userId}`} /> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="primary"
        title={t('grantTitle', { role: role ? roles(role) : '', name: file.name })}
        description={t('grantDescription')}
        confirmLabel={t('grantRole')}
        onConfirm={grant}
      />
      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={t('revokeTitle', { role: revoking ? roles(revoking) : '', name: file.name })}
        description={t('revokeDescription')}
        confirmLabel={t('revokeRole')}
        onConfirm={() => (revoking ? revoke(revoking) : undefined)}
      />
    </Card>
  );
}

function Sessions({ file }: { file: MemberFileView }) {
  const t = useTranslations('web.admin.member');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const revoke = useConsoleAction('admin.sessions.revoke');
  const [error, setError] = useState<string | null>(null);
  const describe = (userAgent: string | null) => {
    const { device, browser, system } = describeUserAgent(userAgent);
    const software = browser && system ? `${browser}, ${system}` : (browser ?? system);
    return (
      [device ? t(`devices.${device}`) : null, software].filter(Boolean).join(' · ') ||
      t('unknownDevice')
    );
  };
  async function signOutEverywhere() {
    setError(null);
    try {
      await adminControllerRevokeSessions(file.userId);
      announce(t('sessionsRevoked'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <Card className="grid content-start gap-4 p-5" aria-labelledby="sessions-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} size="card" id="sessions-title">
          {t('sessions', { count: file.sessions.length })}
        </Heading>
        {revoke.visible && file.sessions.length > 0 ? (
          <AlertDialog
            trigger={
              <Button size="sm" variant="danger" disabledReason={revoke.disabledReason}>
                {t('revokeSessions')}
              </Button>
            }
            title={t('revokeSessionsTitle', { name: file.name })}
            description={t('revokeSessionsDescription')}
            confirmLabel={t('revokeSessions')}
            onConfirm={signOutEverywhere}
          />
        ) : null}
      </div>
      {file.sessions.length === 0 ? (
        <EmptyState size="inline" title={t('noSession')} />
      ) : (
        <ul className="grid gap-2">
          {file.sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-start gap-3 rounded-md border border-border p-3"
            >
              <Icon
                icon={DEVICE_ICONS[describeUserAgent(session.userAgent).device ?? 'computer']}
                className="mt-0.5 text-muted"
              />
              <span className="grid gap-0.5 text-sm">
                <span className="font-medium">{describe(session.userAgent)}</span>
                <span className="text-muted">
                  {t('lastActive')} <RelativeTime date={session.lastActiveAt} />
                  {' · '}
                  {t('opened', {
                    date: format.dateTime(new Date(session.createdAt), { dateStyle: 'medium' }),
                  })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function Decisions({ file }: { file: MemberFileView }) {
  const t = useTranslations('web.admin.member');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const read = useConsoleAction('trust.moderation.read');
  if (file.decisions.length === 0) {
    return (
      <Text size="sm" tone="muted">
        {t('noDecision')}
      </Text>
    );
  }
  return (
    <ul className="grid gap-2" aria-label={t('decisions')}>
      {file.decisions.map((decision) => (
        <li key={decision.id} className="grid gap-1 rounded-md border border-border p-3 text-sm">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {reference(`moderationDecisionKinds.${decision.kind}`)}
              {decision.reason ? ` · ${reference(`reportReasons.${decision.reason}`)}` : ''}
            </span>
            <span className="font-numeric text-muted tabular-nums">
              {format.dateTime(new Date(decision.decidedAt), { dateStyle: 'medium' })}
            </span>
          </span>
          <span className="line-clamp-2 text-muted">{decision.statement}</span>
          <span className="flex flex-wrap items-center gap-2">
            {decision.appeal ? (
              <Badge tone="neutral">{reference(`appealStatuses.${decision.appeal.status}`)}</Badge>
            ) : null}
            {read.visible ? (
              <Link
                href={routes.adminCase(decision.caseId)}
                className="link-underline-hover font-medium text-accent"
              >
                {t('openCase')}
              </Link>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Contributions({ file }: { file: MemberFileView }) {
  const t = useTranslations('web.admin.member');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const read = useConsoleAction('payment.contributions.read');
  type Row = MemberFileView['contributions'][number];
  return (
    <Card
      className="grid content-start gap-4 p-5 xl:col-span-2"
      aria-labelledby="contributions-title"
    >
      <Heading level={2} size="card" id="contributions-title">
        {t('contributions')}
      </Heading>
      <Table<Row>
        caption={t('contributions')}
        hideCaption
        density="compact"
        rows={file.contributions}
        rowKey={(row) => row.id}
        empty={<EmptyState size="inline" title={t('noContribution')} />}
        columns={[
          {
            key: 'date',
            header: t('columns.date'),
            rowHeader: true,
            cell: (row) =>
              read.visible ? (
                <Link
                  href={routes.adminContribution(row.id)}
                  className="link-underline-hover text-accent"
                >
                  {format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}
                </Link>
              ) : (
                format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })
              ),
          },
          {
            key: 'project',
            header: t('columns.project'),
            cell: (row) => row.project?.title ?? '–',
          },
          {
            key: 'kind',
            header: t('columns.kind'),
            cell: (row) => reference(`contributionKinds.${row.kind}`),
          },
          {
            key: 'status',
            header: t('columns.status'),
            cell: (row) => reference(`contributionStatuses.${row.status}`),
          },
          {
            key: 'amount',
            header: t('columns.amount'),
            align: 'end',
            cell: (row) => <Money amount={row.amount} precision="financial" />,
          },
        ]}
      />
    </Card>
  );
}
