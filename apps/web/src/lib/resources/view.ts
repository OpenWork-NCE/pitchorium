import { ApiProblemError } from '@pitchorium/api-client';

/**
 * Rendering rules of a page of a resource (ADR 0101): one address for visitors and members. A
 * member reads the resource as a member (`GET /v1/<resource>/...`, enriched, or a resource only
 * members may see); a visitor reads its public view (`GET /v1/public/...`), indexable. A resource
 * the reader may not see does not exist for them: the page answers 404.
 */
export type ResourceView<T> = { view: 'member' | 'visitor'; data: T };

interface ResourceReads<T> {
  /** A member is signed in (the session read by the layout). */
  signedIn: boolean;
  forMember: () => Promise<T>;
  forVisitor: () => Promise<T>;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof ApiProblemError &&
    // Absent, or not visible to this reader: the api answers 404 (403 for a forbidden read).
    (error.problem.status === 404 || error.problem.status === 403)
  );
}

/** The view of the reader, null when the resource does not exist for them. */
export async function readResource<T>({
  signedIn,
  forMember,
  forVisitor,
}: ResourceReads<T>): Promise<ResourceView<T> | null> {
  const view = signedIn ? 'member' : 'visitor';
  try {
    return { view, data: await (signedIn ? forMember() : forVisitor()) };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Indexing of a page of a resource: the public view only (the member view is never crawled). */
export function robotsOf(view: ResourceView<unknown>['view']): { index: boolean; follow: boolean } {
  return view === 'visitor' ? { index: true, follow: true } : { index: false, follow: false };
}
