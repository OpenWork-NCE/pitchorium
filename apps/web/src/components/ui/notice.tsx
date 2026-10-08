import { Info, Languages, ReceiptText, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The mandatory mentions of the product (frontend handoff), each read from its key of the
 * catalogues: the self-declared impact, the machine translation, the absence of tax receipt and
 * the moderated content.
 */
type NoticeProps =
  | { kind: 'selfDeclared'; version: string; action?: ReactNode; className?: string }
  | { kind: 'machineTranslation'; provider: string; action?: ReactNode; className?: string }
  | { kind: 'notTaxReceipt' | 'moderated'; action?: ReactNode; className?: string };

const ICONS = {
  selfDeclared: Info,
  machineTranslation: Languages,
  notTaxReceipt: ReceiptText,
  moderated: ShieldAlert,
} as const;

/** A mandatory mention, next to what it qualifies; an action when there is one (see the original). */
export function Notice(props: NoticeProps) {
  const t = useTranslations();
  const Icon = ICONS[props.kind];
  const text =
    props.kind === 'selfDeclared'
      ? t('reference.impactMentions.selfDeclared', { version: props.version })
      : props.kind === 'machineTranslation'
        ? t('web.notices.machineTranslation', {
            mention: t('common.machineTranslation'),
            provider: props.provider,
          })
        : t(`web.notices.${props.kind}`);
  return (
    <p
      data-notice={props.kind}
      className={cn('flex items-start gap-2 text-xs text-muted', props.className)}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <span>
        {text}
        {props.action ? <> {props.action}</> : null}
      </span>
    </p>
  );
}
