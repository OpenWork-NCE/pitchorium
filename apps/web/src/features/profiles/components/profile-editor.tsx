'use client';

import type { Locale, OwnProfile } from '@pitchorium/contracts';
import { Camera, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ComponentType,
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useMemo,
  useState,
} from 'react';
import { Button, IconButton } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

/** The parts of a profile its owner edits, each in its own dialog (a sheet on a phone). */
export type ProfileSection =
  'intro' | 'about' | 'entrepreneur' | 'contributor' | 'photo' | 'cover' | 'handle' | 'intention';

export interface EditorProps {
  own: OwnProfile;
  locale: Locale;
  /** Closes the dialog; `saved` reads the page again from the server. */
  onClose: (saved: boolean) => void;
}

/** Each editor loads at its first opening: none of them weighs on the page (ADR 0094). */
const EDITORS: Record<ProfileSection, ComponentType<EditorProps>> = {
  intro: lazy(() => import('./editors/intro-editor').then((m) => ({ default: m.IntroEditor }))),
  about: lazy(() => import('./editors/about-editor').then((m) => ({ default: m.AboutEditor }))),
  entrepreneur: lazy(() =>
    import('./editors/entrepreneur-editor').then((m) => ({ default: m.EntrepreneurEditor })),
  ),
  contributor: lazy(() =>
    import('./editors/contributor-editor').then((m) => ({ default: m.ContributorEditor })),
  ),
  photo: lazy(() => import('./editors/photo-editor').then((m) => ({ default: m.AvatarEditor }))),
  cover: lazy(() => import('./editors/photo-editor').then((m) => ({ default: m.CoverEditor }))),
  handle: lazy(() => import('./editors/handle-editor').then((m) => ({ default: m.HandleEditor }))),
  intention: lazy(() =>
    import('./editors/intention-editor').then((m) => ({ default: m.IntentionEditor })),
  ),
};

const EditorContext = createContext<((section: ProfileSection) => void) | null>(null);

/**
 * Editing of a profile by its owner, part by part, as on a professional network (§10.1): a
 * button next to each part opens its dialog; once saved, the page is read again from the
 * server, the strength of the profile with it.
 */
export function ProfileEditorProvider({
  own,
  locale,
  children,
}: {
  own: OwnProfile;
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [section, setSection] = useState<ProfileSection | null>(null);
  const Editor = section ? EDITORS[section] : null;
  return (
    <EditorContext value={setSection}>
      {children}
      {Editor ? (
        <Suspense fallback={null}>
          <Editor
            own={own}
            locale={locale}
            onClose={(saved) => {
              setSection(null);
              if (saved) router.refresh();
            }}
          />
        </Suspense>
      ) : null}
    </EditorContext>
  );
}

/** Opens the editor of a part of the profile (the strength widget, a section). */
export function useOpenEditor(): (section: ProfileSection) => void {
  const open = use(EditorContext);
  return useMemo(() => open ?? (() => undefined), [open]);
}

/**
 * The button of a part: a pencil (« Modifier la présentation »), a camera for the images, or
 * « Ajouter » for a facet still to create.
 */
export function EditButton({
  section,
  create = false,
  variant = 'ghost',
  className,
}: {
  section: ProfileSection;
  create?: boolean;
  variant?: 'ghost' | 'secondary';
  className?: string;
}) {
  const t = useTranslations('web.profile.edit');
  const open = useOpenEditor();
  if (create) {
    return (
      <Button size="sm" variant="secondary" className={className} onClick={() => open(section)}>
        <Plus aria-hidden />
        {t(`add.${section as 'entrepreneur' | 'contributor'}`)}
      </Button>
    );
  }
  return (
    <IconButton
      label={t(`buttons.${section}`)}
      icon={section === 'photo' || section === 'cover' ? <Camera /> : <Pencil />}
      variant={variant}
      size="sm"
      className={className}
      onClick={() => open(section)}
    />
  );
}
