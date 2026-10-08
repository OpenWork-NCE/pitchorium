import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './button';
import { FundingProgress } from './funding-progress';
import { ImpactBadge } from './impact-badge';
import { Notice } from './notice';
import { VerifiedBadge } from './verified-badge';

const meta = { title: 'Design system/Signature' } satisfies Meta;
export default meta;
type Story = StoryObj;

const milestones = [
  { amountMinor: '500000' },
  { amountMinor: '1200000' },
  { amountMinor: '2000000' },
];

/**
 * Bar, milestones, amount, percentage and days left as text; when in view, the check of each
 * reached milestone is drawn (H18), then the amount counts (H17). Whole amounts without decimals.
 */
export const Funding: Story = {
  render: () => (
    <div className="grid max-w-md gap-10">
      <FundingProgress
        label="Financement de la ferme solaire de Thiès"
        raised={{ amountMinor: '1250000', currency: 'EUR' }}
        goal={{ amountMinor: '2000000', currency: 'EUR' }}
        milestones={milestones}
        daysLeft={12}
      />
      <FundingProgress
        label="Financement de l’atelier de couture de Jacmel"
        raised={{ amountMinor: '3400000', currency: 'XAF' }}
        goal={{ amountMinor: '3000000', currency: 'XAF' }}
        daysLeft={null}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole('progressbar', {
      name: 'Financement de la ferme solaire de Thiès',
    });
    await expect(bar).toHaveAttribute('aria-valuenow', '62');
    await expect(bar).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('12 jours restants'),
    );
    await expect(canvas.getAllByText('Atteint')).toHaveLength(2);
    await expect(canvas.getByText('À venir')).toBeVisible();
    await expect(
      canvas.getByText('sur un objectif de 20 000 €', {
        normalizer: (text) => text.replace(/\s/g, ' '),
      }),
    ).toBeVisible();
    await expect(canvas.getByRole('progressbar', { name: /Jacmel/ })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    await expect(canvas.getByText(/Campagne terminée/, { selector: 'p' })).toBeVisible();
  },
};

/**
 * Tinted by default (never competing with the main action), "self-declared" said once next to
 * the badge; the detail per criterion and the full mention in a Popover. `solid` for a heading.
 */
export const Impact: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <ImpactBadge
        level="strong"
        levelLabel="Fort"
        score={78}
        mention="Score auto-déclaré par le porteur, selon la méthodologie v1. Ce n'est pas une certification."
        criteria={[
          { label: 'Emploi local', score: 4, max: 5 },
          { label: 'Accès à l’énergie', score: 5, max: 5 },
          { label: 'Gouvernance', score: 3, max: 5 },
        ]}
      />
      <ImpactBadge
        level="moderate"
        levelLabel="Modéré"
        score={54}
        mention="Score auto-déclaré."
        criteria={[]}
      />
      <ImpactBadge
        level="emerging"
        levelLabel="Émergent"
        score={21}
        mention="Score auto-déclaré."
        criteria={[]}
      />
      <ImpactBadge
        variant="solid"
        level="strong"
        levelLabel="Fort"
        score={78}
        mention="Score auto-déclaré."
        criteria={[]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('auto-déclaré')).toHaveLength(4);
    await userEvent.click(canvas.getAllByRole('button', { name: /Impact Fort.*78 sur 100/ })[0]!);
    const dialog = await within(document.body).findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText('Emploi local')).toBeVisible());
    await expect(within(dialog).getByText(/pas une certification/)).toBeVisible();
    await userEvent.keyboard('{Escape}');
  },
};

export const Verified: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        Fondation Sahel Énergie <VerifiedBadge description="Organisation vérifiée par Pitchorium" />
      </span>
      <VerifiedBadge display="label" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', { name: 'Organisation vérifiée par Pitchorium' }),
    ).toBeVisible();
  },
};

/** The mandatory mentions, each from its key of the catalogues. */
export const Notices: Story = {
  render: () => (
    <div className="grid max-w-lg gap-3">
      <Notice kind="selfDeclared" version="v1" />
      <Notice
        kind="machineTranslation"
        provider="DeepL"
        action={
          <Button variant="link" className="text-xs">
            Voir l’original
          </Button>
        }
      />
      <Notice kind="notTaxReceipt" />
      <Notice kind="moderated" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/n’est pas un reçu fiscal/)).toBeVisible();
    await expect(canvas.getByText(/Traduction automatique \(DeepL\)/)).toBeVisible();
  },
};
