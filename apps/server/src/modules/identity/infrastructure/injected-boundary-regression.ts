// Injected regression (boundary): identity reads the database schema of profiles.
import { profilesSchema } from '@pitchorium/db/schemas/profiles';

export const injectedBoundaryRegression = profilesSchema;
