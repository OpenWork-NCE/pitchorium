'use client';

import dynamic from 'next/dynamic';

/**
 * Tools of the owner of a profile, loaded on demand: the page of a member serves visitors too,
 * who never download the editors (ADR 0094, ADR 0101). One module, so that the buttons and the
 * provider share its context.
 */
export const ProfileEditorProvider = dynamic(() =>
  import('./profile-editor').then((module) => module.ProfileEditorProvider),
);
export const EditButton = dynamic(() =>
  import('./profile-editor').then((module) => module.EditButton),
);
export const ProfileStrength = dynamic(() =>
  import('./profile-strength').then((module) => module.ProfileStrength),
);
