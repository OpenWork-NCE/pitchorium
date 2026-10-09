import {
  getAccessControllerPrerequisitesQueryKey,
  getNotificationsControllerCountersQueryKey,
  getPostsControllerStatsQueryKey,
} from '@pitchorium/api-client';
import { createEventRequestSchema, EVENT_MAX_DURATION_DAYS } from '@pitchorium/contracts';
import { ApiProblemError } from '@pitchorium/api-client';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Download, Filter, UserCog } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWatch } from 'react-hook-form';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { endsAfterStart } from '@/lib/forms/rules';
import { MemberHeader } from '@/components/layout/member/member-header';
import { Main, SingleColumnLayout, ThreeColumnLayout } from '@/components/layout/page-layouts';
import { AdminPage } from '@/components/layout/admin/admin-page';
import {
  AnnouncerProvider,
  Avatar,
  Badge,
  Button,
  Card,
  Combobox,
  DateTimeField,
  FileDrop,
  Form,
  FormActions,
  FormField,
  Heading,
  IconButton,
  Input,
  Loading,
  RadioGroup,
  ShortcutsProvider,
  Table,
  Text,
  Textarea,
  TimeZoneSelect,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import {
  CurrentMemberProvider,
  ProfileCompletion,
  ProfileOnboardingStep,
  SecuritySettings,
  SignInScreen,
  TwoFactorScreen,
} from '@/features/identity';
import { AuthFrame } from '@/components/layout/shells/auth-frame';
import { ActiveLocalesProvider } from '@/features/localization';
import {
  adminMembers,
  counters,
  currentUser,
  feedVariantsPage,
  galleryComments,
  galleryPost,
  galleryStats,
  longPost,
  feedPage,
  members,
  notifications,
  project,
  suggestions,
  thread,
  threadReadBy,
  STORY_NOW,
  tiers,
} from './fixtures';
import { FeedComposer, FeedStream, LazyMemberPost, PostSkeleton } from '@/features/content';
import { SuggestionsList } from '@/features/discovery';
import { ProjectCard } from '@/features/projects';
import { ConversationThread, MessageComposer } from '@/features/messaging';
import { NotificationItem } from '@/features/notifications';
import { RelationshipActions } from '@/features/network';
import { OrganizationManage } from '@/features/organizations';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { Organization, Relationship } from '@pitchorium/contracts';
import { getInvitationsControllerPendingQueryKey } from '@pitchorium/api-client';

const meta = {
  title: 'Compositions',
  parameters: { layout: 'fullscreen', nextjs: { navigation: { pathname: '/feed' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj;

/** The runtime of the member space, fed with fixtures: no request leaves the story. */
function MemberRuntime({
  children,
  seed,
}: {
  children: ReactNode;
  /** What the story reads, put in the cache before it renders. */
  seed?: (client: QueryClient) => void;
}) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    seed?.(queryClient);
    queryClient.setQueryData(getNotificationsControllerCountersQueryKey(), counters);
    for (const action of ['content.post.create', 'project.create'] as const) {
      queryClient.setQueryData(getAccessControllerPrerequisitesQueryKey(action), {
        action,
        allowed: true,
        code: null,
        missing: [],
      });
    }
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <ActiveLocalesProvider locales={['fr', 'en']}>
        <CurrentMemberProvider member={currentUser}>
          <AnnouncerProvider>
            <ShortcutsProvider>
              <div className="min-h-dvh bg-background [--header-height:4.5rem]">{children}</div>
            </ShortcutsProvider>
          </AnnouncerProvider>
        </CurrentMemberProvider>
      </ActiveLocalesProvider>
    </QueryClientProvider>
  );
}

function Feed({ loading }: { loading: boolean }) {
  return (
    <MemberRuntime>
      <MemberHeader initialCounters={counters} />
      <ThreeColumnLayout
        leftLabel="Votre profil"
        rightLabel="Personnes pertinentes pour vous"
        left={<ProfileCompletion variant="card" />}
        right={
          <>
            <ProjectCard project={project} variant="compact" headingLevel={2} />
            <SuggestionsList suggestions={suggestions} />
          </>
        }
      >
        <div className="grid gap-4">
          <Heading level={1} size="page" className="sr-only">
            Accueil
          </Heading>
          <FeedComposer />
          <div className="lg:hidden">
            <ProfileCompletion variant="module" />
          </div>
          {loading ? (
            <Loading className="grid gap-4">
              <PostSkeleton />
              <PostSkeleton />
            </Loading>
          ) : (
            <FeedStream initialPage={feedPage} suggestions={suggestions} />
          )}
        </div>
      </ThreeColumnLayout>
    </MemberRuntime>
  );
}

/** The shell of the member space, its feed in skeletons shaped like the content to come. */
export const MemberShellLoading: Story = {
  name: 'Member shell, feed loading',
  render: () => <Feed loading />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Chargement en cours',
    );
  },
};

/**
 * Then loaded: no visible title, the composer, the posts; on a wide screen the profile on the
 * left, a project and people on the right; on a phone, the profile at the top of the feed and the
 * suggestions after the third post.
 */
export const MemberShellLoaded: Story = {
  name: 'Member shell, feed loaded',
  render: () => <Feed loading={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: /^Notifications\s?, 3 notifications non lues$/ }),
    ).toBeVisible();
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
  },
};

