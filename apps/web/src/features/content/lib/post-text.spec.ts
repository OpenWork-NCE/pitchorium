import { describe, expect, it } from 'vitest';
import { firstUrl, textSegments } from './post-text';

const kofi = {
  token: '@kofi-mensah',
  type: 'member' as const,
  key: 'kofi-mensah',
  displayName: 'Kofi Mensah',
};

describe('text of a publication', () => {
  it('links the resolved mentions and the addresses, leaves the rest as text', () => {
    expect(
      textSegments('Avec @kofi-mensah, voir https://sahel.example/a?b=1. Et @inconnu.', [kofi]),
    ).toEqual([
      { kind: 'text', text: 'Avec ' },
      { kind: 'mention', text: '@kofi-mensah', mention: kofi },
      { kind: 'text', text: ', voir ' },
      { kind: 'link', text: 'https://sahel.example/a?b=1', href: 'https://sahel.example/a?b=1' },
      { kind: 'text', text: '. Et @inconnu.' },
    ]);
  });

  it('never reads a mention inside an email or a longer key', () => {
    expect(textSegments('ecrire@kofi-mensah.com @kofi-mensahx', [kofi])).toEqual([
      { kind: 'text', text: 'ecrire@kofi-mensah.com @kofi-mensahx' },
    ]);
  });

  it('finds the first address of a text', () => {
    expect(firstUrl('Lisez (https://a.example/x), puis http://b.example')).toBe(
      'https://a.example/x',
    );
    expect(firstUrl('rien')).toBeNull();
  });
});
