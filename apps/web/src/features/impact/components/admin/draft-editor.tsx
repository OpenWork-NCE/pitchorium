'use client';

import type {
  AdminImpactMethodology,
  ImpactCriterion,
  ImpactMethodologyDraft,
  Locale,
} from '@pitchorium/contracts';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  Field,
  Heading,
  IconButton,
  Input,
  Tabs,
  TabsPanel,
  Text,
  Textarea,
} from '@/components/ui';
import { newCriterion, newLevel } from '../../lib/draft';
import { labelOf, type ReferenceLabels } from '../../lib/labels';
import { IMPACT_CRITERIA_MAX, IMPACT_SCALE_LEVELS_MAX } from '../../lib/limits';

type Labels = Partial<Record<Locale, string>>;

/** A label set for a language, removed when emptied (a stored label is never blank). */
function withLabel(labels: Labels | undefined, locale: Locale, value: string): Labels {
  const next: Labels = { ...labels };
  if (value.length === 0) delete next[locale];
  else next[locale] = value;
  return next;
}

/**
 * The editor of a draft methodology (§12, ADR 0173): its name, then each criterion with its key,
 * its weight, its label and description in the language chosen above, and its answer scale
 * (key, value from 0 to 100, label). A criterion of the catalogue shows the text of the catalogue
 * as a placeholder; what is written here is read first. Saved as a whole by the page.
 */