/**
 * The profile of the member and its strength: the card of the left column of a wide screen, and
 * the module at the top of the feed on a narrow one (what is missing, the way to complete it).
 */
export const ProfileCardStory: Story = {
  name: 'Profile card',
  parameters: { layout: 'padded' },
  render: () => (
    <MemberRuntime>
      <div className="flex flex-wrap items-start gap-6 p-1">
        <div className="w-full max-w-xs">
          <ProfileCompletion variant="card" />
        </div>
        <div className="w-full max-w-md">
          <ProfileCompletion variant="module" />
        </div>
      </div>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('progressbar', { name: 'Force du profil' })).toHaveLength(2);
    await expect(canvas.getAllByText('À ajouter : photo et photo de couverture.')).toHaveLength(2);
  },
};

/**
 * The card of a project, `full` (with its milestones, H18 then H17) and `compact` (side columns):
 * whole amounts without decimals, the self-declared impact said once.
 */
export const ProjectCardStory: Story = {
  name: 'Project card',
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <div className="w-full max-w-md">
        <ProjectCard project={project} tiers={tiers} />
      </div>
      <div className="w-full max-w-xs">
        <ProjectCard project={project} variant="compact" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [full] = canvas.getAllByRole('progressbar', { name: /Ferme solaire/ });
    await expect(full).toHaveAttribute('aria-valuenow', '62');
    await expect(
      canvas.getAllByText('12 500 €', { normalizer: (text) => text.replace(/\s/g, ' ') }),
    ).toHaveLength(2);
    await expect(canvas.getAllByText('auto-déclaré')).toHaveLength(2);
    await expect(canvas.getAllByText('Atteint')).toHaveLength(2);
    await expect(canvas.getByText('À venir')).toBeVisible();
    await expect(
      canvas.getAllByRole('link', { name: 'Voir le projet Ferme solaire coopérative de Thiès' }),
    ).toHaveLength(2);
  },
};

/**
 * Notifications: avatars in a column of fixed width, the drawing of the type in their corner, the
 * opening of the publication concerned, and a connection request answered from the list.
 */
export const NotificationsList: Story = {
  name: 'Notifications list',
  parameters: { layout: 'padded' },
  render: () => (
    <MemberRuntime>
      <Card padding="sm" className="grid max-w-xl gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3">
          <Heading level={2} size="card">
            Notifications
          </Heading>
          <Button variant="link" size="sm">
            Tout marquer comme lu
          </Button>
        </div>
        <ul className="grid gap-1">
          {notifications.map((item) => (
            <NotificationItem key={item.id} notification={item} />
          ))}
        </ul>
      </Card>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: /Kofi Mensah et 12 autres ont réagi/ }),
    ).toBeVisible();
    await expect(canvas.getAllByText(/« Nous ouvrons un fonds d’amorçage/)).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: 'Accepter Ifeoma Okafor' })).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Ignorer la demande de Ifeoma Okafor' }),
    ).toBeVisible();
  },
};

