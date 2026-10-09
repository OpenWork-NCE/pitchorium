import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, Filter, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AlertDialog } from './alert-dialog';
import { Avatar } from './avatar';
import { Button } from './button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from './dialog';
import { Drawer, DrawerContent, DrawerTrigger } from './drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { HoverCard } from './hover-card';
import { IconButton } from './icon-button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetTrigger } from './sheet';
import { Tooltip } from './tooltip';

const meta = { title: 'Design system/Overlays' } satisfies Meta;
export default meta;
type Story = StoryObj;

const body = () => within(document.body);

/** Focus trapped, Escape closes and gives the focus back to the trigger. */
export const DialogStory: Story = {
  name: 'Dialog',
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Partager le projet</Button>
      </DialogTrigger>
      <DialogContent
        title="Partager le projet"
        description="Envoyez-le à vos connexions ou copiez son lien."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button>Partager</Button>
          </>
        }
      >
        <p className="text-sm">Le lien reste valable dans toutes les langues actives.</p>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Partager le projet' });
    await userEvent.click(trigger);
    const dialog = await body().findByRole('dialog', { name: 'Partager le projet' });
    await expect(dialog).toHaveAccessibleDescription(
      'Envoyez-le à vos connexions ou copiez son lien.',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body().queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

/** The action stays unavailable until the phrase is typed; Cancel has the focus first. */
export const DestructiveConfirmation: StoryObj<{ onConfirm: () => void }> = {
  args: { onConfirm: fn() },
  render: (args) => (
    <AlertDialog
      trigger={
        <Button variant="danger">
          <Trash2 aria-hidden />
          Supprimer le projet
        </Button>
      }
      title="Supprimer « Ferme solaire de Thiès » ?"
      description="Le brouillon, ses paliers et son équipe seront supprimés. Cette action est définitive."
      confirmLabel="Supprimer définitivement"
      confirmPhrase="ferme-solaire-thies"
      onConfirm={args.onConfirm}
    />
  ),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Supprimer le projet' }),
    );
    // The dialog loads at its first opening (ADR 0094).
    const dialog = await body().findByRole('alertdialog', {}, { timeout: 5000 });
    await expect(within(dialog).getByRole('button', { name: 'Annuler' })).toHaveFocus();
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer définitivement' });
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(confirm);
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole('textbox'), 'ferme-solaire-thies');
    const ready = within(dialog).getByRole('button', { name: 'Supprimer définitivement' });
    await expect(ready).not.toHaveAttribute('aria-disabled');
    await userEvent.click(ready);
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalledOnce());
  },
};

export const SideSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter aria-hidden />
          Filtres
        </Button>
      </SheetTrigger>
      <SheetContent
        title="Filtrer les projets"
        description="Pays, secteur, état et impact minimum."
      >
        <p className="text-sm text-muted">Les filtres arrivent avec la vitrine.</p>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Filtres' }));
    const sheet = await body().findByRole('dialog', { name: 'Filtrer les projets' });
    await waitFor(() => expect(sheet).toBeVisible());
    await userEvent.keyboard('{Escape}');
  },
};

/** Pulled up from the bottom of a phone (vaul); dragged down or Escape closes it. */
export const MobileDrawer: Story = {
  globals: { viewport: { value: 'mobile1' } },
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Options de la publication</Button>
      </DrawerTrigger>
      <DrawerContent title="Options de la publication">
        <div className="grid gap-2">
          <Button variant="ghost" className="justify-start">
            <Pencil aria-hidden /> Modifier
          </Button>
          <Button variant="ghost" className="justify-start">
            <Share2 aria-hidden /> Partager
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Options de la publication' }),
    );
    const drawer = await body().findByRole('dialog', { name: 'Options de la publication' });
    await waitFor(() => expect(drawer).toBeVisible());
    await userEvent.keyboard('{Escape}');
  },
};

export const Floating: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Pourquoi cette suggestion ?</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="text-sm">
            Vous partagez le secteur « Énergie » et vous cherchez un mentor technique.
          </p>
        </PopoverContent>
      </Popover>
      <HoverCard
        trigger={
          <a href="#profil" className="link-underline font-medium text-link">
            Aïssatou Ba
          </a>
        }
      >
        <div className="flex gap-3">
          <Avatar name="Aïssatou Ba" size="lg" decorative />
          <div>
            <p className="font-semibold">Aïssatou Ba</p>
            <p className="text-sm text-muted">Fondatrice, Ferme solaire de Thiès · Dakar</p>
          </div>
        </div>
      </HoverCard>
      <Tooltip content="Notifications">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Pourquoi cette suggestion ?' }));
    await expect(await body().findByRole('dialog')).toHaveTextContent(/secteur « Énergie »/);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body().queryByRole('dialog')).toBeNull());
  },
};

/** Arrows move, typeahead, Escape gives the focus back. */
export const Menu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Plus d’actions" icon={<MoreHorizontal />} variant="outline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Publication</DropdownMenuLabel>
        <DropdownMenuItem>
          <Pencil aria-hidden /> Modifier
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Share2 aria-hidden /> Partager
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger">
          <Trash2 aria-hidden /> Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Plus d’actions' });
    await userEvent.click(trigger);
    const menu = await body().findByRole('menu');
    await userEvent.keyboard('{ArrowDown}');
    await expect(within(menu).getByRole('menuitem', { name: 'Modifier' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
