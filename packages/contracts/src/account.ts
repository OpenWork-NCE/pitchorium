import { z } from 'zod';
import { roleSchema, trustLevelsSchema } from './access.js';
import { legalStatusSchema } from './identity.js';
import { uuidV7Schema } from './ids.js';
import { localeSchema } from './locale.js';
import { profileStrengthSchema, profileSummarySchema } from './profiles.js';

/** GET /v1/me: everything the web app needs after sign-in, in one call. */
export const currentUserSchema = z.object({
  user: z.object({
    id: uuidV7Schema,
    email: z.email(),
    emailVerified: z.boolean(),
    name: z.string(),
    image: z.string().nullable(),
    twoFactorEnabled: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
  preferences: z.object({ locale: localeSchema }),
  /** Locales whose feature flag is enabled. */
  activeLocales: z.array(localeSchema),
  legal: legalStatusSchema,
  /** Always contains `member`. */
  roles: z.array(roleSchema),
  trust: trustLevelsSchema,
  profile: profileSummarySchema,
  profileStrength: profileStrengthSchema,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