/**
 * A conversation: one separator per day, the messages of one author grouped (avatar once, tighter
 * spacing), the short time under the last of a group (full date in a tooltip), « Lu » under the
 * last message sent, a field that grows with its text and a button to attach a file.
 */
export const Conversation: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Card padding="none" className="grid max-w-xl">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Avatar name={members.kofi.displayName} decorative />
        <div>
          <Heading level={2} size="label">
            {members.kofi.displayName}
          </Heading>
          <p className="text-xs text-muted">{members.kofi.headline}</p>
        </div>
      </div>
      <div className="p-4">
        <ConversationThread
          messages={thread}
          other={members.kofi}
          otherLastReadSequence={threadReadBy}
        />
      </div>
      <div className="border-t border-border p-3">
        <MessageComposer onSend={() => undefined} onAttach={() => undefined} />
      </div>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Hier' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
    // Four groups, one time under each; « Lu » under the last message sent only.
    await expect(canvas.getAllByRole('time')).toHaveLength(4);
    await expect(canvas.getAllByText('Lu')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Joindre un fichier' })).toBeVisible();
    const field = canvas.getByRole('textbox', { name: 'Votre message' });
    await userEvent.type(field, 'Bonne soirée,{Enter}à jeudi.');
    await expect(field).toHaveValue('Bonne soirée,\nà jeudi.');
  },
};

const SECTORS = [
  { value: 'energy', label: 'Énergie' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'education', label: 'Éducation' },
  { value: 'health', label: 'Santé' },
];

/** The schema of the api, and the rule it checks as a whole: the end follows the start. */
const eventSchema = endsAfterStart(createEventRequestSchema);

