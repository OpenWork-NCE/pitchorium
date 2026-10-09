import { ApiProblemError, invitationsControllerPreview } from '@pitchorium/api-client';
import { invitationTokenRequestSchema } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Avatar, Button, Card, EmptyState, Heading, Text, VerifiedBadge } from '@/components/ui';
import { routes } from '@/config/routes';
import { InvitationResponse } from '@/features/organizations';
import { Link } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';

/**
 * An invitation the api refuses (closed, expired, already used, unknown token) is said as such;
 * any other failure (the api unreachable, a limit) is thrown to the error screen, with its
 * reference and a retry, rather than taken for a closed invitation.
 */
function closedInvitation(error: unknown): null {
  if (
    error instanceof ApiProblemError &&
    ['ORGANIZATIONS_INVITATION_INVALID', 'VALIDATION_FAILED'].includes(error.problem.code)
  ) {
    return null;
  }
  throw error;
}

/** The token is in the address: never sent as a referrer, never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.organizations.invitation');
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/**
 * An invitation to an organisation received by email (`/invitations/<token>`): what it invites
 * to, read with the token (never the invited address); a visitor creates an account or signs in
 * and comes back here, a member accepts or declines. A closed invitation is said as such.
 */
export default async function Page({ params }: PageProps<'/[locale]/invitations/[token]'>) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const t = await getTranslations('web.organizations.invitation');
  const roles = await getTranslations('reference.organizationRoles');
  const format = await getFormatter();
  configureServerApi();
  const valid = invitationTokenRequestSchema.safeParse({ token }).success;
  const [preview, member] = await Promise.all([
    valid
      ? invitationsControllerPreview(
          { token },
          // A public read: without the session of the reader, which the api would only accept
          // with a trusted Origin, as for any write carrying a session cookie (CSRF, ADR 0021).
          { cache: 'no-store', headers: { cookie: '' } },
        ).catch(closedInvitation)
      : null,
    getCurrentMember(),
  ]);
  if (!preview) {
    return (
      <SingleColumnLayout width="prose">
        <EmptyState
          title={t('invalidTitle')}
          description={t('invalid')}
          action={
            <Button asChild variant="outline">
              <Link href={member ? routes.feed : routes.home}>
                {t(member ? 'toFeed' : 'toHome')}
              </Link>
            </Button>
          }
        />
      </SingleColumnLayout>
    );
  }
  const { organization } = preview;
  const back = `/${locale}${routes.invitation(token)}`;
  return (
    <SingleColumnLayout width="prose">
      <Card className="grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar
            name={organization.name}
            src={organization.logoUrl}
            size="xl"
            shape="square"
            decorative
          />
          <div className="grid min-w-0 gap-1">
            <Heading level={1} size="section" className="break-words">
              {t('heading', { name: organization.name })}
            </Heading>
            {organization.verified ? <VerifiedBadge display="label" /> : null}
          </div>
        </div>
        <Text>
          {t('body', {
            role: roles(preview.role),
            date: format.dateTime(new Date(preview.expiresAt), { dateStyle: 'long' }),
          })}
        </Text>
        {member ? (
          <InvitationResponse token={token} slug={organization.slug} name={organization.name} />
        ) : (
          <div className="grid gap-3">
            <Text size="sm" tone="muted">
              {t('visitor')}
            </Text>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={withRedirect(routes.signUp, back)}>{t('signUp')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={withRedirect(routes.signIn, back)}>{t('signIn')}</Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </SingleColumnLayout>
  );
}
