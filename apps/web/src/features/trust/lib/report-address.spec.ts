import { describe, expect, it } from 'vitest';
import { noticeTargetOf } from './report-address';

const SITE = 'https://pitchorium.example';

describe('noticeTargetOf', () => {
  it('reads the page of a resource from its address, with or without the locale', () => {
    expect(noticeTargetOf(`${SITE}/fr/members/aissatou-ba`, SITE)).toEqual({
      type: 'profile',
      key: 'aissatou-ba',
    });
    expect(noticeTargetOf(`${SITE}/projects/ferme-solaire-thies?contribute=kind`, SITE)).toEqual({
      type: 'project',
      key: 'ferme-solaire-thies',
    });
    expect(noticeTargetOf('/en/posts/0192f4a0-2000-7000-8000-000000000004', SITE)).toEqual({
      type: 'post',
      key: '0192f4a0-2000-7000-8000-000000000004',
    });
  });

  it('refuses another site, another page or a page that is not a resource', () => {
    expect(noticeTargetOf('https://example.org/fr/members/aissatou-ba', SITE)).toBeNull();
    expect(noticeTargetOf(`${SITE}/fr/feed`, SITE)).toBeNull();
    expect(noticeTargetOf(`${SITE}/fr/projects/new`, SITE)).toBeNull();
    expect(
      noticeTargetOf(`${SITE}/fr/messages/0192f4a0-5000-7000-8000-000000000001`, SITE),
    ).toBeNull();
    expect(noticeTargetOf('not an address at all', SITE)).toBeNull();
  });
});
