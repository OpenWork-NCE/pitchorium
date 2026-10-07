import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, HANDLE_PATTERN } from '@pitchorium/contracts';
import { DomainError, slugify } from '../../../platform/kernel';

/**
 * Words that would collide with routes, roles or impersonate the platform. Lower case; a handle
 * is reserved when it equals one of them.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'about',
  'account',
  'accounts',
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'contact',
  'discover',
  'docs',
  'events',
  'explore',
  'feed',
  'help',
  'home',
  'legal',
  'login',
  'logout',
  'me',
  'messages',
  'moderator',
  'network',
  'notifications',
  'organizations',
  'pitchorium',
  'privacy',
  'profile',
  'profiles',
  'projects',
  'public',
  'root',
  'search',
  'security',
  'settings',
  'signin',
  'signup',
  'staff',
  'support',
  'system',
  'terms',
  'www',
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle);
}

/** Format is validated by the contract; the reserved list is a business rule. */
export function assertHandleAllowed(handle: string): void {
  if (!HANDLE_PATTERN.test(handle)) {
    throw new DomainError('VALIDATION_FAILED', 'Malformed handle');
  }
  if (isReservedHandle(handle)) {
    throw new DomainError('PROFILES_HANDLE_RESERVED', 'Handle is reserved');
  }
}

/** `Aminata Diallo-Ndiaye` gives `aminata-diallo-ndiaye`; accents are dropped. */
export function handleBaseFromName(name: string): string {
  return slugify(name, {
    minLength: HANDLE_MIN_LENGTH,
    maxLength: HANDLE_MAX_LENGTH,
    fallback: 'member',
    reserved: RESERVED_HANDLES,
  });
}