function EventForm() {
  const form = useZodForm(eventSchema, {
    defaultValues: {
      title: '',
      description: '',
      format: 'online',
      timeZone: 'Africa/Dakar',
      language: 'fr',
      visibility: 'members',
      sectorCodes: [],
      onlineUrl: 'https://example.org/atelier',
    },
  });
  const applyProblem = useApplyProblem(form, {
    fields: {
      EVENTS_SCHEDULE_INVALID: { field: 'endsAt', values: { days: EVENT_MAX_DURATION_DAYS } },
    },
  });
  const attempt = useRef(0);
  const timeZone = useWatch({ control: form.control, name: 'timeZone' });
  return (
    <Form
      form={form}
      className="max-w-2xl"
      onSubmit={() => {
        attempt.current += 1;
        applyProblem(
          attempt.current === 1
            ? // A rule only the api checks: an event lasts EVENT_MAX_DURATION_DAYS at most.
              new ApiProblemError(
                {
                  type: 'about:blank',
                  title: 'The dates of the event are invalid',
                  status: 422,
                  code: 'EVENTS_SCHEDULE_INVALID',
                  reason: 'too_long',
                },
                '01JD7Q2XC5D6',
              )
            : new ApiProblemError(
                { type: 'about:blank', title: 'Rate limited', status: 429, code: 'RATE_LIMITED' },
                '01JD7Q2XC5D7',
              ),
        );
      }}
    >
      <Heading level={2} size="section">
        Nouvel événement
      </Heading>
      <Text size="sm" tone="muted">
        Tous les champs sont obligatoires, sauf mention contraire.
      </Text>
      <FormField
        control={form.control}
        name="title"
        label="Titre"
        maxLength={120}
        required
        render={({ field }) => <Input {...field} />}
      />
      <FormField
        control={form.control}
        name="description"
        label="Description"
        description="Markdown simple : titres, listes, liens https."
        optional
        maxLength={10000}
        render={({ field }) => <Textarea {...field} value={String(field.value ?? '')} />}
      />
      <FormField
        control={form.control}
        name="format"
        label="Format"
        render={({ field }) => (
          <RadioGroup
            variant="card"
            value={field.value}
            onValueChange={field.onChange}
            options={[
              {
                value: 'online',
                label: 'En ligne',
                description: 'Le lien est donné aux inscrits.',
              },
              { value: 'in_person', label: 'Sur place', description: 'Adresse, ville et pays.' },
              { value: 'hybrid', label: 'Hybride', description: 'Les deux à la fois.' },
            ]}
          />
        )}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="startsAt"
          label="Début"
          render={({ field }) => (
            <DateTimeField
              value={field.value ?? null}
              onChange={(value) => field.onChange(value ?? undefined)}
              timeZone={timeZone}
            />
          )}
        />
        <FormField
          control={form.control}
          name="endsAt"
          label="Fin"
          render={({ field }) => (
            <DateTimeField
              value={field.value ?? null}
              onChange={(value) => field.onChange(value ?? undefined)}
              timeZone={timeZone}
            />
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="timeZone"
        label="Fuseau horaire"
        description="Les dates sont celles du lieu de l’événement."
        render={({ field }) => (
          <TimeZoneSelect
            value={field.value}
            onChange={field.onChange}
            at={form.getValues('startsAt') ?? null}
          />
        )}
      />
      <FormField
        control={form.control}
        name="onlineUrl"
        label="Lien de la visioconférence"
        render={({ field }) => <Input {...field} value={field.value ?? ''} type="url" />}
      />
      <FormField
        control={form.control}
        name="sectorCodes"
        label="Secteurs"
        optional
        render={({ field }) => (
          <Combobox
            multiple
            max={5}
            options={SECTORS}
            value={field.value ?? []}
            onValueChange={field.onChange}
            placeholder="Ajouter un secteur"
          />
        )}
      />
      <FileDrop
        label="Image de l’événement"
        limits="JPEG, PNG ou WebP, 10 Mo au plus."
        accept={['image/jpeg', 'image/png', 'image/webp']}
        items={[]}
        onFiles={() => undefined}
      />
      <FormActions>
        <Button type="submit">Publier l’événement</Button>
        <Button variant="outline">Enregistrer le brouillon</Button>
      </FormActions>
    </Form>
  );
}

/** A full form on a contract, then the errors of the api: under their fields, then of the form. */
export const FormWithServerErrors: Story = {
  name: 'Form with server errors',
  parameters: { layout: 'padded' },
  render: () => <EventForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Titre' }),
      'Atelier trésorerie des coopératives',
    );
    const start = within(canvas.getByRole('group', { name: 'Début' }));
    await userEvent.click(start.getByRole('spinbutton', { name: 'Jour' }));
    await userEvent.keyboard('201120261800');
    const end = within(canvas.getByRole('group', { name: 'Fin' }));
    await userEvent.click(end.getByRole('spinbutton', { name: 'Jour' }));
    await userEvent.keyboard('201120261700');
    // The browser checks the rule first: the summary takes the focus, its link leads to the end.
    await userEvent.click(canvas.getByRole('button', { name: 'Publier l’événement' }));
    const first = await canvas.findByRole('group', { name: 'Le formulaire contient 1 erreur.' });
    await waitFor(() => expect(first).toHaveFocus());
    await userEvent.click(
      within(first).getByRole('link', { name: 'Fin : La fin doit être après le début.' }),
    );
    await expect(end.getByRole('spinbutton', { name: 'Jour' })).toHaveFocus();
    // Fifteen days later: the browser accepts it, the api refuses it with its precise reason.
    await userEvent.keyboard('051220261900');
    await userEvent.click(canvas.getByRole('button', { name: 'Publier l’événement' }));
    const summary = await canvas.findByRole('group', { name: 'Le formulaire contient 1 erreur.' });
    await waitFor(() => expect(summary).toHaveFocus());
    await expect(
      within(summary).getByRole('link', {
        name: 'Fin : Un événement dure 14 jours au plus : rapprochez la fin du début.',
      }),
    ).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: 'Lien de la visioconférence' })).toBeValid();
  },
};

