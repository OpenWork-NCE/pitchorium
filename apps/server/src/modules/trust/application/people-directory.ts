import { Injectable } from '@nestjs/common';
import type { ModerationPerson } from '@pitchorium/contracts';
import { IdentityFacade } from '../../identity';
import { ProfilesFacade } from '../../profiles';

/**
 * The members a case names (subject, reporters, moderators), as the moderation reads them: the
 * name of the account and the handle of the profile. A member deleted since is left out: the
 * console says « Membre supprimé ».
 */
@Injectable()
export class PeopleDirectory {
  constructor(
    private readonly identity: IdentityFacade,
    private readonly profiles: ProfilesFacade,
  ) {}

  async people(userIds: readonly (string | null)[]): Promise<Map<string, ModerationPerson>> {
    const ids = [...new Set(userIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const [users, cards] = await Promise.all([
      this.identity.findUsers(ids),
      this.profiles.memberCards(ids),
    ]);
    return new Map(
      [...users.values()].map((user) => [
        user.id,
        { userId: user.id, name: user.name, handle: cards.get(user.id)?.handle ?? null },
      ]),
    );
  }
}
