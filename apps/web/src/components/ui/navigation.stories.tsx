import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FolderPlus, Moon, PenSquare } from 'lucide-react';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Breadcrumbs } from './breadcrumbs';
import { Button } from './button';
import { CommandPalette } from './command-palette';
import { LanguageSwitcher } from './language-switcher';
import { Pagination } from './pagination';
import { ShortcutsProvider, useShortcut } from './shortcuts';
import { Tabs, TabsPanel } from './tabs';

const meta = { title: 'Design system/Navigation' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** The indicator glides to the active tab; arrows move between tabs. */
export const TabsStory: Story = {
  name: 'Tabs',
  render: function Render() {
    const [tab, setTab] = useState<'followers' | 'following' | 'connections'>('connections');
    return (
      <Tabs
        label="Réseau"
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: 'connections', label: 'Connexions', count: 128 },
          { value: 'followers', label: 'Abonnés', count: 342 },
          { value: 'following', label: 'Abonnements', count: 87 },
        ]}
      >
        <TabsPanel value="connections">Vos connexions.</TabsPanel>
        <TabsPanel value="followers">Vos abonnés.</TabsPanel>
        <TabsPanel value="following">Vos abonnements.</TabsPanel>
      </Tabs>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /Connexions/ }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: /Abonnés/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Vos abonnés.');
  },
};

export const BreadcrumbsStory: Story = {
  name: 'Breadcrumbs',
  render: () => (
    <Breadcrumbs
      items={[
        { label: 'Administration', href: '/admin' },
        { label: 'Modération', href: '/admin/moderation' },
        { label: 'Signalement 1042' },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Signalement 1042')).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

export const CursorPagination: StoryObj<{ onLoadMore: () => void }> = {
  args: { onLoadMore: fn() },
  render: (args) => (
    <div className="grid max-w-md gap-8">
      <Pagination hasMore onLoadMore={args.onLoadMore} shown={20} />
      <Pagination hasMore onLoadMore={() => undefined} loading shown={40} />
      <Pagination hasMore={false} onLoadMore={() => undefined} shown={52} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Afficher plus' })[0]!);
    await expect(args.onLoadMore).toHaveBeenCalledOnce();
    await expect(canvas.getByText('Vous avez tout vu.')).toBeVisible();
  },
};

/** Active languages only; a disclosure of links, Escape closes and gives the focus back. */
export const Languages: Story = {
  render: () => (
    <LanguageSwitcher
      label="Langue"
      current="fr"
      options={[
        { code: 'fr', label: 'Français', href: '/fr' },
        { code: 'en', label: 'English', href: '/en' },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: /Langue/ });
    await userEvent.click(toggle);
    await expect(canvas.getByRole('link', { name: 'English' })).toHaveAttribute('hreflang', 'en');
    await userEvent.keyboard('{Escape}');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveFocus();
  },
};

/** Shell of the global search: quick actions and recent searches; results come with the search. */
export const Palette: StoryObj<{ onSearch: (query: string) => void; onPublish: () => void }> = {
  args: { onSearch: fn(), onPublish: fn() },
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    const [recent, setRecent] = useState(['énergie solaire', 'mentor finance']);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Rechercher
        </Button>
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          recent={recent}
          onClearRecent={() => setRecent([])}
          onSearch={args.onSearch}
          actions={[
            { id: 'publish', label: 'Publier', icon: <PenSquare />, onSelect: args.onPublish },
            {
              id: 'project',
              label: 'Créer un projet',
              icon: <FolderPlus />,
              onSelect: () => undefined,
            },
            {
              id: 'theme',
              label: 'Passer au thème sombre',
              icon: <Moon />,
              keywords: ['apparence'],
              onSelect: () => undefined,
            },
          ]}
        />
      </>
    );
  },
  play: async ({ args }) => {
    const dialog = await within(document.body).findByRole('dialog', { name: 'Recherche globale' });
    const search = within(dialog).getByRole('combobox');
    await expect(search).toHaveFocus();
    await waitFor(() => expect(within(dialog).getByText('énergie solaire')).toBeVisible());
    await userEvent.type(search, 'apparence');
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: /thème sombre/ })).toBeVisible(),
    );
    await userEvent.clear(search);
    await userEvent.type(search, 'coopérative{Enter}');
    await expect(args.onSearch).toHaveBeenCalledWith('coopérative');
  },
};

function Shortcuts({ onHome }: { onHome: () => void }) {
  useShortcut({ keys: 'g h', label: 'Aller à l’accueil', group: 'Navigation', run: onHome });
  return (
    <div className="grid max-w-md gap-3">
      <p className="text-sm text-muted">Tapez G puis H, ou ? pour l’aide.</p>
      <input
        aria-label="Champ de saisie"
        className="h-11 rounded-md border border-border-strong px-3"
      />
    </div>
  );
}

/** Central registry: sequences, help on ?, nothing while typing in a field. */
export const KeyboardShortcuts: StoryObj<{ onHome: () => void }> = {
  args: { onHome: fn() },
  render: (args) => (
    <ShortcutsProvider>
      <Shortcuts onHome={args.onHome} />
    </ShortcutsProvider>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: 'Champ de saisie' }));
    await userEvent.keyboard('gh');
    await expect(args.onHome).not.toHaveBeenCalled();
    await userEvent.click(canvasElement);
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('gh');
    await expect(args.onHome).toHaveBeenCalledOnce();
    await userEvent.keyboard('?');
    const help = await within(document.body).findByRole('dialog', { name: 'Raccourcis clavier' });
    await waitFor(() => expect(within(help).getByText('Aller à l’accueil')).toBeVisible());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
  },
};
