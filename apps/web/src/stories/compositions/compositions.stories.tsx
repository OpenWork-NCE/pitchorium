import {
  getAccessControllerPrerequisitesQueryKey,
  getNotificationsControllerCountersQueryKey,
} from '@pitchorium/api-client';
import { createEventRequestSchema, EVENT_MAX_DURATION_DAYS } from '@pitchorium/contracts';
import { ApiProblemError } from '@pitchorium/api-client';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Download, Filter, UserPlus } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { endsAfterStart } from '@/lib/forms/rules';
import { MemberHeader } from '@/components/layout/member/member-header';
import { Main, ThreeColumnLayout } from '@/components/layout/page-layouts';
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
import { CurrentMemberProvider, ProfileCompletion } from '@/features/identity';
import { ActiveLocalesProvider } from '@/features/localization';
import {
  adminMembers,
  counters,
  currentUser,
  feedPage,
  members,
  notifications,
  project,
  suggestions,
  thread,
  threadReadBy,
  tiers,
} from './fixtures';
import { FeedComposer, FeedStream, PostSkeleton } from '@/features/content';
import { SuggestionsList } from '@/features/discovery';
import { ProjectCard } from '@/features/projects';
import { ConversationThread, MessageComposer } from '@/features/messaging';
import { NotificationItem } from '@/features/notifications';

const meta = {
  title: 'Compositions',
  parameters: { layout: 'fullscreen', nextjs: { navigation: { pathname: '/feed' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj;

/** The runtime of the member space, fed with fixtures: no request leaves the story. */
function MemberRuntime({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
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
    await expect(canvas.getAllByText('À ajouter : Photo et Photo de couverture.')).toHaveLength(2);
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
  const timeZone = form.watch('timeZone');
  return (
    <Form
      form={form}
      className="max-w-2xl"
      onSubmit={() => {
        attempt.current += 1;
        applyProblem(
          attempt.current === 1
            ? new ApiProblemError(
                {
                  type: 'about:blank',
                  title: 'Validation failed',
                  status: 400,
                  code: 'VALIDATION_FAILED',
                  errors: [{ pointer: '/onlineUrl', code: 'invalid_format' }],
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
    await userEvent.click(end.getByRole('spinbutton', { name: 'Heures' }));
    await userEvent.keyboard('19');
    // Then the api: each error says the rule its field expects.
    await userEvent.click(canvas.getByRole('button', { name: 'Publier l’événement' }));
    const summary = await canvas.findByRole('group', { name: 'Le formulaire contient 1 erreur.' });
    await waitFor(() => expect(summary).toHaveFocus());
    await expect(within(summary).getAllByRole('link')).toHaveLength(1);
    await expect(canvas.getByRole('textbox', { name: 'Lien de la visioconférence' })).toBeInvalid();
    await expect(
      canvas.getByRole('textbox', { name: 'Lien de la visioconférence' }),
    ).toHaveAccessibleDescription(/commençant par https:\/\//);
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
                header: 'Email',
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
                align: 'end',
                cell: (row) => (
                  <IconButton size="sm" label={`Inviter ${row.name}`} icon={<UserPlus />} />
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
};
