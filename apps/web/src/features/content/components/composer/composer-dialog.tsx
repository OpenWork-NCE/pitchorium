'use client';

import {
  linkPreviewsControllerGet,
  linkPreviewsControllerRequest,
  postsControllerCreate,
  postsControllerUpdate,
  useProjectsControllerMine,
} from '@pitchorium/api-client';
import type { LinkPreviewDraft, Post, PostVisibility } from '@pitchorium/contracts';
import { FileText, ImagePlus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  Field,
  FormActions,
  IconButton,
  Input,
  Link as UiLink,
  notify,
  Select,
  Switch,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useWithPrerequisites } from '@/features/access';
import { useCurrentMember } from '@/features/identity';
import { languageOptions } from '@/features/profiles';
import {
  type ComposerDraft,
  indexedDbDraftStore,
  readDraft,
  writeDraft,
} from '@/lib/drafts/composer-drafts';
import { LIMITS } from '../../lib/limits';
import { documentFromText, type EditorNode, serializeMentions } from '../../lib/mention-text';
import { initialVisibility, visibilityOptions } from '../../lib/visibility';
import { useProblemText } from '../actions/use-problem-text';
import { Editor } from './editor';
import { ImageTray } from './image-tray';
import { LinkPreviewCard } from './link-preview-card';
import { type UploadItem, useUploads } from './use-uploads';

const AUTO = 'auto';
const DRAFT_DELAY_MS = 600;
const PREVIEW_POLL_MS = 1000;
const PREVIEW_ATTEMPTS = 30;

const readyItem = (mediaId: string, text: string, previewUrl: string | null): UploadItem => ({
  id: mediaId,
  name: '',
  previewUrl,
  state: 'ready',
  progress: 1,
  mediaId,
  reason: null,
  text,
  file: null,
});

/**
 * Writing a publication (§10.3), or changing one (`editing`): a dialog on a computer, a full
 * screen on a phone, loaded only when it opens (ADR 0094). The text with its mentions and links
 * (Tiptap, ADR 0119), its language (declared or detected by the api), its audience (`public`
 * only with the public page, ADR 0031), up to nine images made lighter (ADR 0120) each with its
 * text alternative, or one PDF with its title, the preview of a pasted link, the project it is
 * attached to, comments allowed or not. Kept on the device while it is written (ADR 0122).
 */