/** Dense table of the administration: breadcrumbs, filters, sort, cursor pagination. */
export const AdminTable: Story = {
  name: 'Administration table',
  render: () => (
    <div className="min-h-dvh bg-background">
      <Main className="px-4 py-6 sm:px-6 lg:px-8">
        <AdminPage
          breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Membres' }]}
          title="Membres"
          description="Recherche et fiche des membres ; chaque lecture est inscrite au journal d’audit."
          actions={
            <>
              <Button variant="outline" size="sm">
                <Filter aria-hidden /> Filtres
              </Button>
              <Button variant="outline" size="sm">
                <Download aria-hidden /> Exporter
              </Button>
            </>
          }
        >
          <Table
            caption="Membres"
            hideCaption
            density="compact"
            columns={[
              {
                key: 'name',
                header: 'Nom',
                rowHeader: true,
                sortable: true,
                cell: (row) => (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={row.name} size="xs" decorative />
                    {row.name}
                  </span>
                ),
              },
              { key: 'email', header: 'Email', cell: (row) => row.email },
              {
                key: 'roles',
                header: 'Rôles',
                cell: (row) => (
                  <span className="flex gap-1">
                    {row.roles
                      .filter((role) => role !== 'member')
                      .map((role) => (
                        <Badge key={role} tone="accent">
                          {role === 'moderator' ? 'Modératrice' : 'Administrateur'}
                        </Badge>
                      ))}
                  </span>
                ),
              },
              {
                key: 'verified',
                header: 'Email vérifié',
                cell: (row) => (
                  <Badge tone={row.emailVerified ? 'success' : 'warning'}>
                    {row.emailVerified ? 'Vérifié' : 'À vérifier'}
                  </Badge>
                ),
              },
              {
                key: 'created',
                header: 'Inscription',
                sortable: true,
                align: 'end',
                cell: (row) =>
                  new Intl.DateTimeFormat('fr', { dateStyle: 'medium' }).format(
                    new Date(row.createdAt),
                  ),
              },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                headerLabel: 'Actions',
                actions: true,
                align: 'end',
                cell: (row) => (
                  <IconButton
                    size="sm"
                    label={`Gérer les rôles (${row.name})`}
                    icon={<UserCog />}
                  />
                ),
              },
            ]}
            rows={adminMembers}
            rowKey={(row) => row.userId}
            sort={{ key: 'created', direction: 'descending' }}
            onSortChange={() => undefined}
            hasMore
            onLoadMore={() => undefined}
          />
        </AdminPage>
      </Main>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table');
    // Each column has a label of its own.
    await expect(within(table).getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(within(table).getByRole('columnheader', { name: 'Email vérifié' })).toBeVisible();
    // An action with an icon only shows its name in a tooltip, on hover and on focus (the
    // button names itself, the tooltip is hidden from assistive technologies).
    await userEvent.hover(
      within(table).getByRole('button', { name: 'Gérer les rôles (Aïssatou Ba)' }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-radix-popper-content-wrapper]')).toHaveTextContent(
        'Gérer les rôles (Aïssatou Ba)',
      ),
    );
  },
};

/** The split screen of the authentication, its brand panel and a form (AuthShell). */
function AuthComposition({ children }: { children: ReactNode }) {
  const brand = useTranslations('web.auth.brand');
  const a11y = useTranslations('web.a11y');
  return (
    <ActiveLocalesProvider locales={['fr', 'en']}>
      <AuthFrame
        texts={{
          homeLink: a11y('homeLink'),
          label: brand('label'),
          kicker: brand('kicker'),
          promise: brand.rich('promise', {
            nowrap: (chunks) => <span className="whitespace-nowrap">{chunks}</span>,
          }),
          lede: brand('lede'),
        }}
      >
        {children}
      </AuthFrame>
    </ActiveLocalesProvider>
  );
}

const authConfiguration = {
  oauthProviders: ['google', 'linkedin', 'microsoft'] as ('google' | 'linkedin' | 'microsoft')[],
  turnstile: null,
  legal: { termsVersion: '2026-10', privacyVersion: '2026-10', minimumAge: 18 },
  minPasswordLength: 12,
};

