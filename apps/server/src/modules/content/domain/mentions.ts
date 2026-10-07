/** Maximum number of distinct mentions resolved in a publication (provisional). */
export const MAX_MENTIONS = 20;

/**
 * `@handle` of a member or `@slug` of an organization: lowercase letters, digits and inner
 * hyphens, 3 to 60 characters, not preceded by a word character (an email is no mention).
 */
const MENTION = /(?<![\p{L}\p{N}_@.-])@([a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,59})(?![a-z0-9_-])/giu;

/** Distinct mentioned keys, lowercase, in order of appearance, at most MAX_MENTIONS. */
export function extractMentionKeys(text: string | null): string[] {
  if (!text) return [];
  const keys: string[] = [];
  for (const match of text.matchAll(MENTION)) {
    const key = match[1]?.toLowerCase();
    if (key && !keys.includes(key)) keys.push(key);
    if (keys.length === MAX_MENTIONS) break;
  }
  return keys;
}

export interface ResolvedMention {
  token: string;
  targetType: 'member' | 'organization';
  targetId: string;
}

/**
 * Resolves keys to stable identifiers: a member handle first, then an organization slug; an
 * unknown key stays plain text.
 */
export function resolveMentions(
  keys: readonly string[],
  members: ReadonlyMap<string, string>,
  organizations: ReadonlyMap<string, string>,
): ResolvedMention[] {
  return keys.flatMap((key): ResolvedMention[] => {
    const memberId = members.get(key);
    if (memberId) return [{ token: `@${key}`, targetType: 'member', targetId: memberId }];
    const organizationId = organizations.get(key);
    if (organizationId) {
      return [{ token: `@${key}`, targetType: 'organization', targetId: organizationId }];
    }
    return [];
  });
}
