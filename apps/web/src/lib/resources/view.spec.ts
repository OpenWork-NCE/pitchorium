import { ApiProblemError } from '@pitchorium/api-client';
import { describe, expect, it, vi } from 'vitest';
import { readResource, robotsOf } from './view';

type ErrorCode = ConstructorParameters<typeof ApiProblemError>[0]['code'];
const problem = (status: number, code: ErrorCode) =>
  new ApiProblemError({ type: 'about:blank', title: code, status, code }, 'ref');

describe('rendering of a resource by session', () => {
  it('reads the public view for a visitor, the member view for a member', async () => {
    const forMember = vi.fn(() => Promise.resolve('member data'));
    const forVisitor = vi.fn(() => Promise.resolve('public data'));
    expect(await readResource({ signedIn: false, forMember, forVisitor })).toEqual({
      view: 'visitor',
      data: 'public data',
    });
    expect(forMember).not.toHaveBeenCalled();
    expect(await readResource({ signedIn: true, forMember, forVisitor })).toEqual({
      view: 'member',
      data: 'member data',
    });
  });

  it('has nothing for a visitor when the resource is not public: the page answers 404', async () => {
    const forVisitor = () => Promise.reject(problem(404, 'PROJECTS_NOT_FOUND'));
    const forMember = () => Promise.resolve('draft shown to its team');
    expect(await readResource({ signedIn: false, forMember, forVisitor })).toBeNull();
    // The same address shows it to a member allowed to read it.
    expect(await readResource({ signedIn: true, forMember, forVisitor })).toMatchObject({
      view: 'member',
    });
    // A member who may not see it gets the same 404.
    expect(
      await readResource({
        signedIn: true,
        forMember: () => Promise.reject(problem(403, 'FORBIDDEN')),
        forVisitor,
      }),
    ).toBeNull();
  });

  it('lets any other failure reach the error page', async () => {
    await expect(
      readResource({
        signedIn: false,
        forMember: () => Promise.resolve(null),
        forVisitor: () => Promise.reject(problem(503, 'SERVICE_UNAVAILABLE')),
      }),
    ).rejects.toBeInstanceOf(ApiProblemError);
  });

  it('indexes the public view only', () => {
    expect(robotsOf('visitor')).toEqual({ index: true, follow: true });
    expect(robotsOf('member')).toEqual({ index: false, follow: false });
  });
});
