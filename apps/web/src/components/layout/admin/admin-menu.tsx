'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { IconButton, Sheet, SheetContent, SheetTrigger } from '@/components/ui';
import { AdminNav } from './admin-nav';

/** The side navigation of the administration on a narrow screen, in a side panel. */
export function AdminMenu() {
  const t = useTranslations('web.admin.nav');
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton label={t('open')} icon={<Menu />} className="lg:hidden" />
      </SheetTrigger>
      <SheetContent side="left" title={t('label')}>
        <AdminNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
