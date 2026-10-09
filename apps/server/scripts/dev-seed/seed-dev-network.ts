import type { INestApplicationContext } from '@nestjs/common';
import { BlocksService } from '../../src/modules/network/application/blocks.service';
import { ProfileViewBuffer } from '../../src/modules/network/application/ports';
import { ProfileViewsService } from '../../src/modules/network/application/profile-views.service';
import { InvitationsService } from '../../src/modules/organizations/application/invitations.service';
import { VerificationService } from '../../src/modules/organizations/application/verification.service';
import { ProfilesService } from '../../src/modules/profiles/application/profiles.service';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { DEMO_MEMBERS } from './dataset';
import { DEMO_EMAIL_DOMAIN, demoId } from './seed-dev-data';

const DAY_MS = 86_400_000;

export interface DevNetworkResult {
  verifications: number;
  invitations: number;
  blocks: number;
  profileViews: number;
}

/** Address of an invitation to a person without an account (the email arrives in Mailpit). */
export const DEMO_EXTERNAL_INVITEE = `partenaire@${DEMO_EMAIL_DOMAIN}`;

/**
 * The network and the organisations as the pages of PROMPT FRONT 3 show them, through the
 * services of network, organizations and profiles (ADR 0035): a verified organisation, one whose
 * request is pending, one refused with its reason; pending invitations (a member, a person
 * without an account); blocks; private visits and lists; visits of profiles, pushed to the
 * buffer that the worker writes within a minute. Skipped when the verifications exist.
 *
 * The demonstration requests carry no supporting document: the media would only be ready once
 * the worker has processed them; a real request requires one (contract, module media).
 */
export async function seedDevNetwork(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date = new Date(),
): Promise<DevNetworkResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const organizationId = (key: string) => demoId(`organization:${key}`);
  const member = (key: string) => {
    const found = DEMO_MEMBERS.find((candidate) => candidate.key === key);
    if (!found) throw new Error(`Unknown demo member ${key}`);
    return found;
  };
  const emailOf = (key: string) =>
    `${member(key).handle.replaceAll('-', '.')}@${DEMO_EMAIL_DOMAIN}`;
  const at = (days: number) => clock.set(new Date(now.getTime() - days * DAY_MS));
  const result: DevNetworkResult = { verifications: 0, invitations: 0, blocks: 0, profileViews: 0 };

  const verification = get(VerificationService);
  if ((await verification.history(organizationId('teranga'))).items.length > 0) return result;

  // Fondation Teranga verified, the Sahel network refused with its reason, Diaspora Invest pending.
  const decided = [
    {
      organization: 'teranga',
      owner: 'nadia',
      declaration:
        'Fondation reconnue d’utilité publique au Sénégal depuis 2016 ; je la préside et la représente.',
      decision: 'approved' as const,
      reason: 'Statuts et récépissé de déclaration conformes ; mandat de la présidente établi.',
    },
    {
      organization: 'femmes-sahel',
      owner: 'aissatou',
      declaration:
        'Association de 600 entrepreneures au Sénégal, au Mali et au Niger ; j’en suis la coordinatrice.',
      decision: 'rejected' as const,
      reason:
        'Le récépissé joint est illisible et le mandat de la coordinatrice n’est pas établi : joignez le procès-verbal de l’assemblée qui l’a désignée.',
    },
  ];
  for (const [index, entry] of decided.entries()) {
    at(12 - index * 3);
    const request = await verification.request(
      organizationId(entry.organization),
      userId(entry.owner),
      {
        declaration: entry.declaration,
        certified: true,
        documentMediaIds: [],
      },
    );
    at(10 - index * 3);
    await verification.decide(request.id, userId('claudine'), {
      decision: entry.decision,
      reason: entry.reason,
      criteriaMet: [],
    });
    result.verifications += 1;
  }
  at(2);
  await verification.request(organizationId('diaspora-invest'), userId('thierry'), {
    declaration:
      'Club d’investisseurs immatriculé en Martinique en 2019 ; je suis son gérant et son fondateur.',
    certified: true,
    documentMediaIds: [],
  });
  result.verifications += 1;

  // Pending invitations: a member (Grace, to Diaspora Invest) and a person without an account.
  at(1);
  const invitations = get(InvitationsService);
  await invitations.invite(organizationId('diaspora-invest'), userId('thierry'), {
    email: emailOf('grace'),
    role: 'member',
  });
  await invitations.invite(organizationId('teranga'), userId('nadia'), {
    email: DEMO_EXTERNAL_INVITEE,
    role: 'admin',
  });
  result.invitations = 2;

  // Blocks: Fatou blocked Rodrigue, Samuel blocked Moussa.
  const blocks = get(BlocksService);
  for (const [blocker, blocked] of [
    ['fatou', 'rodrigue'],
    ['samuel', 'moussa'],
  ] as const) {
    await blocks.block(userId(blocker), member(blocked).handle);
    result.blocks += 1;
  }

  // Privacy: Moussa visits privately, Kofi keeps his network lists to himself, Ama the details
  // of her entrepreneur facet.
  await get(ProfileViewsService).updateSettings(userId('moussa'), { privateProfileViews: true });
  const profiles = get(ProfilesService);
  await profiles.updateVisibility(userId('kofi'), { networkLists: 'private' });
  await profiles.updateVisibility(userId('ama'), { entrepreneurDetails: 'private' });

  // Visits of the profiles of Aïssatou and Kofi over the last 90 days.
  const buffer = get(ProfileViewBuffer);
  const visits: readonly [viewer: string, viewed: string, daysAgo: number][] = [
    ['kofi', 'aissatou', 1],
    ['moussa', 'aissatou', 2],
    ['nadia', 'aissatou', 4],
    ['thierry', 'aissatou', 9],
    ['grace', 'aissatou', 15],
    ['marieclaire', 'aissatou', 26],
    ['jeanbaptiste', 'aissatou', 41],
    ['claudine', 'aissatou', 63],
    ['aissatou', 'kofi', 3],
    ['moussa', 'kofi', 6],
    ['ama', 'kofi', 33],
  ];
  for (const [viewer, viewed, daysAgo] of visits) {
    const day = new Date(now.getTime() - daysAgo * DAY_MS);
    await buffer.push({
      viewerId: userId(viewer),
      viewedId: userId(viewed),
      day: day.toISOString().slice(0, 10),
      at: day.toISOString(),
    });
    result.profileViews += 1;
  }
  clock.set(now);
  return result;
}
