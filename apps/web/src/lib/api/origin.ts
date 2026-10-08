import 'server-only';
import { env } from '@/lib/env';

/** Origin of the api for calls made by the Next.js server (proxy, Server Components). */
export function serverApiOrigin(): string {
  return env.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL;
}
