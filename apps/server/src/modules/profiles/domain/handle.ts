import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, HANDLE_PATTERN } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

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

const FALLBACK_BASE = 'member';
/** Leaves room for a `-NNNNNN` suffix. */
const BASE_MAX_LENGTH = HANDLE_MAX_LENGTH - 7;

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
  const full = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let slug = full.slice(0, BASE_MAX_LENGTH).replace(/-+$/g, '');
  // Cut at a word boundary rather than in the middle of a word, when one is available.
  if (full.length > BASE_MAX_LENGTH && full[BASE_MAX_LENGTH] !== '-') {
    const boundary = slug.lastIndexOf('-');
    if (boundary >= HANDLE_MIN_LENGTH) slug = slug.slice(0, boundary);
  }
  if (slug.length < HANDLE_MIN_LENGTH || isReservedHandle(slug)) return FALLBACK_BASE;
  return slug;
}

export function handleWithSuffix(base: string, suffix: number): string {
  return `${base}-${suffix}`;
}