export function DraftEditor({
  draft,
  onChange,
  locales,
  locale,
  onLocaleChange,
  coverage,
  reference,
}: {
  draft: ImpactMethodologyDraft;
  onChange: (draft: ImpactMethodologyDraft) => void;
  /** Active languages, as the api checks the labels against them. */
  locales: readonly Locale[];
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  coverage: AdminImpactMethodology['labelCoverage'];
  reference: ReferenceLabels;
}) {
  const t = useTranslations('web.admin.impact.editor');
  const names = useTranslations('web.locale.names');
  const placeholderOf = (key: string) => (reference.has(key) ? reference(key) : undefined);
  const setCriterion = (index: number, criterion: ImpactCriterion) =>
    onChange({
      ...draft,
      criteria: draft.criteria.map((current, position) =>
        position === index ? criterion : current,
      ),
    });
  const move = (index: number, offset: -1 | 1) => {
    const criteria = [...draft.criteria];
    const [moved] = criteria.splice(index, 1);
    if (!moved) return;
    criteria.splice(index + offset, 0, moved);
    onChange({ ...draft, criteria });
  };
  return (
    <div className="grid gap-6">
      <Field label={t('name')} description={t('nameHint')}>
        <Input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          maxLength={120}
          autoComplete="off"
        />
      </Field>
      <Tabs
        label={t('locale')}
        value={locale}
        onValueChange={onLocaleChange}
        tabs={locales.map((value) => ({
          value,
          label: names(value),
          count: coverage.missing.filter((item) => item.locale === value).length || undefined,
        }))}
      >
        <TabsPanel value={locale} className="grid gap-4 pt-4">
          <Text size="sm" tone="muted" prose>
            {t('localeHint', { language: names(locale) })}
          </Text>
          <ol className="grid gap-4">
            {draft.criteria.map((criterion, index) => {
              const titleId = `criterion-${index}`;
              return (
                <li key={index}>
                  <Card className="grid gap-4 p-5" aria-labelledby={titleId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Heading level={2} size="card" id={titleId}>
                        {t('criterion', {
                          index: index + 1,
                          label: labelOf(reference, criterion.labelKey, criterion.labels, locale),
                        })}
                      </Heading>
                      <div className="flex gap-1">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          label={t('moveUp')}
                          icon={<ArrowUp aria-hidden />}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          label={t('moveDown')}
                          icon={<ArrowDown aria-hidden />}
                          disabled={index === draft.criteria.length - 1}
                          onClick={() => move(index, 1)}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          label={t('removeCriterion')}
                          icon={<Trash2 aria-hidden />}
                          disabled={draft.criteria.length === 1}
                          onClick={() =>
                            onChange({
                              ...draft,
                              criteria: draft.criteria.filter((_, position) => position !== index),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      <Field label={t('key')} description={t('keyHint')}>
                        <Input
                          value={criterion.key}
                          onChange={(event) =>
                            setCriterion(index, { ...criterion, key: event.target.value })
                          }
                          maxLength={48}
                          autoComplete="off"
                          spellCheck={false}
                          className="font-mono"
                        />
                      </Field>
                      <Field label={t('weight')} description={t('weightHint')}>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={criterion.weight}
                          onChange={(event) =>
                            setCriterion(index, {
                              ...criterion,
                              weight: Number(event.target.value),
                            })
                          }
                          className="font-numeric tabular-nums"
                        />
                      </Field>
                    </div>
                    <Field label={t('label', { language: names(locale) })}>
                      <Input
                        value={criterion.labels?.[locale] ?? ''}
                        placeholder={placeholderOf(criterion.labelKey)}
                        onChange={(event) =>
                          setCriterion(index, {
                            ...criterion,
                            labels: withLabel(criterion.labels, locale, event.target.value),
                          })
                        }
                        maxLength={200}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label={t('description', { language: names(locale) })}>
                      <Textarea
                        value={criterion.descriptions?.[locale] ?? ''}
                        placeholder={placeholderOf(criterion.descriptionKey)}
                        onChange={(event) =>
                          setCriterion(index, {
                            ...criterion,
                            descriptions: withLabel(
                              criterion.descriptions,
                              locale,
                              event.target.value,
                            ),
                          })
                        }
                        minRows={2}
                        maxLength={1_000}
                      />
                    </Field>
                    <fieldset className="grid gap-3">
                      <legend className="mb-2 text-sm font-medium">{t('scale')}</legend>
                      <ul className="grid gap-3">
                        {criterion.scale.map((level, levelIndex) => {
                          const setLevel = (patch: Partial<typeof level>) =>
                            setCriterion(index, {
                              ...criterion,
                              scale: criterion.scale.map((current, position) =>
                                position === levelIndex ? { ...current, ...patch } : current,
                              ),
                            });
                          return (
                            <li
                              key={levelIndex}
                              className="grid items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,2fr)_auto]"
                            >
                              <Field label={t('levelKey')}>
                                <Input
                                  value={level.key}
                                  onChange={(event) => setLevel({ key: event.target.value })}
                                  maxLength={48}
                                  autoComplete="off"
                                  spellCheck={false}
                                  className="font-mono"
                                />
                              </Field>
                              <Field label={t('levelValue')}>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={100}
                                  value={level.value}
                                  onChange={(event) =>
                                    setLevel({ value: Number(event.target.value) })
                                  }
                                  className="font-numeric tabular-nums"
                                />
                              </Field>
                              <Field label={t('levelLabel', { language: names(locale) })}>
                                <Input
                                  value={level.labels?.[locale] ?? ''}
                                  placeholder={placeholderOf(level.labelKey)}
                                  onChange={(event) =>
                                    setLevel({
                                      labels: withLabel(level.labels, locale, event.target.value),
                                    })
                                  }
                                  maxLength={200}
                                  autoComplete="off"
                                />
                              </Field>
                              <IconButton
                                size="sm"
                                variant="ghost"
                                label={t('removeLevel')}
                                icon={<Trash2 aria-hidden />}
                                disabled={criterion.scale.length <= 2}
                                onClick={() =>
                                  setCriterion(index, {
                                    ...criterion,
                                    scale: criterion.scale.filter(
                                      (_, position) => position !== levelIndex,
                                    ),
                                  })
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                      <Button
                        size="sm"
                        variant="outline"
                        className="justify-self-start"
                        disabledReason={
                          criterion.scale.length >= IMPACT_SCALE_LEVELS_MAX
                            ? t('levelsMax', { max: IMPACT_SCALE_LEVELS_MAX })
                            : undefined
                        }
                        onClick={() =>
                          setCriterion(index, {
                            ...criterion,
                            scale: [...criterion.scale, newLevel(criterion)],
                          })
                        }
                      >
                        <Plus aria-hidden />
                        {t('addLevel')}
                      </Button>
                    </fieldset>
                  </Card>
                </li>
              );
            })}
          </ol>
          <Button
            variant="outline"
            className="justify-self-start"
            disabledReason={
              draft.criteria.length >= IMPACT_CRITERIA_MAX
                ? t('criteriaMax', { max: IMPACT_CRITERIA_MAX })
                : undefined
            }
            onClick={() =>
              onChange({
                ...draft,
                criteria: [...draft.criteria, newCriterion(draft.criteria.map((item) => item.key))],
              })
            }
          >
            <Plus aria-hidden />
            {t('addCriterion')}
          </Button>
        </TabsPanel>
      </Tabs>
    </div>
  );
}
