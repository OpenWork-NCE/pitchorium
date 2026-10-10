'use client';

import type { Project } from '@pitchorium/contracts';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { WizardStep } from '../../lib/wizard-steps';
import { ProjectEditorProvider } from './editor-context';
import { WizardShell } from './wizard-shell';

/*
 * Each step loaded on demand, rendered by the server all the same: the page carries the code of
 * the step of its address only (ADR 0094, ADR 0131).
 */
const StepEssentials = dynamic(() => import('./step-essentials').then((m) => m.StepEssentials));
const StepStory = dynamic(() => import('./step-story').then((m) => m.StepStory));
const StepMedia = dynamic(() => import('./step-media').then((m) => m.StepMedia));
const StepFunding = dynamic(() => import('./step-funding').then((m) => m.StepFunding));
const RewardsPanel = dynamic(() => import('./rewards-panel').then((m) => m.RewardsPanel));
const StepInstruments = dynamic(() => import('./step-instruments').then((m) => m.StepInstruments));
const StepImpact = dynamic(() => import('./step-impact').then((m) => m.StepImpact));
const TeamPanel = dynamic(() => import('./team-panel').then((m) => m.TeamPanel));
const StepPublish = dynamic(() => import('./step-publish').then((m) => m.StepPublish));

/**
 * The assistant of a project (§11.1, ADR 0131): the step of its address in its frame. The
 * preview, rendered by the server as a visitor will read the page, comes in `preview`.
 */
export function ProjectEditor({
  project,
  step,
  preview,
}: {
  project: Project;
  step: WizardStep;
  preview?: ReactNode;
}) {
  return (
    <ProjectEditorProvider initial={project}>
      <WizardShell step={step}>
        {step === 'essentials' ? <StepEssentials /> : null}
        {step === 'story' ? <StepStory /> : null}
        {step === 'media' ? <StepMedia /> : null}
        {step === 'funding' ? <StepFunding /> : null}
        {step === 'rewards' ? <RewardsPanel /> : null}
        {step === 'instruments' ? <StepInstruments /> : null}
        {step === 'impact' ? <StepImpact /> : null}
        {step === 'team' ? <TeamPanel /> : null}
        {step === 'preview' ? preview : null}
        {step === 'publish' ? <StepPublish /> : null}
      </WizardShell>
    </ProjectEditorProvider>
  );
}