/** One entry for every method (§7.2): the providers first, email as the secondary path. */
export const AuthSignIn: Story = {
  name: 'Auth sign in',
  parameters: { nextjs: { navigation: { pathname: '/sign-in' } } },
  render: () => (
    <AuthComposition>
      <SignInScreen config={authConfiguration} redirectTo={null} />
    </AuthComposition>
  ),
};

/** Second factor at sign-in: six digits, or a backup code. */
export const AuthTwoFactor: Story = {
  name: 'Auth two factor',
  parameters: { nextjs: { navigation: { pathname: '/sign-in/two-factor' } } },
  render: () => (
    <AuthComposition>
      <TwoFactorScreen redirectTo={null} />
    </AuthComposition>
  ),
};

/** Last step of the onboarding: photo, name, title, country, the strength of the profile. */
export const OnboardingProfile: Story = {
  name: 'Onboarding profile',
  parameters: { nextjs: { navigation: { pathname: '/onboarding/profile' } } },
  render: () => (
    <AuthComposition>
      <ProfileOnboardingStep
        countries={[
          { value: 'SN', label: 'Sénégal' },
          { value: 'CI', label: 'Côte d’Ivoire' },
          { value: 'FR', label: 'France' },
        ]}
        initial={{
          displayName: currentUser.profile.displayName,
          headline: null,
          countryCode: 'SN',
          avatarUrl: null,
          strength: 35,
        }}
      />
    </AuthComposition>
  ),
};

/** Security settings: password, second factor, the sessions of the account. */
export const SettingsSecurity: Story = {
  name: 'Settings security',
  parameters: { layout: 'padded', nextjs: { navigation: { pathname: '/settings/security' } } },
  render: () => <SessionsFixture />,
};

function SessionsFixture() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    // A password account: the second factor is confirmed by the password.
    queryClient.setQueryData(
      ['identity', 'accounts'],
      [{ id: 'account-1', providerId: 'credential', accountId: 'account-1', scopes: [] }],
    );
    queryClient.setQueryData(['identity', 'sessions'], {
      currentToken: 'this-device',
      rows: [
        {
          id: 'session-1',
          token: 'this-device',
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
          createdAt: '2026-10-01T09:00:00.000Z',
          updatedAt: STORY_NOW.toISOString(),
        },
        {
          id: 'session-2',
          token: 'phone',
          userAgent:
            'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
          createdAt: '2026-09-12T18:30:00.000Z',
          updatedAt: '2026-10-07T21:10:00.000Z',
        },
      ],
    });
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <CurrentMemberProvider member={currentUser}>
        <div className="mx-auto max-w-3xl">
          <SecuritySettings twoFactorRequired={false} />
        </div>
      </CurrentMemberProvider>
    </QueryClientProvider>
  );
}

const stranger: Relationship = {
  degree: 'second',
  mutualConnections: { count: 3, capped: false },
  connection: 'none',
  requestId: null,
  following: false,
  followedBy: false,
  blocked: false,
  counts: { followers: 128, connections: 342 },
};

const RELATIONSHIPS: readonly [string, typeof members.kofi, Relationship][] = [
  ['Aucune relation', members.kofi, stranger],
  [
    'Demande envoyée',
    members.nadia,
    { ...stranger, connection: 'request_sent', requestId: '0192f4a0-5000-7000-8000-000000000001' },
  ],
  [
    'Demande reçue',
    members.jean,
    {
      ...stranger,
      connection: 'request_received',
      requestId: '0192f4a0-5000-7000-8000-000000000002',
      followedBy: true,
    },
  ],
  [
    'En relation, suivi',
    members.ifeoma,
    { ...stranger, degree: 'first', connection: 'connected', following: true, followedBy: true },
  ],
];

/** The actions towards a member in each relationship (ADR 0113): one button that changes. */
export const RelationshipActionsStory: Story = {
  name: 'Relationship actions',
  parameters: { layout: 'padded' },
  render: () => (
    <MemberRuntime>
      <div className="mx-auto grid max-w-3xl gap-4 p-4">
        {RELATIONSHIPS.map(([label, member, relationship]) => (
          <Card key={member.handle} padding="sm" className="grid gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={member.displayName} size="md" decorative />
              <div className="grid">
                <span className="font-medium">{member.displayName}</span>
                <Text size="sm" tone="muted">
                  {label}
                </Text>
              </div>
            </div>
            <RelationshipActions
              handle={member.handle}
              name={member.displayName}
              relationship={relationship}
              url={`https://pitchorium.test/fr/members/${member.handle}`}
            />
          </Card>
        ))}
      </div>
    </MemberRuntime>
  ),
};