export default function ComposerDialog({
  open,
  onOpenChange,
  editing = null,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The publication changed; null to write a new one. */
  editing?: Post | null;
  onPublished: (post: Post) => void;
}) {
  const t = useTranslations('web.composer');
  const audiences = useTranslations('reference.postVisibilities');
  const locale = useLocale();
  const member = useCurrentMember();
  const withPrerequisites = useWithPrerequisites();
  const problem = useProblemText();
  const descriptionId = useId();
  const imageInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  const options = visibilityOptions({ publicPageEnabled: member.profile.publicPageEnabled });
  const [document, setDocument] = useState<EditorNode | null>(
    editing?.text ? documentFromText(editing.text, editing.mentions) : null,
  );
  const [editorKey, setEditorKey] = useState(0);
  const [visibility, setVisibility] = useState<PostVisibility>(
    editing?.visibility ?? initialVisibility(options) ?? 'members',
  );
  const [language, setLanguage] = useState<string>(
    editing?.languageSource === 'declared' && editing.language ? editing.language : AUTO,
  );
  const [commentsEnabled, setCommentsEnabled] = useState(!(editing?.commentsDisabled ?? false));
  const images = useUploads(
    'post_image',
    editing?.images.map((image) => readyItem(image.mediaId, image.alt ?? '', image.url)) ?? [],
  );
  const pdf = useUploads(
    'post_document',
    editing?.document
      ? [
          readyItem(
            editing.document.mediaId,
            editing.document.title ?? '',
            editing.document.thumbnailUrl,
          ),
        ]
      : [],
  );
  const [link, setLink] = useState<{ url: string; preview: LinkPreviewDraft | null } | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const projects = useProjectsControllerMine({
    query: { enabled: open && !editing, staleTime: 300_000 },
  });
  const attachable = (projects.data?.items ?? []).filter((item) => item.project.status !== 'draft');
  const selectedProject = attachable.find((item) => item.project.id === projectId)?.project ?? null;

  const text = document ? serializeMentions(document) : '';
  const hasContent =
    text.length > 0 || images.items.length > 0 || pdf.items.length > 0 || link !== null;

  // A draft found again when the composer opens (a new publication only).
  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    void readDraft(indexedDbDraftStore, member.user.id).then((draft) => {
      if (cancelled || !draft) return;
      setDocument(draft.document as EditorNode);
      setEditorKey((key) => key + 1);
      setVisibility(
        options.find((option) => option.value === draft.visibility && !option.disabled)
          ? draft.visibility
          : (initialVisibility(options) ?? 'members'),
      );
      setLanguage(draft.language ?? AUTO);
      images.reset(draft.images.map((image) => readyItem(image.mediaId, image.alt, null)));
      pdf.reset(draft.pdf ? [readyItem(draft.pdf.mediaId, draft.pdf.title, null)] : []);
      setLink(draft.link ? { url: draft.link.url, preview: null } : null);
      setProjectId(draft.projectId);
      setRestored(true);
      if (draft.link?.previewId) void pollPreview(draft.link.previewId, draft.link.url);
    });
    return () => {
      cancelled = true;
    };
    // Read once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Kept on the device while it is written.
  const draft: ComposerDraft = useMemo(
    () => ({
      document,
      visibility,
      language: language === AUTO ? null : language,
      images: images.items.flatMap((item) =>
        item.mediaId ? [{ mediaId: item.mediaId, alt: item.text }] : [],
      ),
      pdf: pdf.items[0]?.mediaId
        ? { mediaId: pdf.items[0].mediaId, title: pdf.items[0].text }
        : null,
      link: link ? { url: link.url, previewId: link.preview?.id ?? null } : null,
      projectId,
    }),
    [document, visibility, language, images.items, pdf.items, link, projectId],
  );
  useEffect(() => {
    if (editing || !open) return;
    const timer = setTimeout(
      () => void writeDraft(indexedDbDraftStore, member.user.id, draft, !hasContent),
      DRAFT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, hasContent, editing, open, member.user.id]);

  async function pollPreview(id: string, url: string) {
    for (let attempt = 0; attempt < PREVIEW_ATTEMPTS; attempt += 1) {
      try {
        const preview = await linkPreviewsControllerGet(id);
        setLink((current) => (current?.url === url ? { url, preview } : current));
        if (preview.status !== 'pending') return;
      } catch {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, PREVIEW_POLL_MS));
    }
  }

  async function previewLink(url: string) {
    if (editing || link || images.items.length || pdf.items.length) return;
    setLink({ url, preview: null });
    try {
      const preview = await linkPreviewsControllerRequest({ url });
      setLink({ url, preview });
      if (preview.status === 'pending') await pollPreview(preview.id, url);
    } catch {
      setLink({ url, preview: null });
    }
  }

  async function submit() {
    setError(null);
    if (!hasContent) return setError(t('empty'));
    if (text.length > LIMITS.postText) return setError(t('tooLong', { max: LIMITS.postText }));
    if (images.pending || pdf.pending) return setError(t('pending'));
    const readyImages = images.items.filter((item) => item.state === 'ready' && item.mediaId);
    const readyPdf = pdf.items.find((item) => item.state === 'ready' && item.mediaId);
    setSending(true);
    try {
      const post = editing
        ? await postsControllerUpdate(editing.id, {
            text,
            visibility,
            language: language === AUTO ? null : language,
            commentsDisabled: !commentsEnabled,
            ...(readyImages.length
              ? {
                  imageAlts: readyImages.map((item) => ({
                    mediaId: item.mediaId!,
                    alt: item.text.trim() || null,
                  })),
                }
              : {}),
            ...(readyPdf && readyPdf.text.trim() ? { documentTitle: readyPdf.text.trim() } : {}),
          })
        : await withPrerequisites(() =>
            postsControllerCreate({
              ...(text ? { text } : {}),
              visibility,
              ...(language === AUTO ? {} : { language: language }),
              ...(readyImages.length
                ? {
                    images: readyImages.map((item) => ({
                      mediaId: item.mediaId!,
                      ...(item.text.trim() ? { alt: item.text.trim() } : {}),
                    })),
                  }
                : {}),
              ...(readyPdf
                ? {
                    documentMediaId: readyPdf.mediaId!,
                    ...(readyPdf.text.trim() ? { documentTitle: readyPdf.text.trim() } : {}),
                  }
                : {}),
              ...(link
                ? { linkUrl: link.url, ...(link.preview ? { linkPreviewId: link.preview.id } : {}) }
                : {}),
              ...(projectId ? { projectId } : {}),
              commentsDisabled: !commentsEnabled,
            }),
          );
      if (!editing) await writeDraft(indexedDbDraftStore, member.user.id, draft, true);
      notify.success(editing ? t('updated') : t('published'));
      onPublished(post);
      onOpenChange(false);
    } catch (caught) {
      setError(problem(caught));
    } finally {
      setSending(false);
    }
  }

  const imagesFull = images.items.length >= LIMITS.images;
  const languages = useMemo(
    () => [{ value: AUTO, label: t('languageAuto') }, ...languageOptions(locale)],
    [locale, t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? t('editTitle') : t('title')}
        size="lg"
        className="max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none"
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {restored ? (
            <Alert
              tone="info"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void writeDraft(indexedDbDraftStore, member.user.id, draft, true);
                    setDocument(null);
                    setEditorKey((key) => key + 1);
                    images.reset([]);
                    pdf.reset([]);
                    setLink(null);
                    setProjectId(null);
                    setRestored(false);
                  }}
                >
                  {t('discardDraft')}
                </Button>
              }
            >
              {t('draftRestored')}
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="danger" live="alert">
              {error}
            </Alert>
          ) : null}
          <div className="grid gap-1">
            <Editor
              key={editorKey}
              initial={document}
              label={t('editor')}
              describedBy={descriptionId}
              onChange={setDocument}
              onPasteUrl={(url) => void previewLink(url)}
            />
            <p
              id={descriptionId}
              aria-live={text.length >= LIMITS.postText * 0.8 ? 'polite' : undefined}
              className={
                text.length > LIMITS.postText
                  ? 'text-end text-xs text-danger tabular-nums'
                  : 'text-end text-xs text-muted tabular-nums'
              }
            >
              {t('counter', {
                count: new Intl.NumberFormat(locale).format(text.length),
                max: new Intl.NumberFormat(locale).format(LIMITS.postText),
              })}
            </p>
          </div>
          {images.items.length > 0 ? (
            <ImageTray
              items={images.items}
              editable={!editing}
              onMove={images.move}
              onRemove={images.remove}
              onRetry={images.retry}
              onAlt={images.setText}
            />
          ) : null}
          {pdf.items.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <FileText aria-hidden className="size-6 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.name || item.text}</span>
                {editing ? null : (
                  <IconButton
                    label={t('remove')}
                    icon={<X />}
                    size="sm"
                    onClick={() => pdf.remove(item.id)}
                  />
                )}
              </div>
              {item.state === 'rejected' || item.state === 'failed' ? (
                <p role="alert" className="text-sm text-danger">
                  {t('uploadFailed')}{' '}
                  <Button type="button" variant="link" size="sm" onClick={() => pdf.retry(item.id)}>
                    {t('retry')}
                  </Button>
                </p>
              ) : item.state !== 'ready' ? (
                <p role="status" className="text-sm text-muted">
                  {item.state === 'sending'
                    ? t('sending', { percent: Math.round(item.progress * 100) })
                    : t('checking')}
                </p>
              ) : null}
              <Field
                label={t('documentTitle')}
                counter={{ count: item.text.length, max: LIMITS.documentTitle }}
              >
                <Input
                  value={item.text}
                  onChange={(event) => pdf.setText(item.id, event.target.value)}
                  autoComplete="off"
                />
              </Field>
            </div>
          ))}
          {link && !editing ? (
            <LinkPreviewCard url={link.url} preview={link.preview} onRemove={() => setLink(null)} />
          ) : null}
          {editing ? null : (
            <div className="flex flex-wrap gap-2">
              <input
                ref={imageInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])].slice(
                    0,
                    LIMITS.images - images.items.length,
                  );
                  if (files.length) images.add(files);
                  event.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabledReason={
                  pdf.items.length
                    ? t('imagesOrDocument')
                    : imagesFull
                      ? t('imagesLimit')
                      : undefined
                }
                onClick={() => imageInput.current?.click()}
              >
                <ImagePlus aria-hidden />
                {t('addImages')}
              </Button>
              <input
                ref={documentInput}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file)
                    pdf.add([file], (chosen) =>
                      chosen.name.replace(/\.pdf$/i, '').slice(0, LIMITS.documentTitle),
                    );
                  event.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabledReason={
                  images.items.length || pdf.items.length ? t('imagesOrDocument') : undefined
                }
                onClick={() => documentInput.current?.click()}
              >
                <FileText aria-hidden />
                {t('addDocument')}
              </Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('visibility')}
              description={
                options[0]?.disabled ? (
                  <>
                    {t('publicPageDisabled')}{' '}
                    <UiLink href={routes.settingsPrivacy}>{t('privacySettings')}</UiLink>
                  </>
                ) : undefined
              }
            >
              <Select
                value={visibility}
                onValueChange={setVisibility}
                options={options.map((option) => ({
                  value: option.value,
                  label: audiences(option.value),
                  disabled: option.disabled,
                }))}
              />
            </Field>
            <Field label={t('language')}>
              <Select value={language} onValueChange={setLanguage} options={languages} />
            </Field>
            {editing || attachable.length === 0 ? null : (
              <Field label={t('project')} optional>
                <Select
                  value={projectId ?? 'none'}
                  onValueChange={(value) => setProjectId(value === 'none' ? null : value)}
                  options={[
                    { value: 'none', label: t('projectNone') },
                    ...attachable.map((item) => ({
                      value: item.project.id,
                      label: item.project.title,
                    })),
                  ]}
                />
                {selectedProject ? (
                  <UiLink
                    href={routes.project(selectedProject.slug)}
                    variant="standalone"
                    className="mt-1 text-sm"
                  >
                    {t('projectLink', { title: selectedProject.title })}
                  </UiLink>
                ) : null}
              </Field>
            )}
            <div className="flex items-center gap-3 self-end">
              <Switch
                checked={commentsEnabled}
                onCheckedChange={setCommentsEnabled}
                aria-label={t('comments')}
              />
              <span className="text-sm">{t('comments')}</span>
            </div>
          </div>
          <FormActions>
            <Button
              type="submit"
              loading={sending}
              loadingLabel={editing ? t('saving') : t('publishing')}
            >
              {editing ? t('save') : t('publish')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
