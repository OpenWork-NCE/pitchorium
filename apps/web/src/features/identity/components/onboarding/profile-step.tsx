'use client';

import { meControllerMe, meControllerUpdateProfile } from '@pitchorium/api-client';
import { updateBaseProfileRequestSchema } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  type ComboboxOption,
  Form,
  FormActions,
  FormField,
  Input,
  Progress,
  FieldSkeleton,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { AVATAR_TYPES, AvatarRejectedError, uploadAvatar } from '../../lib/avatar-upload';

/** The search of the countries loads after the step (ADR 0094). */
const Combobox = lazy(() =>
  import('@/components/ui/combobox').then((module) => ({ default: module.Combobox })),
);

type PhotoState =
  | { step: 'idle'; preview?: undefined }
  | { step: 'uploading' | 'processing' | 'ready'; preview: string }
  | { step: 'rejected'; message: string; preview?: undefined };

const profileStepSchema = updateBaseProfileRequestSchema.pick({
  displayName: true,
  headline: true,
  countryCode: true,
});

type ProfileStepValues = {
  displayName?: string | undefined;
  headline?: string | null | undefined;
  countryCode?: string | null | undefined;
};

export interface ProfileStepInitial {
  displayName: string;
  headline: string | null;
  countryCode: string | null;
  avatarUrl: string | null;
  strength: number;
}

/**
 * Minimum profile (§7.2, step 3): photo (the provider's one already there), name, title, country.
 * Everything is skippable; each field is saved as soon as it is filled, and the strength of the
 * profile, computed by the api, moves with it (« on encourage, on ne bloque pas »).
 */
export function ProfileStep({
  initial,
  countries,
  onDone,
}: {
  initial: ProfileStepInitial;
  countries: readonly ComboboxOption[];
  onDone: () => void;
}) {
  const t = useTranslations('web.onboarding.profile');
  const [strength, setStrength] = useState(initial.strength);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const rejections = useTranslations('reference.mediaRejectionReasons');
  const picker = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PhotoState>({ step: 'idle' });
  const form = useZodForm(profileStepSchema, {
    defaultValues: {
      displayName: initial.displayName,
      headline: initial.headline ?? undefined,
      countryCode: initial.countryCode ?? undefined,
    } as ProfileStepValues,
  });
  const applyProblem = useApplyProblem(form);

  async function refreshStrength() {
    const member = await meControllerMe();
    setStrength(member.profileStrength.percent);
    setAvatarUrl(member.profile.avatarUrl);
  }

  /** Saves one field once it is valid and changed: the strength bar then moves. */
  async function saveField(name: keyof ProfileStepValues) {
    if (!(await form.trigger(name)) || !form.getFieldState(name).isDirty) return;
    const value = form.getValues(name);
    try {
      await meControllerUpdateProfile({ [name]: value === '' ? null : value });
      form.resetField(name, { defaultValue: value as never });
      await refreshStrength();
    } catch (error) {
      applyProblem(error);
    }
  }

  async function takePhoto(file: File) {
    const preview = URL.createObjectURL(file);
    setPhoto({ step: 'uploading', preview });
    try {
      await uploadAvatar(file, (step) => setPhoto({ step, preview }));
      setPhoto({ step: 'ready', preview });
      await refreshStrength();
    } catch (error) {
      const reason = error instanceof AvatarRejectedError ? error.reason : null;
      setPhoto({
        step: 'rejected',
        message:
          reason && rejections.has(reason as never)
            ? rejections(reason as never)
            : t('photoFailed'),
      });
    }
  }

  const busy = photo.step === 'uploading' || photo.step === 'processing';

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5" aria-live="polite">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{t('strength')}</span>
          <span className="font-medium tabular-nums">{t('percent', { percent: strength })}</span>
        </div>
        <Progress
          value={strength}
          label={t('strength')}
          valueText={t('percent', { percent: strength })}
        />
      </div>
      {/* The avatar and one button: the photo of the provider is already there when it exists. */}
      <div className="flex items-center gap-4">
        <Avatar
          name={form.watch('displayName') ?? initial.displayName}
          src={photo.preview ?? avatarUrl}
          size="xl"
        />
        <div className="grid min-w-0 justify-items-start gap-1.5">
          <input
            ref={picker}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            hidden
            onChange={(event) => {
              const [file] = event.target.files ?? [];
              event.target.value = '';
              if (file) void takePhoto(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy}
            loadingLabel={t(photo.step === 'processing' ? 'photoChecking' : 'photoSending')}
            onClick={() => picker.current?.click()}
          >
            {t(avatarUrl || photo.preview ? 'changePhoto' : 'addPhoto')}
          </Button>
          <p className="text-xs text-muted">{t('photoLimits')}</p>
          <p role="status" className="text-xs">
            {photo.step === 'ready' ? (
              <span className="text-success">{t('photoSaved')}</span>
            ) : null}
            {photo.step === 'rejected' ? (
              <span className="text-danger">{photo.message}</span>
            ) : null}
          </p>
        </div>
      </div>
      <Form form={form} onSubmit={onDone} aria-label={t('formLabel')}>
        <FormField
          control={form.control}
          name="displayName"
          label={t('name')}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value ?? ''}
              autoComplete="name"
              onBlur={() => {
                field.onBlur();
                void saveField('displayName');
              }}
            />
          )}
        />
        <FormField
          control={form.control}
          name="headline"
          label={t('headline')}
          description={t('headlineHint')}
          optional
          render={({ field }) => (
            <Input
              {...field}
              value={field.value ?? ''}
              autoComplete="organization-title"
              onChange={(event) =>
                field.onChange(event.target.value === '' ? undefined : event.target.value)
              }
              onBlur={() => {
                field.onBlur();
                void saveField('headline');
              }}
            />
          )}
        />
        <FormField
          control={form.control}
          name="countryCode"
          label={t('country')}
          optional
          render={({ field }) => (
            <Suspense fallback={<FieldSkeleton hint={t('countryPlaceholder')} />}>
              <Combobox
                options={countries}
                value={field.value ?? null}
                placeholder={t('countryPlaceholder')}
                onValueChange={(code) => {
                  field.onChange(code ?? undefined);
                  void saveField('countryCode');
                }}
              />
            </Suspense>
          )}
        />
        <FormActions>
          <Button type="submit" className="w-full sm:w-auto">
            {t('continue')}
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onDone}>
            {t('skip')}
          </Button>
        </FormActions>
      </Form>
    </div>
  );
}
