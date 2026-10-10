import type { Database } from '@pitchorium/db';
import { eq } from '@pitchorium/db/orm';
import { projectsProjects } from '@pitchorium/db/schemas/projects';
import { slugBaseFromTitle } from '../../src/modules/projects/domain/project';
import type { ObjectStorage } from '../../src/platform/storage';
import { DEMO_PROJECTS } from './projects-dataset';
import { demoId, type PendingImage, uploadDemoFiles } from './seed-dev-data';

/**
 * The gallery (with its text alternatives) and the private documents of the demonstration
 * projects. The service of the projects attaches ready files only, and the worker makes them
 * ready after the seeding: the files are written already attached, as the seed does for the
 * images of the profiles and publications, then listed on their project. A project that has its
 * files is skipped, so that a second run creates nothing. Returns the number of files created.
 */
export async function seedDevProjectFiles(
  db: Database,
  storage: ObjectStorage,
  now: Date,
): Promise<number> {
  const files: (PendingImage & { ownerId: string })[] = [];
  for (const demo of DEMO_PROJECTS) {
    if (!demo.gallery?.length && !demo.documents?.length) continue;
    const [project] = await db
      .select()
      .from(projectsProjects)
      .where(eq(projectsProjects.slug, slugBaseFromTitle(demo.title)));
    if (!project) continue;
    if (project.galleryMediaIds.length > 0 || project.documentMediaIds.length > 0) continue;
    const resource = { type: 'project', id: project.id };
    const published = project.status !== 'draft';
    const gallery = (demo.gallery ?? []).map((image, index) => ({
      id: demoId(`project:${demo.key}:gallery:${index}`),
      kind: 'post' as const,
      hue: image.hue,
      variant: index,
      usage: 'project_gallery',
      visibility: published ? ('public' as const) : ('private' as const),
      resource,
      ownerId: project.ownerId,
      alt: image.alt,
    }));
    const documents = (demo.documents ?? []).map((pages, index) => ({
      id: demoId(`project:${demo.key}:document:${index}`),
      kind: 'document' as const,
      pages,
      hue: 30 + index * 90,
      variant: 0,
      usage: 'project_document',
      visibility: 'private' as const,
      resource,
      ownerId: project.ownerId,
    }));
    files.push(...gallery, ...documents);
    await db
      .update(projectsProjects)
      .set({
        galleryMediaIds: gallery.map((image) => image.id),
        galleryAlts: Object.fromEntries(gallery.map((image) => [image.id, image.alt])),
        documentMediaIds: documents.map((document) => document.id),
      })
      .where(eq(projectsProjects.id, project.id));
  }
  return uploadDemoFiles(db, storage, files, now);
}
