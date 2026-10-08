import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { CircleDollarSign, FileText, Flag } from 'lucide-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Avatar, AvatarGroup } from './avatar';
import { Badge } from './badge';
import { Card } from './card';
import { DescriptionList } from './description-list';
import { Money } from './money';
import { RelativeTime } from './relative-time';
import { Stat } from './stat';
import { Stepper } from './stepper';
import { Tag } from './tag';
import { Timeline } from './timeline';
import { Truncate } from './truncate';

const meta = { title: 'Design system/Data display' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** Initials on a colour derived from the name, AA in both themes; organisations are square. */
export const Avatars: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="flex items-end gap-3">
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
          <Avatar key={size} name="Aïssatou Ba" size={size} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {[
          'Kofi Mensah',
          'Jean-Baptiste Pierre-Louis',
          'Nadia Benali',
          'Ifeoma Okafor',
          'Claudine Pierre',
          'Moussa Diop',
        ].map((name) => (
          <Avatar key={name} name={name} />
        ))}
        <Avatar name="Fondation Sahel Énergie" shape="square" />
      </div>
      <AvatarGroup
        label="Aïssatou, Kofi et 4 autres membres"
        people={[
          'Aïssatou Ba',
          'Kofi Mensah',
          'Nadia Benali',
          'Moussa Diop',
          'Ifeoma Okafor',
          'Claudine Pierre',
        ].map((name) => ({ name }))}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('img', { name: 'Aïssatou Ba' })[0]).toHaveTextContent('AB');
    await expect(
      canvas.getByRole('img', { name: 'Aïssatou, Kofi et 4 autres membres' }),
    ).toHaveTextContent('+2');
  },
};

export const BadgesAndTags: Story = {
  render: function Render() {
    const [sectors, setSectors] = useState(['Agriculture', 'Énergie', 'Éducation']);
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge>Brouillon</Badge>
          <Badge tone="accent">En financement</Badge>
          <Badge tone="success">Financé</Badge>
          <Badge tone="warning">KYC en attente</Badge>
          <Badge tone="danger">Suspendu</Badge>
          <Badge tone="info">Nouveau</Badge>
          <Badge tone="count">12</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {sectors.map((sector) => (
            <Tag
              key={sector}
              removeLabel={`Retirer ${sector}`}
              onRemove={() => setSectors(sectors.filter((item) => item !== sector))}
            >
              {sector}
            </Tag>
          ))}
          <Tag>Sénégal</Tag>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retirer Énergie' }));
    await expect(canvas.queryByText('Énergie')).toBeNull();
  },
};

export const Cards: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <p className="font-semibold">Surface</p>
        <p className="mt-1 text-sm text-muted">Bordure et ombre légère.</p>
      </Card>
      <Card surface="sunken">
        <p className="font-semibold">En creux</p>
        <p className="mt-1 text-sm text-muted">Zone secondaire.</p>
      </Card>
      <Card surface="interactive" className="relative">
        <a href="#card" className="font-semibold after:absolute after:inset-0">
          Carte cliquable
        </a>
        <p className="mt-1 text-sm text-muted">La bordure se renforce au survol.</p>
      </Card>
    </div>
  ),
};

/** H17: the value counts up once in view (final value at once with less motion). */
export const Figures: Story = {
  render: () => {
    const eur = new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR' });
    const count = new Intl.NumberFormat('fr');
    return (
      <div className="grid gap-8">
        <dl className="grid gap-6 sm:grid-cols-3">
          <Stat
            label="Contributions versées"
            value={1250.5}
            step={0.01}
            format={(value) => eur.format(value)}
          />
          <Stat
            label="Projets soutenus"
            value={7}
            format={(value) => count.format(value)}
            hint="dont 2 cette année"
          />
          <Stat label="Heures de mentorat" value={36} format={(value) => count.format(value)} />
        </dl>
        <div className="grid gap-2">
          <Money amount={{ amountMinor: '125000', currency: 'EUR' }} />
          <Money
            amount={{ amountMinor: '500000', currency: 'XAF' }}
            euroEquivalent={{ amountMinor: '76224', currency: 'EUR' }}
          />
          <Money amount={{ amountMinor: '9007199254740993', currency: 'EUR' }} />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^1\s250,00\s€$/)).toBeVisible();
    await expect(canvas.getByText(/soit 762,24/)).toBeVisible();
    await expect(canvas.getByText(/^90\s071\s992\s547\s409,93\s€$/)).toBeVisible();
  },
};

/** Relative date kept up to date; the full date on hover and keyboard focus. */
export const Time: Story = {
  render: () => <RelativeTime date={new Date(Date.now() - 5 * 60_000).toISOString()} />,
  play: async ({ canvasElement }) => {
    const time = within(canvasElement).getByText(/il y a 5 minutes/);
    await userEvent.tab();
    await expect(time).toHaveFocus();
    await waitFor(() => expect(within(document.body).getByRole('tooltip')).toBeVisible());
  },
};

export const TruncatedText: Story = {
  render: () => (
    <div className="max-w-md">
      <Truncate lines={2}>
        <p>
          Nous construisons une ferme solaire coopérative à Thiès pour alimenter trois villages en
          électricité stable, former vingt techniciennes et techniciens à la maintenance, et
          financer les premières années par la vente de l’excédent au réseau national.
        </p>
      </Truncate>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = await canvas.findByRole('button', { name: 'Voir plus' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(canvas.getByRole('button', { name: 'Voir moins' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  },
};

export const Lists: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-10">
      <DescriptionList
        items={[
          { term: 'Secteur', description: 'Énergie' },
          { term: 'Stade', description: 'Prototype' },
          { term: 'Pays', description: 'Sénégal, Thiès' },
          { term: 'Équipe', description: '6 personnes' },
        ]}
      />
      <Timeline
        entries={[
          {
            id: '1',
            title: 'Campagne publiée',
            when: '2 septembre 2026',
            icon: <Flag />,
            tone: 'accent',
          },
          {
            id: '2',
            title: 'Palier 1 atteint',
            when: '20 septembre 2026',
            icon: <CircleDollarSign />,
            tone: 'success',
            body: '5 000 € réunis par 48 contributions.',
          },
          { id: '3', title: 'Actualité publiée', when: '1er octobre 2026', icon: <FileText /> },
        ]}
      />
      <Stepper
        label="Création du projet"
        current={1}
        steps={[
          { id: 'basics', label: 'L’essentiel' },
          { id: 'funding', label: 'Financement' },
          { id: 'team', label: 'Équipe' },
          { id: 'publish', label: 'Publication' },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const steps = within(
      canvas.getByRole('navigation', { name: 'Création du projet' }),
    ).getAllByRole('listitem');
    await expect(steps[1]).toHaveAttribute('aria-current', 'step');
    await expect(canvas.getAllByRole('term')).toHaveLength(4);
  },
};
