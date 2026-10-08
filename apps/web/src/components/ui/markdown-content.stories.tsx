import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { MarkdownContent } from './markdown-content';

const SOURCE = `## Le projet

Une ferme solaire **coopérative** à Thiès, pour *trois villages* et une école.

### Ce que nous finançons

- 120 panneaux et leurs onduleurs
- la formation de vingt techniciennes et techniciens
  - maintenance préventive
  - sécurité électrique
1. Étude de sol
2. Installation

> Nous voulons que les familles gardent la main sur leur énergie.

---

Plus d’informations sur [notre site](https://example.org) ou <https://example.org/rapport>.
Le code \`SN-THI-2026\` identifie le dossier.

<script>alert('jamais')</script> [piège](javascript:alert(1))`;

const meta = {
  title: 'Design system/Data display/Markdown content',
  component: MarkdownContent,
} satisfies Meta<typeof MarkdownContent>;
export default meta;

/** The restricted Markdown of the api, rendered without any HTML from the text. */
export const Restricted: StoryObj<typeof meta> = {
  args: { source: SOURCE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 3, name: 'Le projet' })).toBeVisible();
    await expect(
      canvas.getByRole('heading', { level: 4, name: 'Ce que nous finançons' }),
    ).toBeVisible();
    const link = canvas.getByRole('link', { name: /notre site/ });
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    const content = canvas.getByRole('heading', { level: 3, name: 'Le projet' }).parentElement;
    await expect(content?.querySelector('script')).toBeNull();
    await expect(canvas.queryByRole('link', { name: /piège/ })).toBeNull();
    await expect(canvas.getByText(/<script>alert/)).toBeVisible();
  },
};
