'use client';

import { useTranslations } from 'next-intl';
import { displayKeys } from '@/lib/shortcuts/keys';
import { Dialog, DialogContent } from './dialog';
import { Kbd } from './kbd';
import { labelText, type ShortcutDefinition } from './shortcuts';

interface ShortcutsHelpProps {
  groups: [string, readonly { keys: string; label: ShortcutDefinition['label'] }[]][];
  apple: boolean;
  onClose: () => void;
}

/** Help of the keyboard shortcuts (`?`): every registered shortcut, with the keys of the platform. */
export default function ShortcutsHelp({ groups, apple, onClose }: ShortcutsHelpProps) {
  const t = useTranslations('web.ui.shortcuts');
  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={t('title')} description={t('description')} size="md">
        <div className="grid gap-6">
          {groups.map(([group, items]) => (
            <section key={group} className="grid gap-2">
              <h3 className="text-sm font-semibold">{group}</h3>
              <dl className="grid gap-1.5">
                {items.map((item) => (
                  <div key={item.keys} className="flex items-center justify-between gap-4 text-sm">
                    <dt>{labelText(item.label)}</dt>
                    <dd className="flex items-center gap-1">
                      {displayKeys(item.keys, apple).map((part) => (
                        <Kbd key={part}>{part}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
