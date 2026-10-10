import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateProjectRequest,
  ProjectModerationStatus,
  TierRequest,
  UpdateProjectRequest,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator, slugCandidates } from '../../../platform/kernel';
import { ImpactFacade } from '../../impact';
import { MediaFacade } from '../../media';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import { assertGoalMatchesTiers, assertTiers, type TierRecord } from '../domain/funding';
import { assertRestrictedMarkdown } from '../domain/markdown';
import {
  assertAmountsEditable,
  assertCurrency,
  assertDraft,
  assertSlugAllowed,
  assertTransition,
  endsAtFor,
  imageAlts,
  isPublished,
  PROJECT_CURRENCY,
  type ProjectRecord,
  publicationBlockers,
  slugBaseFromTitle,
} from '../domain/project';
import {
  ProjectCreated,
  ProjectDeleted,
  ProjectPublished,
  ProjectUpdated,
} from '../domain/project-events';
import { parseVideoUrl } from '../domain/video';
import { ProjectEventsRecorder } from './project-events.recorder';
import { type ProjectPatch, ProjectRepository } from './ports';

/** Resources of the media module owned by projects (ADR 0026). */
export const PROJECT_RESOURCE = 'project';

const notFound = () => new DomainError('PROJECTS_NOT_FOUND', 'Project not found');

