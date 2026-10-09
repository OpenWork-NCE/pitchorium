'use client';

import {
  meControllerRemoveAvatar,
  meControllerRemoveCover,
  meControllerSetAvatar,
  meControllerSetCover,
} from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { ImageCropDialog } from '@/features/media';
import type { EditorProps } from '../profile-editor';

/** The photo of the profile, square, framed in the browser (§10.1, ADR 0111). */
export function AvatarEditor({ own, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit.image.avatar');
  return (
    <ImageCropDialog
      kind="avatar"
      texts={{
        title: t('title'),
        description: t('description'),
        limits: t('limits'),
        remove: t('remove'),
        removeTitle: t('removeTitle'),
        removeDescription: t('removeDescription'),
      }}
      hasCurrent={own.avatarMediaId !== null}
      attach={(mediaId) => meControllerSetAvatar({ mediaId })}
      remove={() => meControllerRemoveAvatar()}
      onClose={onClose}
    />
  );
}

/** The cover of the profile, 4:1, framed in the browser (§10.1, ADR 0111). */
export function CoverEditor({ own, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit.image.cover');
  return (
    <ImageCropDialog
      kind="profile_cover"
      texts={{
        title: t('title'),
        description: t('description'),
        limits: t('limits'),
        remove: t('remove'),
        removeTitle: t('removeTitle'),
        removeDescription: t('removeDescription'),
      }}
      hasCurrent={own.coverMediaId !== null}
      attach={(mediaId) => meControllerSetCover({ mediaId })}
      remove={() => meControllerRemoveCover()}
      onClose={onClose}
    />
  );
}
