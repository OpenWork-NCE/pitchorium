import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, Leaf, Search } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { Heading } from './heading';
import { Icon } from './icon';
import { Kbd } from './kbd';
import { Kicker } from './kicker';
import { Link } from './link';
import { Separator } from './separator';
import { Text } from './text';
import { VisuallyHidden } from './visually-hidden';

const meta = { title: 'Design system/Typography and base' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** Roles of direction.md: the level is the outline, the size is the role. */
export const Headings: Story = {
  render: () => (
    <div className="grid gap-4">
      <Heading level={1} size="display">
        Des projets qui avancent ensemble
      </Heading>
      <Heading level={1} size="page">
        Mon réseau
      </Heading>
      <Heading level={2} size="section">
        Personnes pertinentes pour vous
      </Heading>
      <Heading level={3} size="card">
        Ferme solaire de Thiès
      </Heading>
      <Heading level={4} size="label">
        Besoins du projet
      </Heading>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('heading', { level: 1 })).toHaveLength(2);
    await expect(canvas.getByRole('heading', { level: 3 })).toHaveClass('font-sans');
  },
};

export const RunningText: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-3">
      <Kicker>Projet à impact</Kicker>
      <Text size="lg">Un texte clair, avec une lecture confortable sur ordinateur et mobile.</Text>
      <Text prose>
        Le texte courant est en Poppins, de 16 à 17 pixels, avec un interligne de 1,5 et au plus
        soixante-huit caractères par ligne, pour qu’un œil fatigué suive sans effort.
      </Text>
      <Text size="sm" tone="muted">
        Publié il y a 3 heures · Dakar, Sénégal
      </Text>
      <Text tone="success" weight="medium">
        Palier atteint
      </Text>
      <Text tone="danger" weight="medium">
        Paiement refusé
      </Text>
      <Text numeric size="lg" weight="semibold">
        1 250 000 FCFA
      </Text>
    </div>
  ),
};

/** Underline at rest inside a text (WCAG 1.4.1), drawn from the left on hover and focus. */
export const Links: Story = {
  render: () => (
    <div className="grid max-w-xl gap-3">
      <Text>
        Lisez la <Link href="/legal/terms">charte de la communauté</Link> avant de publier.
      </Text>
      <Link href="/network" variant="standalone">
        Voir tout mon réseau
      </Link>
      <Text>
        Site du projet :{' '}
        <Link href="https://example.org" external={{ newTabLabel: 'nouvel onglet' }}>
          example.org
        </Link>
      </Text>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const external = within(canvasElement).getByRole('link', { name: /example\.org/ });
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAccessibleName(/nouvel onglet/);
  },
};

/** One stroke (1.75), three sizes: 16, 20, 24 px. */
export const Icons: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-foreground">
      <Icon icon={Search} size="sm" />
      <Icon icon={Bell} size="md" />
      <Icon icon={Leaf} size="lg" label="Impact" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'Impact' })).toBeVisible();
    await expect(canvasElement.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  },
};

export const KeysAndSeparators: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <Text size="sm">
        Ouvrir la recherche : <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
      </Text>
      <Separator />
      <div className="flex h-6 items-center gap-3 text-sm">
        <span>Abonnés</span>
        <Separator orientation="vertical" />
        <span>Abonnements</span>
      </div>
      <Text size="sm">
        Visible <VisuallyHidden>et lu par les lecteurs d’écran seulement</VisuallyHidden>
      </Text>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('separator')).toHaveLength(2);
  },
};