/** The request with its note: the dialog opens from « Se connecter ». */
export const ConnectDialogStory: Story = {
  name: 'Connect dialog',
  parameters: { layout: 'padded' },
  render: () => (
    <MemberRuntime>
      <div className="p-4">
        <RelationshipActions
          handle={members.kofi.handle}
          name={members.kofi.displayName}
          relationship={stranger}
          url="https://pitchorium.test/fr/members/kofi-mensah"
        />
      </div>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter avec Kofi Mensah' }));
    const dialog = await within(document.body).findByRole(
      'dialog',
      {
        name: 'Se connecter avec Kofi Mensah',
      },
      { timeout: 5000 },
    );
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: /^Note/ }),
      'Nous nous sommes croisés au forum de Dakar.',
    );
  },
};

const organization: Organization = {
  id: '0192f4a0-4000-7000-8000-000000000001',
  slug: 'fondation-teranga',
  name: 'Fondation Teranga',
  structureType: 'foundation',
  description: 'Bourses, mentorat et dons en nature pour les jeunes entrepreneures du Sahel.',
  countryCodes: ['SN', 'ML'],
  sectorCodes: ['education'],
  websiteUrl: 'https://example.org',
  foundedYear: 2016,
  logoUrl: null,
  logoMediaId: null,
  coverUrl: null,
  coverMediaId: null,
  verification: { status: 'unverified', verified: false, verifiedAt: null },
  members: [
    { ...members.aissatou, role: 'owner' },
    { ...members.kofi, role: 'admin' },
    { ...members.nadia, role: 'member' },
  ],
  projects: { carried: [], supported: [] },
  viewerRole: 'owner',
  createdAt: '2026-09-01T09:00:00.000Z',
};

function OrganizationFixture() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    queryClient.setQueryData(getInvitationsControllerPendingQueryKey(organization.id), {
      items: [
        {
          id: '0192f4a0-6000-7000-8000-000000000001',
          organizationId: organization.id,
          email: 'partenaire@example.org',
          role: 'admin',
          status: 'pending',
          expiresAt: '2026-10-22T09:00:00.000Z',
          createdAt: '2026-10-08T09:00:00.000Z',
        },
      ],
    });
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <CurrentMemberProvider member={currentUser}>
        <AnnouncerProvider>
          <NuqsTestingAdapter searchParams="?tab=members">
            <div className="mx-auto max-w-3xl p-4">
              <OrganizationManage initial={organization} created={false} />
            </div>
          </NuqsTestingAdapter>
        </AnnouncerProvider>
      </CurrentMemberProvider>
    </QueryClientProvider>
  );
}

/** Members, roles, invitations and ownership of an organisation, read by its owner. */
export const OrganizationMembers: Story = {
  name: 'Organization members',
  parameters: { layout: 'padded' },
  render: () => <OrganizationFixture />,
};

/** Every kind of entry of the feed: images, document, link, repost, highlight, project update. */
export const FeedVariants: Story = {
  name: 'Feed variants',
  render: () => (
    <MemberRuntime>
      <SingleColumnLayout width="prose">
        <Heading level={1} size="page" className="sr-only">
          Accueil
        </Heading>
        <FeedStream initialPage={feedVariantsPage} suggestions={[]} />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('feed', { name: 'Fil d’actualité' })).toBeVisible();
    await expect(await canvas.findByText('À la une')).toBeVisible();
    await expect(canvas.getAllByText('Rapport de saison 2026')[0]).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Agrandir l’image 1 sur 5' })).toBeVisible();
  },
};

