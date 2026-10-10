'use client';

import {
  ApiProblemError,
  projectsControllerSetDocuments,
  projectsControllerSetGallery,
  projectsControllerUpdate,
} from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button, Field, FileDrop, Heading, Input, Text } from '@/components/ui';
import { PROJECT_LIMITS } from '../../lib/limits';
import { VideoFacade } from '../page/video-facade';
import { ImageList } from '../shared/image-list';
import { useFileUploads } from '../shared/use-file-uploads';
import { altsOf, itemsOf, useImageUploads } from '../shared/use-image-uploads';
import { useProjectEditor } from './editor-context';
import { useAutosave } from './use-autosave';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Step 3, « Médias »: the gallery (the first image is the cover), each image made lighter in the
 * browser and described; the private documents; the link of a video, checked by the api, with
 * the preview of its facade.
 */
export function StepMedia() {
  return (
    <div className="grid gap-10">
      <GallerySection />
      <DocumentsSection />
      <VideoSection />
    </div>
  );
}

function GallerySection() {
  const t = useTranslations('web.projects.editor.media');
  const { project, setProject } = useProjectEditor();
  const gallery = useImageUploads(
    'project_gallery',
    PROJECT_LIMITS.gallery,
    itemsOf(project.gallery),
  );
  const { schedule } = useAutosave(async () => {
    if (gallery.busy) return false;
    setProject(
      await projectsControllerSetGallery(project.id, {
        mediaIds: gallery.ready.map((item) => item.mediaId!),
        alts: altsOf(gallery.ready),
      }),
    );
    return true;
  });
  // The ready images, their order and their descriptions: what the api keeps.
  const signature = JSON.stringify(gallery.ready.map((item) => [item.mediaId, item.alt]));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [signature, schedule]);
  return (
    <section aria-labelledby="gallery-step-title" className="grid gap-4">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="gallery-step-title">
          {t('gallery')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('galleryHint', { max: PROJECT_LIMITS.gallery })}
        </Text>
      </div>
      <FileDrop
        label={t('addImages')}
        limits={t('imageLimits')}
        accept={IMAGE_TYPES}
        multiple
        disabled={gallery.full}
        items={[]}
        onFiles={gallery.add}
      />
      <ImageList
        items={gallery.items}
        onMove={gallery.move}
        onRemove={gallery.remove}
        onRetry={gallery.retry}
        onAlt={gallery.setAlt}
      />
    </section>
  );
}

function DocumentsSection() {
  const t = useTranslations('web.projects.editor.media');
  const { project, setProject } = useProjectEditor();
  const documents = useFileUploads(
    'project_document',
    PROJECT_LIMITS.documents,
    project.documents.map((document, index) => ({
      id: document.mediaId,
      name: t('document', { index: index + 1 }),
      size: 0,
      state: 'ready',
      mediaId: document.mediaId,
    })),
  );
  const { schedule } = useAutosave(async () => {
    if (documents.uploading) return false;
    setProject(await projectsControllerSetDocuments(project.id, { mediaIds: documents.ready }));
    return true;
  });
  const signature = documents.ready.join(',');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [signature, schedule]);
  return (
    <section aria-labelledby="documents-step-title" className="grid gap-4">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="documents-step-title">
          {t('documents')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('documentsHint')}
        </Text>
      </div>
      <FileDrop
        label={t('addDocuments')}
        limits={t('documentLimits', { max: PROJECT_LIMITS.documents })}
        accept={['application/pdf']}
        multiple
        disabled={documents.full}
        items={documents.items}
        onFiles={documents.add}
        onRemove={documents.remove}
        onRetry={documents.retry}
      />
    </section>
  );
}

function VideoSection() {
  const t = useTranslations('web.projects.editor.media');
  const errors = useTranslations('errors');
  const { project, setProject, setSave } = useProjectEditor();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  async function save(videoUrl: string | null) {
    setBusy(true);
    setError(undefined);
    setSave('saving');
    try {
      setProject(await projectsControllerUpdate(project.id, { videoUrl }));
      setSave('saved');
      setUrl('');
    } catch (problem) {
      setSave('idle');
      setError(
        problem instanceof ApiProblemError &&
          (problem.problem.code === 'PROJECTS_VIDEO_URL_INVALID' ||
            problem.problem.code === 'VALIDATION_FAILED')
          ? t('videoInvalid')
          : problem instanceof ApiProblemError
            ? errors(problem.problem.code as never)
            : t('videoFailed'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="video-step-title" className="grid gap-4">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="video-step-title">
          {t('video')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('videoHint')}
        </Text>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (url.trim()) void save(url.trim());
        }}
      >
        <Field label={t('videoUrl')} error={error} className="min-w-64 flex-1">
          <Input
            type="url"
            inputMode="url"
            autoComplete="url"
            value={url}
            placeholder={t('videoPlaceholder')}
            onChange={(event) => setUrl(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="secondary" loading={busy} loadingLabel={t('videoSaving')}>
          {project.video ? t('videoReplace') : t('videoAdd')}
        </Button>
      </form>
      {project.video ? (
        <div className="grid gap-3">
          <p className="text-sm font-medium">{t('videoPreview')}</p>
          <VideoFacade
            video={project.video}
            title={project.title}
            poster={project.gallery[0]?.url ?? null}
          />
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void save(null)}>
              {t('videoRemove')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
