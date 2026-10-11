'use client';

import type { MemberCard } from '@pitchorium/contracts';
import { Handshake, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

const loadIntroduce = () => import('./introduce-dialog');
const IntroduceDialog = lazy(loadIntroduce);

/**
 * « Message » on the profile of a member (§10.4): the page of a first message, which opens the
 * conversation that already exists, says when a first message out of network becomes a request
 * and when the preference of the member refuses it; its prerequisites come at the send.
 */
export function MessageButton({
  handle,
  variant = 'secondary',
  label,
}: {
  handle: string;
  variant?: 'primary' | 'secondary' | 'outline';
  /** « Contacter » on the page of a project. */
  label?: string;
}) {
  const t = useTranslations('web.messagingEntry');
  return (
    <Button asChild variant={variant}>
      <Link href={routes.newMessage(handle)}>
        <MessageSquare aria-hidden />
        {label ?? t('message')}
      </Link>
    </Button>
  );
}

/** « Présenter à… » on the profile of a connection: the dialog loads at its first opening. */
export function IntroduceButton({ member }: { member: MemberCard }) {
  const t = useTranslations('web.messagingEntry');
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        onPointerEnter={() => void loadIntroduce()}
        onFocus={() => void loadIntroduce()}
        onClick={() => {
          setOpened(true);
          setOpen(true);
        }}
      >
        <Handshake aria-hidden />
        {t('introduce')}
      </Button>
      {opened ? (
        <Suspense fallback={null}>
          <IntroduceDialog member={member} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
