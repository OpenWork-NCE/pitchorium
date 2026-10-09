'use client';

import { meControllerSetIntention } from '@pitchorium/api-client';
import { INTENTIONS, type Intention } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, FormActions, RadioGroup } from '@/components/ui';

/**
 * « Qu'est-ce qui vous amène ? » (§7.2, step 2): one question, skippable, changed later from the
 * profile. It orients the suggestions and locks nothing.
 */
export function IntentionStep({
  initial,
  onDone,
}: {
  initial: Intention | null;
  onDone: () => void;
}) {
  const t = useTranslations('web.onboarding.intention');
  const [value, setValue] = useState<Intention | undefined>(initial ?? undefined);
  const [pending, setPending] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(intention: Intention | null) {
    setPending(intention ? 'save' : 'skip');
    setError(null);
    try {
      // Skipping keeps an intention chosen before; only a choice is sent.
      if (intention) await meControllerSetIntention({ intention });
      onDone();
    } catch {
      setPending(null);
      setError(t('failed'));
    }
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) void save(value);
        else setError(t('choose'));
      }}
    >
      <RadioGroup
        aria-label={t('question')}
        variant="card"
        value={value}
        onValueChange={setValue}
        options={INTENTIONS.map((intention) => ({
          value: intention,
          label: t(`options.${intention}.label`),
          description: t(`options.${intention}.description`),
        }))}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <FormActions>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={!value}
          loading={pending === 'save'}
          loadingLabel={t('saving')}
        >
          {t('continue')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full sm:w-auto"
          loading={pending === 'skip'}
          loadingLabel={t('saving')}
          onClick={() => void save(null)}
        >
          {t('skip')}
        </Button>
      </FormActions>
    </form>
  );
}
