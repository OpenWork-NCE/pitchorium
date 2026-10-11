/**
 * The next publications attached to a project, read by a member: in its own module, loaded only for
 * the activity of a project, so that the activity of a member or an organization does not carry the
 * projects tag of the api client (ADR 0094).
 */
export { projectsControllerPosts } from '@pitchorium/api-client';
