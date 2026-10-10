import { createHash } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { v7 } from 'uuid';
import { type Database, outboxEvents } from '@pitchorium/db';
import {
  contentComments,
  contentPostMentions,
  contentPosts,
  contentReactions,
} from '@pitchorium/db/schemas/content';
import {
  identityAccounts,
  identityLegalAcceptances,
  identityUsers,
} from '@pitchorium/db/schemas/identity';
import { mediaAssets } from '@pitchorium/db/schemas/media';
import {
  networkConnectionRequests,
  networkConnections,
  networkFollows,
} from '@pitchorium/db/schemas/network';
import {
  organizationsMembers,
  organizationsOrganizations,
} from '@pitchorium/db/schemas/organizations';
import {
  profilesContributorFacets,
  profilesEntrepreneurFacets,
  profilesProfiles,
} from '@pitchorium/db/schemas/profiles';
import type { ObjectStorage } from '../../src/platform/storage';
import {
  DEMO_COMMENTS,
  DEMO_CONNECTIONS,
  DEMO_FOLLOWS,
  DEMO_MEMBERS,
  DEMO_ORGANIZATIONS,
  DEMO_PENDING_REQUESTS,
  DEMO_POSTS,
  DEMO_REACTIONS,
  type DemoMember,
} from './dataset';
import { demoDocument, demoImage, type DemoImageKind } from './images';

/** Password of every demonstration account; development data only (refused in production). */
export const DEMO_PASSWORD = 'pitchorium-demo-2026';
export const DEMO_EMAIL_DOMAIN = 'demo.pitchorium.test';
/** Version of the age declaration recorded by the identity module. */
const AGE_DECLARATION_VERSION = '18+';
const SEED_EPOCH_MS = Date.UTC(2026, 8, 1);
const DAY_MS = 86_400_000;

export interface DevSeedOptions {
  db: Database;
  storage: ObjectStorage;
  legal: { termsVersion: string; privacyVersion: string };
  /** Reference date of the relative dates of the data (now by default). */
  now?: Date;
}

/** Rows inserted by this run; a second run inserts nothing. */
export interface DevSeedResult {
  members: number;
  organizations: number;
  media: number;
  connections: number;
  follows: number;
  posts: number;
  comments: number;
  reactions: number;
}

/**
 * Deterministic UUIDv7: fixed timestamp, random bits from a digest of the key, so that every
 * run gives the same identifiers and the inserts are idempotent.
 */
