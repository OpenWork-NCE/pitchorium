import type { Project } from '@pitchorium/contracts';

/**
 * Steps of the creation of a project (§11.1, ADR 0131), each at its own address
 * (`/projects/{slug}/edit/{step}`): the draft is kept by the api as it is written.
 */
export const WIZARD_STEPS = [
  'essentials',
  'story',
  'media',
  'funding',
  'rewards',
  'instruments',
  'impact',
  'team',
  'preview',
  'publish',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Steps the publication needs: the others may stay empty. */
const REQUIRED: readonly WizardStep[] = ['essentials', 'story', 'funding', 'instruments', 'impact'];

export function isWizardStep(value: string): value is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

export function neighbours(step: WizardStep): {
  previous: WizardStep | null;
  next: WizardStep | null;
} {
  const index = WIZARD_STEPS.indexOf(step);
  return {
    previous: WIZARD_STEPS[index - 1] ?? null,
    next: WIZARD_STEPS[index + 1] ?? null,
  };
}

type DraftView = Pick<
  Project,
  | 'title'
  | 'summary'
  | 'sectorCode'
  | 'countryCodes'
  | 'impactArea'
  | 'description'
  | 'funding'
  | 'tiers'
  | 'impactAssessment'
  | 'management'
  | 'status'
>;

/** True when a step holds what the publication needs from it (an optional step always does). */
export function stepComplete(step: WizardStep, project: DraftView): boolean {
  switch (step) {
    case 'essentials':
      return Boolean(
        project.title &&
        project.summary &&
        project.sectorCode &&
        project.countryCodes.length > 0 &&
        project.impactArea,
      );
    case 'story':
      return Boolean(project.description);
    case 'funding':
      return (
        project.funding.goal !== null &&
        Boolean(project.management?.durationDays) &&
        project.tiers.length > 0
      );
    case 'instruments':
      return project.funding.instruments.length > 0;
    case 'impact':
      return !project.management?.impactAssessmentRequired || project.impactAssessment !== null;
    case 'publish':
      return project.status !== 'draft';
    case 'media':
    case 'rewards':
    case 'team':
    case 'preview':
      return true;
  }
}

/**
 * Where a draft resumes: its first required step still incomplete, the preview once everything
 * the publication needs is there.
 */
export function resumeStep(project: DraftView): WizardStep {
  return REQUIRED.find((step) => !stepComplete(step, project)) ?? 'preview';
}

/** Required steps still incomplete, for the publication step. */
export function missingSteps(project: DraftView): WizardStep[] {
  return REQUIRED.filter((step) => !stepComplete(step, project));
}
