import 'server-only';
import { cache } from 'react';
import { makeQueryClient } from './query-client';

/** QueryClient of the current request, shared by the Server Components that prefetch. */
export const getServerQueryClient = cache(makeQueryClient);
