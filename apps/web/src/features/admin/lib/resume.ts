/** Query parameter of the action to resume after a new sign-in (ADR 0172). */
export const RESUME_PARAM = 'resume';

/**
 * The address to come back to after a new sign-in: the same page, with the action to open again
 * (`?resume=<key>`), the other parameters kept.
 */
export function resumeAddress(pathname: string, search: string, key: string): string {
  const params = new URLSearchParams(search);
  params.set(RESUME_PARAM, key);
  return `${pathname}?${params.toString()}`;
}

/** The address without the resume parameter, once the action is open again. */
export function withoutResume(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(RESUME_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

export type RoleIntent = 'grant' | 'revoke';

/** The key of a role to grant or revoke: the new sign-in comes back with that very role. */
export function roleResumeKey(userId: string, intent: RoleIntent, role: string): string {
  return `roles:${userId}:${intent}:${role}`;
}

/** The role and the intent a resume key of this member carries, or null. */
export function parseRoleResume<Role extends string>(
  key: string | null,
  userId: string,
  roles: readonly Role[],
): { intent: RoleIntent; role: Role } | null {
  const match = key?.match(/^roles:([^:]+):(grant|revoke):(\w+)$/);
  if (!match || match[1] !== userId) return null;
  const role = roles.find((value) => value === match[3]);
  return role ? { intent: match[2] as RoleIntent, role } : null;
}
