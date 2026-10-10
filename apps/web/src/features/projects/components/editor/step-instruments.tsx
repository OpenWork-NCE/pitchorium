'use client';

import { projectsControllerUpdate } from '@pitchorium/api-client';
import type { FundingInstrument } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Callout, Checkbox, Heading, Text } from '@/components/ui';
import { useProblemText } from '../shared/use-problem-text';
import { useProjectEditor } from './editor-context';
import { useAutosave } from './use-autosave';

/**
 * Instruments of §9.1: paid on the platform (donation, crowdfunding with a reward, love money), or
 * an expression of interest only, the rest being agreed outside the platform.
 */
const COLLECTED: readonly FundingInstrument[] = ['donation', 'reward_crowdfunding', 'love_money'];
const INTEREST: readonly FundingInstrument[] = [
  'grant',
  'honor_loan',
  'equity',
  'convertible_bonds',
];

/**
 * Step 6, « Instruments acceptés » (§9.1), and « nous ouvrons le capital », an intention shown on
 * the page, never an investment online (§15 decision 5), its reach explained.
 */
export function StepInstruments() {
  const t = useTranslations('web.projects.editor.instruments');
  const reference = useTranslations('reference.fundingInstruments');
  const problemText = useProblemText();
  const { project, setProject } = useProjectEditor();
  const [instruments, setInstruments] = useState<FundingInstrument[]>(project.funding.instruments);
  const [opensCapital, setOpensCapital] = useState(project.funding.opensCapital);
  const [problem, setProblem] = useState<string | null>(null);
  const { schedule } = useAutosave(async () => {
    if (instruments.length === 0) return false;
    setProblem(null);
    try {
      setProject(await projectsControllerUpdate(project.id, { instruments, opensCapital }));
      return true;
    } catch (error) {
      setProblem(problemText(error));
      throw error;
    }
  });
  const signature = JSON.stringify([instruments, opensCapital]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [signature, schedule]);
  const toggle = (instrument: FundingInstrument, on: boolean) =>
    setInstruments((current) =>
      on ? [...current, instrument] : current.filter((item) => item !== instrument),
    );
  const group = (title: string, hint: string, list: readonly FundingInstrument[]) => (
    <fieldset className="grid gap-3">
      <legend className="grid gap-1">
        <Heading level={2} size="card">
          {title}
        </Heading>
        <Text size="sm" tone="muted">
          {hint}
        </Text>
      </legend>
      {list.map((instrument) => (
        <Checkbox
          key={instrument}
          label={reference(instrument)}
          description={t(`descriptions.${instrument}`)}
          checked={instruments.includes(instrument)}
          onCheckedChange={(checked) => toggle(instrument, checked === true)}
        />
      ))}
    </fieldset>
  );
  return (
    <div className="grid gap-8">
      {group(t('collected'), t('collectedHint'), COLLECTED)}
      {group(t('interest'), t('interestHint'), INTEREST)}
      {instruments.length === 0 ? (
        <p role="alert" className="text-sm text-danger">
          {t('required')}
        </p>
      ) : null}
      <div className="grid gap-3">
        <Checkbox
          label={t('opensCapital')}
          description={t('opensCapitalHint')}
          checked={opensCapital}
          onCheckedChange={(checked) => setOpensCapital(checked === true)}
        />
        <Callout title={t('reachTitle')}>{t('reachBody')}</Callout>
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
