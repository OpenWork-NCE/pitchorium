import { describe, expect, it } from 'vitest';
import { challengeUrl } from './second-factor';

const WEB = 'https://app.pitchorium.test';

describe('challengeUrl', () => {
  it('sends a sign-in that lands on /continue to the page of the code, in its locale', () => {
    expect(challengeUrl(`${WEB}/fr/continue?redirectTo=%2Ffr%2Ffeed`, WEB)).toBe(
      `${WEB}/fr/sign-in/two-factor?redirectTo=%2Ffr%2Ffeed`,
    );
  });

  it('keeps any other page of the web app as the page to land on', () => {
    expect(challengeUrl(`${WEB}/en/settings/security`, WEB)).toBe(
      `${WEB}/en/sign-in/two-factor?redirectTo=%2Fen%2Fsettings%2Fsecurity`,
    );
    expect(challengeUrl(`${WEB}/home`, WEB)).toBe(`${WEB}/sign-in/two-factor?redirectTo=%2Fhome`);
  });

  it('never carries an address of another origin', () => {
    expect(challengeUrl('https://elsewhere.test/fr/feed', WEB)).toBe(`${WEB}/sign-in/two-factor`);
    expect(challengeUrl(null, WEB)).toBe(`${WEB}/sign-in/two-factor`);
  });
});
