'use client';

import { ApiProblemError, translationsControllerTranslate } from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { Button, MarkdownContent, Notice } from '@/components/ui';

import type { TranslationFormat, TranslationSource } from './translate';

type State =
  | { status: 'idle' | 'loading' }
  | { status: 'translated'; text: string; provider: string; showing: boolean }
  | { status: 'error'; code: string };

/**
 * The machine translation of one field of a content into the language of the interface, on the
 * action of the member only (`POST /v1/translations`): never silent, the original one press away;
 * the api decides (`LOCALIZATION_*`). Loaded at the first press (translate.tsx).
 */
function useMachineTranslation(source: TranslationSource, field: string) {
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: 'idle' });
  async function translate() {
    setState({ status: 'loading' });
    try {
      const translation = await translationsControllerTranslate({
        sourceType: source.type,
        sourceId: source.id,
        targetLocale: locale,
      });
      setState({
        status: 'translated',
        text: translation.fields[field] ?? '',
        provider: translation.provider,
        showing: true,
      });
    } catch (error) {
      setState({
        status: 'error',
        code: error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR',
      });
    }
  }
  const toggle = () =>
    setState((current) =>
      current.status === 'translated' ? { ...current, showing: !current.showing } : current,
    );
  return { state, translate, toggle };
}

type MachineTranslation = ReturnType<typeof useMachineTranslation>;

/**
 * The original (`children`) and its translation in one cell, a short cross fade between them
 * (motion.md), the mention « Traduction automatique » with its provider and the way back to the
 * original; the error of the api in words when it refused.
 */
function TranslationView({
  translation,
  language,
  format,
  children,
}: {
  translation: MachineTranslation;
  /** Language of the original, for the reading of its text. */
  language: string | null | undefined;
  format: TranslationFormat;
  children: ReactNode;
}) {
  const t = useTranslations('web.translation');
  const errors = useTranslations('errors');
  const { state, toggle } = translation;
  if (state.status !== 'translated') {
    return (
      <>
        {children}
        {state.status === 'error' ? (
          <p role="status" className="text-sm text-danger">
            {errors.has(state.code as never)
              ? errors(state.code as never)
              : errors('INTERNAL_ERROR')}
          </p>
        ) : null}
      </>
    );
  }
  const provider = t.has(`providers.${state.provider}` as never)
    ? t(`providers.${state.provider}` as never)
    : state.provider;
  return (
    <div>
      <div className="cross-fade">
        <div
          data-active={state.showing ? undefined : ''}
          inert={state.showing}
          lang={language ?? undefined}
        >
          {children}
        </div>
        <div data-active={state.showing ? '' : undefined} inert={!state.showing}>
          {format === 'markdown' ? (
            <MarkdownContent source={state.text} sectionLevel={2} />
          ) : (
            <p className="whitespace-pre-line">{state.text}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {state.showing ? <Notice kind="machineTranslation" provider={provider} /> : null}
        <Button type="button" variant="link" size="sm" onClick={toggle}>
          {state.showing ? t('original') : t('translated')}
        </Button>
      </div>
    </div>
  );
}

/**
 * A translation asked for: requested at once (the gate loaded this module at the press), then
 * shown in place of the original (TranslationView), with « Traduire » again after a refusal.
 */
export default function ActiveTranslation({
  source,
  language,
  field,
  format,
  children,
}: {
  source: TranslationSource;
  language: string | null | undefined;
  field: string;
  format: TranslationFormat;
  children: ReactNode;
}) {
  const t = useTranslations('web.translation');
  const translation = useMachineTranslation(source, field);
  const { state, translate } = translation;
  useEffect(() => {
    void translate();
    // Asked once, at the press that loaded this module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <TranslationView translation={translation} language={language} format={format}>
        {children}
      </TranslationView>
      {state.status === 'loading' || state.status === 'error' ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1"
          loading={state.status === 'loading'}
          loadingLabel={t('translating')}
          onClick={() => void translate()}
        >
          {t('translate')}
        </Button>
      ) : null}
    </>
  );
}
