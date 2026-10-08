'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';
import { IconSwap } from '@/components/motion';
import { IconButton } from './icon-button';
import { Input } from './input';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'endAdornment'> & {
  /** `current-password` to sign in, `new-password` to create one (password managers). */
  autoComplete: 'current-password' | 'new-password';
};

/**
 * Password field with a button to show or hide what is typed (`aria-pressed`). The text is never
 * shown by default; the state is announced by the button.
 */
export function PasswordInput(props: PasswordInputProps) {
  const t = useTranslations('web.ui.password');
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="none"
      endAdornment={
        <IconButton
          size="sm"
          label={t('show')}
          tooltip={visible ? t('hide') : t('show')}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          icon={
            <IconSwap
              state={visible ? 'shown' : 'hidden'}
              icons={{ hidden: <Eye />, shown: <EyeOff /> }}
            />
          }
        />
      }
    />
  );
}
