'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { IconSwap } from '@/components/motion';
import { Button } from './button';
import { IconButton } from './icon-button';

interface CopyButtonProps {
  /** Text put in the clipboard. */
  value: string;
  /** What is copied, as an action ("Copier le lien"); a generic text by default. */
  label?: string;
  /** Announced once copied; a generic text by default. */
  copiedLabel?: string;
  /** With its label visible, or as an icon button. */
  display?: 'text' | 'icon';
  variant?: 'outline' | 'ghost' | 'secondary';
}

/**
 * Copies a text to the clipboard: the icon swaps to a check for two seconds and the result is
 * announced (polite live region). A refused clipboard (permissions) is announced too.
 */
export function CopyButton({
  value,
  label,
  copiedLabel,
  display = 'text',
  variant = 'outline',
}: CopyButtonProps) {
  const t = useTranslations('web.ui.copy');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  const text = label ?? t('action');
  const icon = (
    <IconSwap
      state={state === 'copied' ? 'copied' : 'idle'}
      icons={{ idle: <Copy />, copied: <Check /> }}
    />
  );
  const announcement =
    state === 'copied' ? (copiedLabel ?? t('done')) : state === 'failed' ? t('failed') : '';

  return (
    <>
      {display === 'icon' ? (
        <IconButton label={text} icon={icon} variant={variant} onClick={() => void copy()} />
      ) : (
        <Button variant={variant} size="sm" onClick={() => void copy()}>
          {icon}
          {text}
        </Button>
      )}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
