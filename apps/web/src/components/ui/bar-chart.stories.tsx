import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BarChart, type BarChartDatum } from './bar-chart';
import { Button } from './button';
import { Card } from './card';
import { Heading } from './heading';

const meta = { title: 'Design system/Data display/Bar chart' } satisfies Meta;
export default meta;
type Story = StoryObj;

const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const compactEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const MONTHS = ['nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août'];
const LONG = [
  'novembre 2025',
  'décembre 2025',
  'janvier 2026',
  'février 2026',
  'mars 2026',
  'avril 2026',
  'mai 2026',
  'juin 2026',
  'juillet 2026',
  'août 2026',
  'septembre 2026',
  'octobre 2026',
];
const GIVEN = [0, 50, 0, 120, 0, 0, 300, 80, 0, 2_400, 500, 120];

/** Euros in minor units: the values of the chart, never a floating point amount. */
const money: BarChartDatum[] = GIVEN.map((euro, index) => ({
  key: `m${index}`,
  value: euro * 100,
  label: [...MONTHS, 'sept.', 'oct.'][index]!,
  description: LONG[index]!,
  formatted: euros.format(euro),
}));

const VIEWERS = [42, 87, 156, 118, 203, 312, 141, 64];
const counts: BarChartDatum[] = VIEWERS.map((count, index) => ({
  key: `d${index}`,
  value: count,
  label: `${index + 1} oct.`,
  description: `${index + 1} octobre`,
  formatted: `${count} membres`,
}));

const columns = { category: 'Mois', value: 'Versé' };
const empty = {
  title: 'Aucune contribution sur les 12 derniers mois',
  description: 'Les euros que vous versez à des projets apparaîtront ici, mois par mois.',
  action: <Button variant="primary">Découvrir des projets</Button>,
};

/** Twelve months of money in a card that carries the title: the chart has none of its own. */
export const Money: Story = {
  render: () => (
    <Card className="grid gap-4">
      <Heading level={2} size="card">
        Euros versés sur douze mois
      </Heading>
      <BarChart
        data={money}
        title="Euros versés sur douze mois"
        summary="3 570 € versés sur 12 mois · pic en août 2026 : 2 400 €"
        formatTick={(value) => compactEuros.format(value / 100)}
        columns={columns}
        empty={empty}
      />
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One keyboard stop, the arrows move from bar to bar and the tooltip says the value.
    await userEvent.tab();
    const first = canvas.getByRole('button', { name: /^novembre 2025 : 0/ });
    await expect(first).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('button', { name: /^octobre 2026 : 120/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect(canvas.getByRole('tooltip')).toHaveTextContent(/août 2026\s*2\s400/);
    // The values are in a table for screen readers; the graduations are round amounts.
    await expect(canvas.getByRole('table')).toHaveTextContent(/août 2026\s*2\s400/);
    await expect(canvasElement).toHaveTextContent(/3\sk\s€/);
    // A single title: the one of the card.
    await expect(
      canvas.getAllByText('Euros versés sur douze mois', { selector: 'h2' }),
    ).toHaveLength(1);
  },
};

/** Counts per day, the chart carrying its own title. */
export const Counts: Story = {
  render: () => (
    <div className="max-w-lg">
      <BarChart
        data={counts}
        title="Membres uniques par jour"
        showTitle
        summary="8 jours suivis · pic le 6 octobre : 312 membres uniques"
        formatTick={(value) =>
          new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value)
        }
        columns={{ category: 'Jour', value: 'Membres uniques' }}
        empty={empty}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button', { name: '6 octobre : 312 membres' }));
    await expect(canvas.getByRole('tooltip')).toHaveTextContent('312 membres');
  },
};

/** Nothing above zero: never empty axes, but what is missing and the action that fills it. */
export const Empty: Story = {
  render: () => (
    <Card>
      <BarChart
        data={money.map((datum) => ({ ...datum, value: 0, formatted: '0 €' }))}
        title="Euros versés sur douze mois"
        formatTick={(value) => compactEuros.format(value / 100)}
        columns={columns}
        empty={empty}
      />
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: empty.title })).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Découvrir des projets' })).toBeVisible();
  },
};

/** The series loads: a skeleton of the shape of the chart. */
export const Loading: Story = {
  render: () => (
    <Card>
      <BarChart
        data={undefined}
        title="Euros versés sur douze mois"
        formatTick={String}
        columns={columns}
        empty={empty}
      />
    </Card>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveAttribute('aria-busy', 'true');
  },
};

/** The series could not load: what happened, and a retry. */
export const Failed: Story = {
  render: () => (
    <Card>
      <BarChart
        data={undefined}
        state="error"
        onRetry={() => undefined}
        title="Euros versés sur douze mois"
        formatTick={String}
        columns={columns}
        empty={empty}
      />
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  },
};
