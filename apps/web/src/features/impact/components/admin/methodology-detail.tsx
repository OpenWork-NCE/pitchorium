'use client';

import {
  methodologiesControllerArchive,
  methodologiesControllerDelete,
  methodologiesControllerPublish,
  methodologiesControllerUpdate,
} from '@pitchorium/api-client';
import type { AdminImpactMethodology, ImpactMethodologyDraft, Locale } from '@pitchorium/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  Card,
  DescriptionList,
  Heading,
  Text,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleAction, useConsoleProblem } from '@/features/admin';
import { useRouter } from '@/i18n/navigation';
import { draftOf, withAuthoredKeys } from '../../lib/draft';
import { labelOf, type ReferenceLabels } from '../../lib/labels';
import { DraftEditor } from './draft-editor';
import { ScorePreview } from './score-preview';

/**
 * A version of the methodology in the console (§12, ADR 0036, ADR 0173). A draft is edited, saved,
 * checked against the active languages and by a score preview, then published once complete: a
 * published version never changes (the scores cite it) and archives the previous one. A
 * published version can be archived; an archive is read only.
 */
export function MethodologyDetail({ methodology }: { methodology: AdminImpactMethodology }) {
  const t = useTranslations('web.admin.impact');
  const statuses = useTranslations('reference.impactMethodologyStatuses');
  const reference = useTranslations('reference') as unknown as ReferenceLabels;
  const names = useTranslations('web.locale.names');
  const pageLocale = useLocale();
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const manage = useConsoleAction('impact.methodology.manage');
  const [current, setCurrent] = useState(methodology);
  const [draft, setDraft] = useState<ImpactMethodologyDraft>(() => draftOf(methodology));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locales = current.labelCoverage.locales;
  const [locale, setLocale] = useState<Locale>(
    locales.find((value) => value === pageLocale) ?? locales[0] ?? 'fr',
  );
  const editable = current.status === 'draft' && manage.visible;
  const missing = current.labelCoverage.missing;
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'long', timeStyle: 'short' }) : '–';

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await methodologiesControllerUpdate(current.id, {
        ...draft,
        criteria: draft.criteria.map(withAuthoredKeys),
      });
      setCurrent(saved);
      setDraft(draftOf(saved));
      setDirty(false);
      announce(t('saved'));
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setSaving(false);
    }
  }
  async function run(action: 'publish' | 'archive' | 'delete') {
    setError(null);
    try {
      if (action === 'delete') {
        await methodologiesControllerDelete(current.id);
        announce(t('deleted'));
        router.push(routes.adminMethodologies);
        return;
      }
      const next =
        action === 'publish'
          ? await methodologiesControllerPublish(current.id)
          : await methodologiesControllerArchive(current.id);
      setCurrent(next);
      announce(t(action === 'publish' ? 'published' : 'archived'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  const notSaved = dirty ? t('saveFirst') : undefined;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-6">
        {current.demo ? <Alert tone="warning">{reference('impactMentions.demo')}</Alert> : null}
        {editable ? (
          <>
            <DraftEditor
              draft={draft}
              onChange={(next) => {
                setDraft(next);
                setDirty(true);
              }}
              locales={locales}
              locale={locale}
              onLocaleChange={setLocale}
              coverage={current.labelCoverage}
              reference={reference}
            />
            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background py-3">
              {dirty ? (
                <Text size="sm" tone="muted">
                  {t('unsaved')}
                </Text>
              ) : null}
              <Button
                loading={saving}
                loadingLabel={t('saving')}
                disabledReason={manage.disabledReason ?? (dirty ? undefined : t('nothingToSave'))}
                onClick={() => void save()}
              >
                {t('save')}
              </Button>
            </div>
          </>
        ) : (
          <ol className="grid gap-4">
            {current.criteria.map((criterion, index) => (
              <li key={criterion.key}>
                <Card className="grid gap-2 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Heading level={2} size="card">
                      {t('editor.criterion', {
                        index: index + 1,
                        label: labelOf(reference, criterion.labelKey, criterion.labels, pageLocale),
                      })}
                    </Heading>
                    <span className="font-numeric text-sm text-muted tabular-nums">
                      {t('weightValue', { weight: criterion.weight })}
                    </span>
                  </div>
                  <Text size="sm">
                    {labelOf(
                      reference,
                      criterion.descriptionKey,
                      criterion.descriptions,
                      pageLocale,
                    )}
                  </Text>
                  <ul className="grid gap-1 text-sm">
                    {criterion.scale.map((level) => (
                      <li key={level.key} className="flex justify-between gap-3">
                        <span>{labelOf(reference, level.labelKey, level.labels, pageLocale)}</span>
                        <span className="font-numeric text-muted tabular-nums">{level.value}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ol>
        )}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="version-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading level={2} size="card" id="version-title">
              {t('versionName', { version: current.version, name: current.name })}
            </Heading>
            <Badge tone={current.status === 'published' ? 'success' : 'neutral'}>
              {statuses(current.status)}
            </Badge>
          </div>
          <DescriptionList
            items={[
              { key: 'created', term: t('columns.created'), description: date(current.createdAt) },
              {
                key: 'published',
                term: t('columns.published'),
                description: date(current.publishedAt),
              },
              { key: 'archived', term: t('archivedAt'), description: date(current.archivedAt) },
            ]}
          />
        </Card>
        {current.status === 'draft' ? (
          <Card className="grid gap-3 p-5" aria-labelledby="coverage-title">
            <Heading level={2} size="card" id="coverage-title">
              {t('coverage.title')}
            </Heading>
            {missing.length === 0 ? (
              <Text size="sm">
                {t('coverage.complete', { list: locales.map((value) => names(value)).join(', ') })}
              </Text>
            ) : (
              <>
                <Text size="sm">{t('coverage.missing', { count: missing.length })}</Text>
                <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm">
                  {missing.map((item) => (
                    <li
                      key={`${item.criterionKey}-${item.levelKey ?? ''}-${item.field}-${item.locale}`}
                    >
                      <button
                        type="button"
                        className="link-underline-hover text-start text-accent"
                        onClick={() => setLocale(item.locale)}
                      >
                        {t(item.levelKey ? 'coverage.levelItem' : `coverage.${item.field}Item`, {
                          criterion: item.criterionKey,
                          level: item.levelKey ?? '',
                          language: names(item.locale),
                        })}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {dirty ? (
              <Text size="sm" tone="muted">
                {t('coverage.afterSave')}
              </Text>
            ) : null}
          </Card>
        ) : null}
        {current.status !== 'archived' ? (
          <ScorePreview
            key={JSON.stringify(
              current.criteria.map((criterion) => [criterion.key, criterion.scale.length]),
            )}
            methodologyId={current.id}
            criteria={current.criteria}
            locale={pageLocale}
            reference={reference}
            disabledReason={notSaved}
          />
        ) : null}
        {editable ? (
          <Card className="grid gap-3 p-5" aria-labelledby="publish-title">
            <Heading level={2} size="card" id="publish-title">
              {t('publish.title')}
            </Heading>
            <Text size="sm">{t('publish.hint')}</Text>
            <AlertDialog
              trigger={
                <Button
                  className="justify-self-start"
                  disabledReason={
                    manage.disabledReason ??
                    notSaved ??
                    (missing.length > 0 ? t('publish.labelsMissing') : undefined)
                  }
                >
                  {t('publish.action')}
                </Button>
              }
              tone="primary"
              title={t('publish.confirmTitle', { version: current.version })}
              description={t('publish.confirmDescription')}
              confirmLabel={t('publish.action')}
              confirmPhrase={t('publish.phrase')}
              onConfirm={() => run('publish')}
            />
            <AlertDialog
              trigger={
                <Button
                  variant="ghost"
                  className="justify-self-start text-danger"
                  disabledReason={manage.disabledReason}
                >
                  {t('delete.action')}
                </Button>
              }
              title={t('delete.confirmTitle', { name: current.name })}
              description={t('delete.confirmDescription')}
              confirmLabel={t('delete.action')}
              confirmPhrase={t('delete.phrase')}
              onConfirm={() => run('delete')}
            />
          </Card>
        ) : null}
        {current.status === 'published' && manage.visible ? (
          <Card className="grid gap-3 p-5" aria-labelledby="archive-title">
            <Heading level={2} size="card" id="archive-title">
              {t('archive.title')}
            </Heading>
            <Text size="sm">{t('archive.hint')}</Text>
            <AlertDialog
              trigger={
                <Button
                  variant="danger"
                  className="justify-self-start"
                  disabledReason={manage.disabledReason}
                >
                  {t('archive.action')}
                </Button>
              }
              title={t('archive.confirmTitle', { version: current.version })}
              description={t('archive.confirmDescription')}
              confirmLabel={t('archive.action')}
              confirmPhrase={t('archive.phrase')}
              onConfirm={() => run('archive')}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
