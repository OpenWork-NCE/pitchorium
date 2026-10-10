'use client';

import {
  getUpdatesControllerListQueryKey,
  updatesControllerDelete,
  updatesControllerEdit,
  updatesControllerPublish,
  useUpdatesControllerList,
} from '@pitchorium/api-client';
import type { ProjectUpdate } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Button,
  Callout,
  Card,
  Field,
  FileDrop,
  FormActions,
  Heading,
  Loading,
  RelativeTime,
  Skeleton,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import { ImageGallery } from '@/features/content';
import { PROJECT_LIMITS } from '../../lib/limits';
import { useProjectEditor } from '../editor/editor-context';
import { ImageList } from '../shared/image-list';
import { altsOf, itemsOf, useImageUploads } from '../shared/use-image-uploads';
import { useProblemText } from '../shared/use-problem-text';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * The updates of a project (§11.3): written by its team once it is published, with images and
 * their text alternatives; they reach the feed of its followers. Each one can be edited (its
 * text, the descriptions of its images) or deleted after a confirmation.
 */
export function UpdatesPanel() {
  const t = useTranslations('web.projects.manage.updates');
  const { project } = useProjectEditor();
  const list = useUpdatesControllerList(
    project.id,
    { limit: 20 },
    { query: { staleTime: 30_000 } },
  );
  if (project.status === 'draft')
    return <Callout title={t('draftTitle')}>{t('draftBody')}</Callout>;
  return (
    <div className="grid gap-8">
      <UpdateForm update={null} onDone={() => undefined} />
      <section aria-labelledby="updates-list-title" className="grid gap-4">
        <Heading level={2} size="card" id="updates-list-title">
          {t('published')}
        </Heading>
        {list.isPending ? (
          <Loading className="grid gap-3">
            <Skeleton className="h-28" />
          </Loading>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <Text size="sm" tone="muted">
            {t('empty')}
          </Text>
        ) : (
          <ol className="grid gap-4">
            {list.data?.items.map((update) => (
              <UpdateItem key={update.id} update={update} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function UpdateItem({ update }: { update: ProjectUpdate }) {
  const t = useTranslations('web.projects.manage.updates');
  const { project } = useProjectEditor();
  const queryClient = useQueryClient();
  const problemText = useProblemText();
  const announce = useAnnounce();
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (editing)
    return (
      <li>
        <UpdateForm update={update} onDone={() => setEditing(false)} />
      </li>
    );
  return (
    <li>
      <Card padding="sm" className="grid gap-3">
        <p className="text-sm text-muted">
          {update.author.displayName} · <RelativeTime date={update.publishedAt} />
          {update.editedAt ? ` · ${t('edited')}` : ''}
        </p>
        <p className="break-words whitespace-pre-line">{update.text}</p>
        {update.images.length > 0 ? (
          <ImageGallery images={update.images} postId={update.id} />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t('edit')}
          </Button>
          <AlertDialog
            trigger={
              <Button type="button" variant="ghost" size="sm">
                {t('delete')}
              </Button>
            }
            title={t('deleteTitle')}
            description={t('deleteBody')}
            confirmLabel={t('deleteConfirm')}
            cancelLabel={t('cancel')}
            onConfirm={async () => {
              setProblem(null);
              try {
                await updatesControllerDelete(project.id, update.id);
                announce(t('deleted'));
                await queryClient.invalidateQueries({
                  queryKey: getUpdatesControllerListQueryKey(project.id),
                });
              } catch (error) {
                setProblem(problemText(error));
              }
            }}
          />
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

/** A new update, or the edition of one: its text and the images with their descriptions. */
function UpdateForm({ update, onDone }: { update: ProjectUpdate | null; onDone: () => void }) {
  const t = useTranslations('web.projects.manage.updates');
  const { project } = useProjectEditor();
  const queryClient = useQueryClient();
  const problemText = useProblemText();
  const announce = useAnnounce();
  const images = useImageUploads(
    'project_update_image',
    PROJECT_LIMITS.updateImages,
    update ? itemsOf(update.images) : [],
  );
  const [text, setText] = useState(update?.text ?? '');
  const [error, setError] = useState<string | undefined>();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!text.trim()) {
      setError(t('textRequired'));
      return;
    }
    setError(undefined);
    setProblem(null);
    setBusy(true);
    try {
      if (update) {
        await updatesControllerEdit(project.id, update.id, {
          text: text.trim(),
          imageAlts: altsOf(images.items),
        });
        announce(t('saved'));
      } else {
        await updatesControllerPublish(project.id, {
          text: text.trim(),
          ...(images.ready.length > 0
            ? {
                imageMediaIds: images.ready.map((item) => item.mediaId!),
                imageAlts: altsOf(images.ready),
              }
            : {}),
        });
        announce(t('publishedNotice'));
        setText('');
        images.reset();
      }
      await queryClient.invalidateQueries({
        queryKey: getUpdatesControllerListQueryKey(project.id),
      });
      onDone();
    } catch (failure) {
      setProblem(problemText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card padding="sm" className="grid gap-4">
      <Heading level={update ? 3 : 2} size="card">
        {update ? t('editTitle') : t('newTitle')}
      </Heading>
      <Field
        label={t('text')}
        error={error}
        counter={{ count: text.length, max: PROJECT_LIMITS.updateText }}
      >
        <Textarea value={text} rows={5} onChange={(event) => setText(event.target.value)} />
      </Field>
      {update ? null : (
        <FileDrop
          label={t('images')}
          limits={t('imageLimits', { max: PROJECT_LIMITS.updateImages })}
          accept={IMAGE_TYPES}
          multiple
          disabled={images.full}
          items={[]}
          onFiles={images.add}
        />
      )}
      <ImageList
        items={images.items}
        onMove={update ? () => undefined : images.move}
        onRemove={update ? () => undefined : images.remove}
        onRetry={images.retry}
        onAlt={images.setAlt}
      />
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <FormActions>
        <Button
          type="button"
          loading={busy}
          loadingLabel={t('sending')}
          disabledReason={images.busy ? t('waitImages') : undefined}
          onClick={() => void submit()}
        >
          {update ? t('save') : t('publish')}
        </Button>
        {update ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('cancel')}
          </Button>
        ) : null}
      </FormActions>
    </Card>
  );
}
