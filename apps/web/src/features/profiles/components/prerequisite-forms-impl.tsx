'use client';

import type { PrerequisiteFormProps } from '@/features/access';
import { ContributorForm } from './editors/contributor-form';
import { EntrepreneurForm } from './editors/entrepreneur-form';

/** The entrepreneur facet created in place: the minimal one is enough to go on. */
function EntrepreneurFacetForm({ onDone }: PrerequisiteFormProps) {
  return <EntrepreneurForm facet={null} onSaved={onDone} />;
}

/** The contributor facet created in place: hats and type of structure are enough to go on. */
function ContributorFacetForm({ onDone }: PrerequisiteFormProps) {
  return <ContributorForm facet={null} onSaved={onDone} />;
}

export { ContributorFacetForm, EntrepreneurFacetForm };