export function demoId(key: string): string {
  const digest = createHash('sha256').update(`pitchorium-demo:${key}`).digest('hex');
  const time = SEED_EPOCH_MS.toString(16).padStart(12, '0');
  const variant = ((Number.parseInt(digest.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  const hex = `${time}7${digest.slice(0, 3)}${variant}${digest.slice(4, 19)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const emailOf = (member: DemoMember) =>
  `${member.handle.replaceAll('-', '.')}@${DEMO_EMAIL_DOMAIN}`;

export interface PendingImage {
  id: string;
  /** A document is a PDF of `pages` pages; every other kind a PNG. */
  kind: DemoImageKind | 'document';
  pages?: number;
  hue: number;
  variant: number;
  usage: string;
  visibility: 'public' | 'private';
  resource: { type: string; id: string };
}

/**
 * Demonstration members, organizations, network and publications (`pnpm db:seed:dev`), written
 * directly in the tables of each module: the script is a development tool, outside the module
 * boundaries. Data added since then goes through the module services (ADR 0035). Images and
 * documents are uploaded to the quarantine with `media.asset.uploaded.v1`: the worker processes
 * them like real uploads when it runs (a service would refuse a file not processed yet).
 * Idempotent: existing rows are kept.
 */
export async function seedDevData(options: DevSeedOptions): Promise<DevSeedResult> {
  const { db, storage, legal } = options;
  const now = options.now ?? new Date();
  const result: DevSeedResult = {
    members: 0,
    organizations: 0,
    media: 0,
    connections: 0,
    follows: 0,
    posts: 0,
    comments: 0,
    reactions: 0,
  };
  const userId = (key: string) => demoId(`member:${key}`);
  const organizationId = (key: string) => demoId(`organization:${key}`);
  const postId = (key: string) => demoId(`post:${key}`);
  const commentId = (key: string) => demoId(`comment:${key}`);
  const images: PendingImage[] = [];
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    for (const member of DEMO_MEMBERS) {
      const id = userId(member.key);
      const avatar: PendingImage = {
        id: demoId(`avatar:${member.key}`),
        kind: 'avatar',
        hue: member.hue,
        variant: 0,
        usage: 'avatar',
        visibility: member.publicPage ? 'public' : 'private',
        resource: { type: 'profile', id },
      };
      const cover: PendingImage = {
        ...avatar,
        id: demoId(`cover:${member.key}`),
        kind: 'cover',
        usage: 'profile_cover',
      };
      images.push(avatar, cover);
      const inserted = await tx
        .insert(identityUsers)
        .values({
          id,
          name: member.name,
          email: emailOf(member),
          emailVerified: true,
          locale: member.locale,
          acceptedTermsVersion: legal.termsVersion,
          acceptedPrivacyVersion: legal.privacyVersion,
          adultDeclaredAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: identityUsers.id });
      if (inserted.length === 0) continue;
      result.members += 1;
      await tx.insert(identityAccounts).values({
        id: demoId(`account:${member.key}`),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      // Fresh identifiers: the erasure of an account keeps its acceptances under a pseudonym
      // (identity README), so a demonstration member erased then seeded again needs new ones.
      await tx.insert(identityLegalAcceptances).values(
        [
          { document: 'terms_of_service', version: legal.termsVersion },
          { document: 'privacy_policy', version: legal.privacyVersion },
          { document: 'age_declaration', version: AGE_DECLARATION_VERSION },
        ].map((row) => ({
          id: v7(),
          userId: id,
          ...row,
          acceptedAt: now,
        })),
      );
      await tx.insert(profilesProfiles).values({
        userId: id,
        handle: member.handle,
        displayName: member.name,
        headline: member.headline,
        bio: member.bio,
        countryCode: member.countryCode,
        city: member.city,
        languages: member.languages,
        avatarMediaId: avatar.id,
        coverMediaId: cover.id,
        publicPageEnabled: member.publicPage,
        entrepreneurDetailsVisibility: 'members',
        contributorDetailsVisibility: 'members',
        networkListsVisibility: 'members',
        createdAt: now,
        updatedAt: now,
      });
      if (member.entrepreneur) {
        const facet = member.entrepreneur;
        await tx.insert(profilesEntrepreneurFacets).values({
          userId: id,
          companyName: facet.companyName,
          sectorCode: facet.sectorCode,
          stageCode: facet.stageCode,
          companyCountryCode: facet.companyCountryCode,
          companyCity: facet.companyCity,
          teamSize: facet.teamSize,
          foundedYear: facet.foundedYear,
          pitch: facet.pitch,
          needs: facet.needs,
          soughtExpertise: [],
          fundingTargetMinor: facet.fundingTarget?.amountMinor ?? null,
          fundingTargetCurrency: facet.fundingTarget?.currency ?? null,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (member.contributor) {
        const facet = member.contributor;
        await tx.insert(profilesContributorFacets).values({
          userId: id,
          hats: facet.hats,
          structureType: facet.structureType,
          organizationId: facet.organizationKey ? organizationId(facet.organizationKey) : null,
          interventionCountryCodes: facet.interventionCountryCodes,
          sectorCodes: facet.sectorCodes,
          ticketMinMinor: facet.ticket?.min ?? null,
          ticketMaxMinor: facet.ticket?.max ?? null,
          ticketCurrency: facet.ticket?.currency ?? null,
          acceptedInstruments: facet.acceptedInstruments,
          patronageTypes: facet.patronageTypes,
          mentoringAvailable: facet.mentoringAvailable,
          openToExpertMissions: facet.openToExpertMissions,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const organization of DEMO_ORGANIZATIONS) {
      const id = organizationId(organization.key);
      const logo: PendingImage = {
        id: demoId(`logo:${organization.key}`),
        kind: 'logo',
        hue: organization.hue,
        variant: 1,
        usage: 'organization_logo',
        visibility: 'public',
        resource: { type: 'organization', id },
      };
      images.push(logo);
      const inserted = await tx
        .insert(organizationsOrganizations)
        .values({
          id,
          slug: organization.slug,
          name: organization.name,
          structureType: organization.structureType,
          description: organization.description,
          countryCodes: organization.countryCodes,
          sectorCodes: organization.sectorCodes,
          websiteUrl: organization.websiteUrl,
          foundedYear: organization.foundedYear,
          logoMediaId: logo.id,
          verificationStatus: 'unverified',
          createdBy: userId(organization.owner),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: organizationsOrganizations.id });
      if (inserted.length === 0) continue;
      result.organizations += 1;
      const roles = [
        [organization.owner, 'owner'],
        ...organization.admins.map((key) => [key, 'admin']),
        ...organization.members.map((key) => [key, 'member']),
      ] as const;
      await tx.insert(organizationsMembers).values(
        roles.map(([key, role]) => ({
          organizationId: id,
          userId: userId(key),
          role,
          joinedAt: now,
        })),
      );
    }

    for (const [a, b] of DEMO_CONNECTIONS) {
      const at = new Date(now.getTime() - 20 * DAY_MS);
      const inserted = await tx
        .insert(networkConnections)
        .values([
          { userId: userId(a), peerId: userId(b), connectedAt: at },
          { userId: userId(b), peerId: userId(a), connectedAt: at },
        ])
        .onConflictDoNothing()
        .returning({ userId: networkConnections.userId });
      if (inserted.length === 0) continue;
      result.connections += 1;
      await tx.insert(networkConnectionRequests).values({
        id: demoId(`request:${a}:${b}`),
        requesterId: userId(a),
        addresseeId: userId(b),
        note: null,
        status: 'accepted',
        createdAt: new Date(at.getTime() - DAY_MS),
        expiresAt: new Date(at.getTime() + 29 * DAY_MS),
        respondedAt: at,
      });
      result.follows += (
        await tx
          .insert(networkFollows)
          .values([
            {
              followerId: userId(a),
              targetType: 'member',
              targetId: userId(b),
              origin: 'connection',
              createdAt: at,
            },
            {
              followerId: userId(b),
              targetType: 'member',
              targetId: userId(a),
              origin: 'connection',
              createdAt: at,
            },
          ])
          .onConflictDoNothing()
          .returning({ followerId: networkFollows.followerId })
      ).length;
    }
    for (const follow of DEMO_FOLLOWS) {
      result.follows += (
        await tx
          .insert(networkFollows)
          .values({
            followerId: userId(follow.follower),
            targetType: follow.member ? 'member' : 'organization',
            targetId: follow.member
              ? userId(follow.member)
              : organizationId(follow.organization ?? ''),
            origin: 'manual',
            createdAt: new Date(now.getTime() - 10 * DAY_MS),
          })
          .onConflictDoNothing()
          .returning({ followerId: networkFollows.followerId })
      ).length;
    }
    for (const request of DEMO_PENDING_REQUESTS) {
      await tx
        .insert(networkConnectionRequests)
        .values({
          id: demoId(`request:${request.from}:${request.to}`),
          requesterId: userId(request.from),
          addresseeId: userId(request.to),
          note: request.note,
          status: 'pending',
          createdAt: new Date(now.getTime() - DAY_MS),
          expiresAt: new Date(now.getTime() + 29 * DAY_MS),
        })
        .onConflictDoNothing();
    }

    const handles = new Map(DEMO_MEMBERS.map((member) => [member.handle, userId(member.key)]));
    for (const post of DEMO_POSTS) {
      const id = postId(post.key);
      const createdAt = new Date(now.getTime() - post.daysAgo * DAY_MS - 3_600_000);
      const hue = DEMO_MEMBERS.find((member) => member.key === post.author)?.hue ?? 0;
      const imageIds = Array.from({ length: post.images ?? 0 }, (_, index) => {
        const image: PendingImage = {
          id: demoId(`post-image:${post.key}:${index}`),
          kind: 'post',
          hue,
          variant: index + 2,
          usage: 'post_image',
          visibility: post.visibility === 'public' ? 'public' : 'private',
          resource: { type: 'post', id },
        };
        images.push(image);
        return image.id;
      });
      const documentId = post.document ? demoId(`post-document:${post.key}`) : null;
      if (post.document && documentId) {
        images.push({
          id: documentId,
          kind: 'document',
          pages: post.document.pages,
          hue,
          variant: 0,
          usage: 'post_document',
          visibility: 'private',
          resource: { type: 'post', id },
        });
      }
      const inserted = await tx
        .insert(contentPosts)
        .values({
          id,
          authorId: userId(post.author),
          organizationId: post.organization ? organizationId(post.organization) : null,
          kind: post.repostOf ? 'repost' : 'post',
          text: post.text ?? null,
          language: post.text ? languageOf(post.text) : null,
          languageSource: post.text ? 'detected' : 'undetermined',
          visibility: post.visibility,
          repostOfId: post.repostOf ? postId(post.repostOf) : null,
          imageMediaIds: imageIds,
          imageAlts: Object.fromEntries(
            (post.alts ?? []).flatMap((alt, index) =>
              imageIds[index] ? [[imageIds[index], alt]] : [],
            ),
          ),
          documentMediaId: documentId,
          documentTitle: post.document?.title ?? null,
          linkUrl: post.link?.url ?? null,
          linkPreview: post.link
            ? {
                status: 'ready',
                title: post.link.title,
                description: post.link.description,
                siteName: post.link.siteName,
                imageMediaId: null,
              }
            : null,
          commentsDisabled: false,
          moderationStatus: 'visible',
          featuredAt: post.featured ? createdAt : null,
          createdAt,
        })
        .onConflictDoNothing()
        .returning({ id: contentPosts.id });
      if (inserted.length === 0) continue;
      result.posts += 1;
      const mentions = [...(post.text ?? '').matchAll(/@([a-z0-9-]+)/g)].flatMap((match) => {
        const target = handles.get(match[1] ?? '');
        return target
          ? [{ postId: id, targetType: 'member', targetId: target, token: match[0] }]
          : [];
      });
      if (mentions.length > 0)
        await tx.insert(contentPostMentions).values(mentions).onConflictDoNothing();
    }
    for (const comment of DEMO_COMMENTS) {
      const post = DEMO_POSTS.find((candidate) => candidate.key === comment.post);
      const createdAt = new Date(now.getTime() - (post?.daysAgo ?? 0) * DAY_MS + 3_600_000);
      result.comments += (
        await tx
          .insert(contentComments)
          .values({
            id: commentId(comment.key),
            postId: postId(comment.post),
            parentId: comment.replyTo ? commentId(comment.replyTo) : null,
            authorId: userId(comment.author),
            text: comment.text,
            moderationStatus: 'visible',
            createdAt: comment.replyTo ? new Date(createdAt.getTime() + 600_000) : createdAt,
          })
          .onConflictDoNothing()
          .returning({ id: contentComments.id })
      ).length;
    }
    for (const reaction of DEMO_REACTIONS) {
      result.reactions += (
        await tx
          .insert(contentReactions)
          .values({
            targetType: reaction.post ? 'post' : 'comment',
            targetId: reaction.post ? postId(reaction.post) : commentId(reaction.comment ?? ''),
            userId: userId(reaction.author),
            type: reaction.type,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ userId: contentReactions.userId })
      ).length;
    }
  });

  // Files after the commit (no storage call in a transaction, ADR 0019).
  result.media += await uploadDemoFiles(
    db,
    storage,
    images.map((image) => ({ ...image, ownerId: ownerOf(image, userId) })),
    now,
  );
  return result;
}

/**
 * Each new demonstration file uploaded to the quarantine and announced to the worker, as a
 * confirmed upload, already attached to its resource (the worker makes it ready); a file that
 * exists is skipped. Returns the number of files created.
 */
export async function uploadDemoFiles(
  db: Database,
  storage: ObjectStorage,
  files: readonly (PendingImage & { ownerId: string })[],
  now: Date,
): Promise<number> {
  let created = 0;
  for (const image of files) {
    const content =
      image.kind === 'document'
        ? demoDocument(image.hue, image.pages ?? 1)
        : await demoImage(image.kind, image.hue, image.variant);
    const contentType = image.kind === 'document' ? 'application/pdf' : 'image/png';
    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(mediaAssets)
        .values({
          id: image.id,
          ownerId: image.ownerId,
          usage: image.usage,
          source: 'upload',
          status: 'processing',
          visibility: image.visibility,
          declaredContentType: contentType,
          declaredSize: content.length,
          quarantineKey: `quarantine/${image.id}`,
          moderationStatus: 'none',
          attachedResourceType: image.resource.type,
          attachedResourceId: image.resource.id,
          attachedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: mediaAssets.id });
      if (rows.length === 0) return false;
      await tx.insert(outboxEvents).values({
        id: demoId(`event:uploaded:${image.id}`),
        aggregateType: 'media_asset',
        aggregateId: image.id,
        eventType: 'media.asset.uploaded.v1',
        payload: { usage: image.usage },
        occurredAt: now,
        nextAttemptAt: now,
      });
      return true;
    });
    if (!inserted) continue;
    created += 1;
    await storage.putObject({
      visibility: 'private',
      key: `quarantine/${image.id}`,
      body: content,
      contentType,
    });
  }
  return created;
}

/** Owner of a demonstration file: the member of the profile, the owner of the organization. */
function ownerOf(image: PendingImage, userId: (key: string) => string): string {
  if (image.resource.type === 'organization') {
    const organization = DEMO_ORGANIZATIONS.find(
      (candidate) => demoId(`organization:${candidate.key}`) === image.resource.id,
    );
    return userId(organization?.owner ?? '');
  }
  if (image.resource.type === 'post') {
    const post = DEMO_POSTS.find(
      (candidate) => demoId(`post:${candidate.key}`) === image.resource.id,
    );
    return userId(post?.author ?? '');
  }
  return image.resource.id;
}

/** Language of the demonstration texts, as declared in the dataset (fr, en, sw). */
function languageOf(text: string): string {
  if (/\b(tuna|kwa|ya|wiki)\b/i.test(text)) return 'sw';
  return /\b(the|and|our|we|is|for)\b/i.test(text) ? 'en' : 'fr';
}