/**
 * Write side of projects (section 11): drafts, editing, tiers, media, publication. Every write
 * records its event in the same transaction; every change of a published project is audited.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly media: MediaFacade,
    private readonly impact: ImpactFacade,
    private readonly events: ProjectEventsRecorder,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** A live project (not deleted), 404 otherwise. */
  async require(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.findProject(projectId);
    if (!project || project.deletedAt) throw notFound();
    return project;
  }

  /**
   * Draft owned by a member with an entrepreneur facet (access policy). The impact assessment
   * of the facet of the owner is copied to the project when it fits the published methodology
   * (section 11.1: prefilled, then adjustable).
   */
  async create(userId: string, request: CreateProjectRequest): Promise<ProjectRecord> {
    const fields = await this.checkedFields(request, null);
    if (request.organizationId) await this.assertCanCarry(request.organizationId, userId);
    const project = await this.transactions.run(async () => {
      const base = slugBaseFromTitle(request.title);
      for (const slug of slugCandidates(base, () => randomInt(1000, 1_000_000))) {
        if (await this.projects.isSlugUnavailable(slug, null)) continue;
        const now = this.clock.now();
        const record: ProjectRecord = {
          id: this.ids.next(),
          slug,
          ownerId: userId,
          organizationId: request.organizationId ?? null,
          title: request.title,
          summary: null,
          description: null,
          sectorCode: null,
          impactArea: null,
          countryCodes: [],
          video: null,
          instruments: [],
          opensCapital: false,
          currency: PROJECT_CURRENCY,
          goalMinor: null,
          durationDays: null,
          galleryMediaIds: [],
          galleryAlts: {},
          documentMediaIds: [],
          status: 'draft',
          collectedMinor: 0n,
          contributionCount: 0,
          firstContributionAt: null,
          publicDisplayConsentAt: null,
          publicDisplayConsentBy: null,
          impactScore: null,
          impactLevel: null,
          impactMethodologyVersion: null,
          moderationStatus: 'visible',
          featuredAt: null,
          featuredBy: null,
          fundingFrozenAt: null,
          publishedAt: null,
          endsAt: null,
          fundedAt: null,
          closedAt: null,
          endingSoonAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          ...fields,
        };
        if (!(await this.projects.insertProject(record))) continue;
        await this.projects.insertTeamMember({
          projectId: record.id,
          userId,
          role: 'owner',
          function: null,
          status: 'active',
          invitedBy: null,
          invitedAt: now,
          joinedAt: now,
          publicDisplayConsentAt: null,
        });
        await this.events.record(ProjectCreated, record.id, {
          ownerId: userId,
          organizationId: record.organizationId,
        });
        await this.prefillImpact(record, userId);
        return record;
      }
      throw new Error(`No slug available for project ${request.title}`);
    });
    return this.require(project.id);
  }

  async update(projectId: string, actorId: string, patch: UpdateProjectRequest): Promise<void> {
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return;
    const project = await this.require(projectId);
    const checked = await this.checkedFields(patch, project);
    if (patch.organizationId) await this.assertCanCarry(patch.organizationId, actorId);
    await this.transactions.run(async () => {
      const locked = await this.lockLive(projectId);
      if (checked.goalMinor !== undefined && checked.goalMinor !== locked.goalMinor) {
        assertAmountsEditable(locked);
        if (checked.goalMinor !== null) {
          assertGoalMatchesTiers(checked.goalMinor, await this.projects.tiersOf(projectId));
        }
      }
      if (checked.durationDays !== undefined && checked.durationDays !== locked.durationDays) {
        // The end date is fixed at publication: there is no extension.
        assertDraft(locked);
      }
      await this.projects.updateProject(projectId, checked, this.clock.now());
      await this.events.record(ProjectUpdated, projectId, { fields });
      await this.auditPublished(locked, actorId, 'projects.project-updated', { fields });
    });
  }

  /** Former slugs keep redirecting and are never given to another project. */
  async changeSlug(projectId: string, actorId: string, slug: string): Promise<void> {
    const project = await this.require(projectId);
    assertSlugAllowed(slug);
    if (project.slug === slug) return;
    if (await this.projects.isSlugUnavailable(slug, projectId)) {
      throw new DomainError('PROJECTS_SLUG_TAKEN', 'Project slug is already taken');
    }
    await this.transactions.run(async () => {
      await this.projects.changeSlug(projectId, project.slug, slug, this.clock.now());
      await this.events.record(ProjectUpdated, projectId, { fields: ['slug'] });
      await this.auditPublished(project, actorId, 'projects.project-updated', {
        fields: ['slug'],
      });
    });
  }

  /**
   * Replaces the gallery (usage `project_gallery`) with ready images: files already in the
   * gallery stay, new ones are attached for the acting member, removed ones are detached. The
   * text alternatives given replace the others; without them, those of the images kept stay.
   */
  async setGallery(
    projectId: string,
    actorId: string,
    mediaIds: readonly string[],
    alts?: Readonly<Record<string, string>>,
  ): Promise<void> {
    await this.replaceMedia(projectId, actorId, mediaIds, 'gallery', alts);
  }

  /** Replaces the private documents (usage `project_document`, PDF). */
  async setDocuments(
    projectId: string,
    actorId: string,
    mediaIds: readonly string[],
  ): Promise<void> {
    await this.replaceMedia(projectId, actorId, mediaIds, 'documents');
  }

  /**
   * 1 to 5 cumulative tiers, strictly increasing (ADR 0038); the last threshold becomes the
   * goal. Thresholds are locked after the first paid contribution; descriptions stay editable.
   */
  async replaceTiers(
    projectId: string,
    actorId: string,
    requests: readonly TierRequest[],
  ): Promise<void> {
    for (const tier of requests) assertCurrency(tier.threshold.currency);
    const inputs = requests.map((tier) => ({
      thresholdMinor: BigInt(tier.threshold.amountMinor),
      description: tier.description,
    }));
    assertTiers(inputs);
    await this.transactions.run(async () => {
      const project = await this.lockLive(projectId);
      const current = await this.projects.tiersOf(projectId);
      const sameThresholds =
        current.length === inputs.length &&
        current.every((tier, index) => tier.thresholdMinor === inputs[index]?.thresholdMinor);
      if (!sameThresholds) assertAmountsEditable(project);
      const tiers: TierRecord[] = inputs.map((tier, index) => ({
        id: current[index]?.id ?? this.ids.next(),
        projectId,
        position: index + 1,
        thresholdMinor: tier.thresholdMinor,
        description: tier.description,
        unlockedAt: current[index]?.unlockedAt ?? null,
      }));
      await this.projects.replaceTiers(projectId, tiers);
      const goalMinor = inputs.at(-1)?.thresholdMinor ?? null;
      const fields = ['tiers', ...(goalMinor !== project.goalMinor ? ['goal'] : [])];
      await this.projects.updateProject(projectId, { goalMinor }, this.clock.now());
      await this.events.record(ProjectUpdated, projectId, { fields });
      await this.auditPublished(project, actorId, 'projects.project-updated', { fields });
    });
  }

  /**
   * Draft to funding (section 11.1). Requires the complete fields, at least one tier, the
   * impact assessment when a methodology is published, and the explicit consent of the owner
   * to the public display of their name, photo and headline (ADR 0040), recorded with the
   * publication. The end date is set now; the gallery becomes public.
   */
  async publish(projectId: string, actorId: string, consent: boolean): Promise<void> {
    if (!consent) {
      throw new DomainError(
        'PROJECTS_PUBLIC_DISPLAY_CONSENT_REQUIRED',
        'The owner must consent to the public display of the team',
      );
    }
    const methodology = await this.impact.publishedMethodology();
    await this.transactions.run(async () => {
      const project = await this.lockLive(projectId);
      assertTransition(project.status, 'funding');
      const tiers = await this.projects.tiersOf(projectId);
      const missing = publicationBlockers(project, tiers.length);
      if (missing.length > 0) {
        throw new DomainError(
          'PROJECTS_NOT_PUBLISHABLE',
          `Missing for publication: ${missing.join(', ')}`,
          { missing },
        );
      }
      if (project.goalMinor !== null) assertGoalMatchesTiers(project.goalMinor, tiers);
      if (methodology && project.impactScore === null) {
        throw new DomainError(
          'PROJECTS_IMPACT_ASSESSMENT_REQUIRED',
          'A self-declared impact assessment is required',
        );
      }
      const now = this.clock.now();
      const endsAt = endsAtFor(now, project.durationDays ?? 0);
      await this.projects.updateProject(
        projectId,
        {
          status: 'funding',
          publishedAt: now,
          endsAt,
          publicDisplayConsentAt: now,
          publicDisplayConsentBy: actorId,
        },
        now,
      );
      await this.projects.updateTeamMember(projectId, actorId, { publicDisplayConsentAt: now });
      await this.media.setResourceVisibility({ type: PROJECT_RESOURCE, id: projectId }, 'public');
      await this.events.record(ProjectPublished, projectId, {
        ownerId: project.ownerId,
        endsAt: endsAt.toISOString(),
        goalMinor: String(project.goalMinor ?? 0n),
        currency: project.currency,
      });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'projects.project-published',
        target: { type: PROJECT_RESOURCE, id: projectId },
        metadata: { publicDisplayConsent: true, endsAt: endsAt.toISOString() },
      });
    });
  }

  /** Editorial highlight of the showcase by a moderator or an administrator. */
  async setFeatured(projectId: string, actorId: string, featured: boolean): Promise<void> {
    const project = await this.require(projectId);
    if (!isPublished(project) || project.moderationStatus !== 'visible') throw notFound();
    if ((project.featuredAt !== null) === featured) return;
    const now = this.clock.now();
    await this.transactions.run(async () => {
      await this.projects.updateProject(
        projectId,
        featured
          ? { featuredAt: now, featuredBy: actorId }
          : { featuredAt: null, featuredBy: null },
        now,
      );
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: featured ? 'projects.project-featured' : 'projects.project-unfeatured',
        target: { type: PROJECT_RESOURCE, id: projectId },
      });
      await this.events.record(ProjectUpdated, projectId, { fields: ['featured'] });
    });
  }

  /** For the trust module: a hidden or removed project leaves the showcase and its files go private. */
  async setModerationStatus(projectId: string, status: ProjectModerationStatus): Promise<void> {
    const project = await this.require(projectId);
    await this.transactions.run(async () => {
      await this.projects.updateProject(projectId, { moderationStatus: status }, this.clock.now());
      const visible = status === 'visible' && isPublished(project);
      await this.media.setResourceVisibility(
        { type: PROJECT_RESOURCE, id: projectId },
        visible ? 'public' : 'private',
      );
      await this.events.record(ProjectUpdated, projectId, { fields: ['moderationStatus'] });
    });
  }

  async setFundingFrozen(projectId: string, frozen: boolean): Promise<void> {
    await this.require(projectId);
    await this.transactions.run(async () => {
      const now = this.clock.now();
      await this.projects.updateProject(projectId, { fundingFrozenAt: frozen ? now : null }, now);
      await this.events.record(ProjectUpdated, projectId, { fields: ['fundingFrozen'] });
    });
  }

  /** Only a draft can be deleted; its slug stays reserved and its files are detached. */
  async delete(projectId: string, actorId: string): Promise<void> {
    await this.transactions.run(async () => {
      const project = await this.lockLive(projectId);
      assertDraft(project);
      const now = this.clock.now();
      await this.projects.updateProject(projectId, { deletedAt: now }, now);
      for (const mediaId of [...project.galleryMediaIds, ...project.documentMediaIds]) {
        await this.media.detach(mediaId);
      }
      await this.events.record(ProjectDeleted, projectId, { deletedBy: actorId });
    });
  }

  private async lockLive(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.lockProject(projectId);
    if (!project || project.deletedAt) throw notFound();
    return project;
  }

  /** Validated column values of the fields present in a request. */
  private async checkedFields(
    request: UpdateProjectRequest,
    current: ProjectRecord | null,
  ): Promise<ProjectPatch> {
    const patch: ProjectPatch = {};
    if (request.title !== undefined) patch.title = request.title;
    if (request.organizationId !== undefined) patch.organizationId = request.organizationId;
    if (request.summary !== undefined) patch.summary = request.summary;
    if (request.description !== undefined) {
      if (request.description !== null) assertRestrictedMarkdown(request.description);
      patch.description = request.description;
    }
    if (request.sectorCode !== undefined) {
      if (request.sectorCode !== null) await this.profiles.assertSectors([request.sectorCode]);
      patch.sectorCode = request.sectorCode;
    }
    if (request.impactArea !== undefined) patch.impactArea = request.impactArea;
    if (request.countryCodes !== undefined) {
      const outside = await this.profiles.countriesOutsideProjectRegions(request.countryCodes);
      if (outside.length > 0) {
        throw new DomainError(
          'PROJECTS_COUNTRY_NOT_ELIGIBLE',
          `Not in Africa or the Caribbean: ${outside.join(', ')}`,
        );
      }
      patch.countryCodes = request.countryCodes;
    }
    if (request.videoUrl !== undefined) {
      patch.video = request.videoUrl === null ? null : parseVideoUrl(request.videoUrl);
    }
    if (request.instruments !== undefined) patch.instruments = request.instruments;
    if (request.opensCapital !== undefined) patch.opensCapital = request.opensCapital;
    if (request.goal !== undefined) {
      if (request.goal !== null) assertCurrency(request.goal.currency);
      patch.goalMinor = request.goal === null ? null : BigInt(request.goal.amountMinor);
    }
    if (request.durationDays !== undefined) patch.durationDays = request.durationDays;
    if (current && patch.goalMinor === current.goalMinor) delete patch.goalMinor;
    return patch;
  }

  private async assertCanCarry(organizationId: string, userId: string): Promise<void> {
    const role = await this.organizations.roleOf(organizationId, userId);
    if (role !== 'owner' && role !== 'admin') {
      throw new DomainError(
        'PROJECTS_ORGANIZATION_ROLE_REQUIRED',
        'Only owners and admins of the organization may carry a project with it',
      );
    }
  }

  private async replaceMedia(
    projectId: string,
    actorId: string,
    mediaIds: readonly string[],
    slot: 'gallery' | 'documents',
    alts?: Readonly<Record<string, string>>,
  ): Promise<void> {
    await this.transactions.run(async () => {
      const project = await this.lockLive(projectId);
      const current = slot === 'gallery' ? project.galleryMediaIds : project.documentMediaIds;
      const resource = { type: PROJECT_RESOURCE, id: projectId };
      const visibility = isPublished(project) && project.moderationStatus === 'visible';
      for (const mediaId of current) {
        if (!mediaIds.includes(mediaId)) await this.media.detach(mediaId);
      }
      for (const mediaId of mediaIds) {
        if (current.includes(mediaId)) continue;
        await this.media.attach({
          mediaId,
          ownerId: actorId,
          usage: slot === 'gallery' ? 'project_gallery' : 'project_document',
          resource,
          resourceVisibility: visibility ? 'public' : 'private',
        });
      }
      await this.projects.updateProject(
        projectId,
        slot === 'gallery'
          ? {
              galleryMediaIds: [...mediaIds],
              galleryAlts: imageAlts(mediaIds, alts ?? project.galleryAlts),
            }
          : { documentMediaIds: [...mediaIds] },
        this.clock.now(),
      );
      await this.events.record(ProjectUpdated, projectId, { fields: [slot] });
      await this.auditPublished(project, actorId, 'projects.project-updated', { fields: [slot] });
    });
  }

  /** Copies the assessment of the facet of the owner when it answers every criterion. */
  private async prefillImpact(project: ProjectRecord, ownerId: string): Promise<void> {
    if (!(await this.impact.publishedMethodology())) return;
    const prefill = await this.impact.prefill({ type: 'entrepreneur_facet', id: ownerId });
    if (!prefill.complete) return;
    const assessment = await this.impact.submit({
      subject: { type: 'project', id: project.id },
      submittedBy: ownerId,
      methodologyId: prefill.methodologyId,
      answers: prefill.answers,
      source: 'prefilled',
    });
    await this.projects.updateProject(
      project.id,
      {
        impactScore: assessment.score,
        impactLevel: assessment.level,
        impactMethodologyVersion: assessment.methodology.version,
      },
      this.clock.now(),
    );
  }

  /** Changes of a published project are audited, with the names of the fields. */
  private async auditPublished(
    project: ProjectRecord,
    actorId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!isPublished(project)) return;
    await this.audit.record({
      actor: { type: 'user', id: actorId },
      action,
      target: { type: PROJECT_RESOURCE, id: project.id },
      metadata,
    });
  }
}
