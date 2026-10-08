import 'server-only';
import { type CountersDtoOutput, notificationsControllerCounters } from '@pitchorium/api-client';
import { configureServerApi } from '@/lib/api/server';

/** The counters of the header, read with the member; the client reads them again if missing. */
export async function initialCounters(): Promise<CountersDtoOutput | null> {
  configureServerApi();
  try {
    return await notificationsControllerCounters({ cache: 'no-store' });
  } catch {
    return null;
  }
}