/** The composer, opened from the feed. */
export const ComposerEmpty: Story = {
  name: 'Composer empty',
  parameters: { nextjs: { navigation: { pathname: '/feed', query: { compose: '1' } } } },
  render: () => (
    <MemberRuntime>
      <SingleColumnLayout width="prose">
        <FeedComposer />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async () => {
    // The composer is loaded on its first opening.
    const dialog = await within(document.body).findByRole(
      'dialog',
      { name: 'Créer une publication' },
      { timeout: 5000 },
    );
    const editor = await within(dialog).findByRole(
      'textbox',
      { name: 'Texte de la publication' },
      { timeout: 5000 },
    );
    // Once the opening of the dialog has played.
    await waitFor(() => expect(editor).toBeVisible());
  },
};

/** The composer with a written text: its counter, its audience and its language. */
export const ComposerFull: Story = {
  name: 'Composer full',
  parameters: { nextjs: { navigation: { pathname: '/feed', query: { compose: '1' } } } },
  render: () => (
    <MemberRuntime>
      <SingleColumnLayout width="prose">
        <FeedComposer />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async () => {
    // The composer is loaded on its first opening.
    const dialog = await within(document.body).findByRole(
      'dialog',
      { name: 'Créer une publication' },
      { timeout: 5000 },
    );
    const editor = await within(dialog).findByRole(
      'textbox',
      { name: 'Texte de la publication' },
      { timeout: 5000 },
    );
    await userEvent.click(editor);
    await userEvent.keyboard('Première récolte de la saison sèche à Thiès : 40 maraîchères.');
    await expect(await within(dialog).findByText(/^61 \/ 3\D?000$/)).toBeVisible();
  },
};

/** A publication on its page, its comments open. */
export const PostPage: Story = {
  name: 'Post page',
  render: () => (
    <MemberRuntime
      seed={(client) =>
        client.setQueryData(['content', 'comments', galleryPost.id], {
          pages: [galleryComments],
          pageParams: [undefined],
        })
      }
    >
      <SingleColumnLayout width="prose">
        <LazyMemberPost post={galleryPost} full commentsOpen />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const thread = await canvas.findByRole('region', { name: 'Commentaires' });
    await expect(
      within(thread).getByText('Quel délai de retour sur investissement pour une coopérative ?'),
    ).toBeVisible();
  },
};

/** The reactions, offered after the pointer rests on « J'aime ». */
export const ReactionPicker: Story = {
  name: 'Reaction picker',
  render: () => (
    <MemberRuntime>
      <SingleColumnLayout width="prose">
        <LazyMemberPost post={longPost} />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(await canvas.findByRole('button', { name: "J'aime" }));
    const bar = await canvas.findByRole('toolbar', { name: 'Réactions' }, { timeout: 3000 });
    await expect(within(bar).getAllByRole('button')).toHaveLength(4);
  },
};

/** The viewer of the images, opened on the first one. */
export const ImageViewer: Story = {
  name: 'Image viewer',
  render: () => (
    <MemberRuntime>
      <SingleColumnLayout width="prose">
        <LazyMemberPost post={galleryPost} />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Agrandir l’image 1 sur 5' }));
    // The viewer is loaded on the first opening.
    const viewer = await within(document.body).findByRole(
      'dialog',
      { name: /^Images de la publication/ },
      { timeout: 5000 },
    );
    await expect(await within(viewer).findByText('1 / 5')).toBeVisible();
  },
};

/** The statistics of a publication, for its author. */
export const PostStatistics: Story = {
  name: 'Post statistics',
  render: () => (
    <MemberRuntime
      seed={(client) =>
        client.setQueryData(getPostsControllerStatsQueryKey(galleryPost.id), galleryStats)
      }
    >
      <SingleColumnLayout width="prose">
        <LazyMemberPost post={galleryPost} />
      </SingleColumnLayout>
    </MemberRuntime>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(
      await within(document.body).findByRole('menuitem', { name: 'Statistiques' }),
    );
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'Statistiques de la publication',
    });
    const chart = within(dialog).getByRole('img', { name: 'Membres uniques par jour' });
    // Once the opening of the dialog has played.
    await waitFor(() => expect(chart).toBeVisible());
  },
};
