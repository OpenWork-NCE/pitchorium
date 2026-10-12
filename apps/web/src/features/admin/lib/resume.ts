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
