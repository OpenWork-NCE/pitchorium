/**
 * Schemas of the forms of the assistant and of the management of a project, loaded with Zod once
 * the page is idle or at the first check: neither is part of the first load (ADR 0094).
 */
const contracts = () => import('@pitchorium/contracts');

/** The essentials: a title, the other fields optional while the draft is written. */
export const essentialsSchema = () =>
  contracts().then(({ createProjectRequestSchema }) =>
    createProjectRequestSchema.pick({
      title: true,
      summary: true,
      sectorCode: true,
      countryCodes: true,
      impactArea: true,
      organizationId: true,
    }),
  );

export const rewardSchema = () =>
  contracts().then(({ createRewardRequestSchema }) => createRewardRequestSchema);

export const inviteSchema = () =>
  contracts().then(({ inviteTeamMemberRequestSchema }) => inviteTeamMemberRequestSchema);

export const updateSchema = () =>
  contracts().then(({ createProjectUpdateRequestSchema }) =>
    createProjectUpdateRequestSchema.pick({ text: true }),
  );

export const storySchema = () =>
  contracts().then(({ createProjectRequestSchema }) =>
    createProjectRequestSchema.pick({ description: true }),
  );
