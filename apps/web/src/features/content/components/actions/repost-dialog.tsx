'use client';

import { postsControllerRepost } from '@pitchorium/api-client';
import type { EmbeddedPost, Post, PostVisibility } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Dialog, DialogContent, Field, FormActions, notify, Select } from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { useCurrentMember } from '@/features/identity';
import { LIMITS } from '../../lib/limits';
import { initialVisibility, visibilityOptions } from '../../lib/visibility';
import { MentionTextarea } from '../mentions/mention-textarea';
import { useProblemText } from './use-problem-text';

/**
 * Reposting a publication with an optional comment (§10.3): the original is what is reposted
 * (the repost of a repost aims at it), and its audience is never widened (ADR 0031): the
 * audiences it does not allow are said, never offered.
 */
export default function RepostDialog({
  original,
  onClose,
  onReposted,
}: {
  original: EmbeddedPost;
  onClose: () => void;
  onReposted: (post: Post) => void;
}) {
  const t = useTranslations('web.content.repost');
  const audiences = useTranslations('reference.postVisibilities');
  const member = useCurrentMember();
  const withPrerequisites = useWithPrerequisites();
  const problem = useProblemText();
  const options = visibilityOptions({
    publicPageEnabled: member.profile.publicPageEnabled,
    original: { visibility: original.visibility, byReader: original.viewerIsAuthor },
  });
  const [visibility, setVisibility] = useState<PostVisibility | null>(initialVisibility(options));
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!visibility) return;
    setSending(true);
    try {
      const text = comment.trim();
      const post = await withPrerequisites(() =>
        postsControllerRepost(original.id, { visibility, ...(text ? { comment: text } : {}) }),
      );
      notify.success(t('done'));
      onReposted(post);
      onClose();
    } catch (error) {
      notify.error(problem(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t('title')} description={t('widenNotAllowed')}>
        {visibility === null ? (
          <p className="text-sm">{t('noAudience')}</p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field
              label={t('comment')}
              optional
              counter={{ count: comment.length, max: LIMITS.postText }}
            >
              <MentionTextarea value={comment} onChange={setComment} minRows={2} maxRows={8} />
            </Field>
            <Field label={t('audience')}>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value)}
                options={options.map((option) => ({
                  value: option.value,
                  label: audiences(option.value),
                  disabled: option.disabled,
                }))}
              />
            </Field>
            <FormActions>
              <Button
                type="submit"
                loading={sending}
                disabled={comment.trim().length > LIMITS.postText}
              >
                {t('submit')}
              </Button>
            </FormActions>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
