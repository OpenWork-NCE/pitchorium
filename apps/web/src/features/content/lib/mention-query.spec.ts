import { describe, expect, it } from 'vitest';
import { insertMention, mentionQueryAt } from './mention-query';

describe('mention typed in a comment', () => {
  it('finds the mention at the caret', () => {
    expect(mentionQueryAt('Merci @Kof', 10)).toEqual({ start: 6, query: 'kof' });
    expect(mentionQueryAt('@ama', 4)).toEqual({ start: 0, query: 'ama' });
  });

  it('ignores an email, a lone @ and a caret elsewhere', () => {
    expect(mentionQueryAt('ecrire@kofi', 11)).toBeNull();
    expect(mentionQueryAt('Merci @', 7)).toBeNull();
    expect(mentionQueryAt('Merci @kofi et', 14)).toBeNull();
  });

  it('puts the key and a space in place of what was typed', () => {
    const text = 'Merci @kof pour tout';
    const query = mentionQueryAt(text, 10)!;
    expect(insertMention(text, query, 10, 'kofi-mensah')).toEqual({
      text: 'Merci @kofi-mensah pour tout',
      caret: 19,
    });
  });
});
