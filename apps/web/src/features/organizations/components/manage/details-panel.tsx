'use client';

import {
  organizationsControllerChangeSlug,
  organizationsControllerDelete,
  organizationsControllerRemoveCover,
  organizationsControllerRemoveLogo,
  organizationsControllerSetCover,
  organizationsControllerSetLogo,
  organizationsControllerUpdate,
} from '@pitchorium/api-client';
import { ORGANIZATION_SLUG_MAX_LENGTH, type Organization } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Button,
  Callout,
  Card,
  Form,
  FormActions,
  FormField,
  Heading,
  Input,
  Text,
  notify,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { changeOrganizationSlugRequest, updateOrganizationRequest } from '../../lib/schemas';
import { orNull } from '../../lib/values';
import { OrganizationFields, type OrganizationValues } from '../organization-fields';
import { useOrganizationProblem } from './use-organization-problem';

/** The framing of an image loads when it opens (react-easy-crop, ADR 0094). */
const ImageCropDialog = lazy(() =>
  import('@/features/media').then((module) => ({ default: module.ImageCropDialog })),
);

interface PanelProps {
  organization: Organization;
  onChange: (organization: Organization) => void;
}

export function DetailsPanel({ organization, onChange }: PanelProps) {
  return (
    <div className="grid gap-6">
      <FieldsCard organization={organization} onChange={onChange} />
      <ImagesCard organization={organization} onChange={onChange} />
      <SlugCard organization={organization} onChange={onChange} />
      {organization.viewerRole === 'owner' ? <DeleteCard organization={organization} /> : null}
    </div>
  );
}

/** Name, type, countries, presentation, sectors, site and year: saved together. */
function FieldsCard({ organization, onChange }: PanelProps) {
  const t = useTranslations('web.organizations.manage.details');
  const announce = useAnnounce();
  const form = useZodForm(updateOrganizationRequest, {
    defaultValues: {
      name: organization.name,
      structureType: organization.structureType,
      countryCodes: organization.countryCodes,
      description: organization.description,
      sectorCodes: organization.sectorCodes,
      websiteUrl: organization.websiteUrl,
      foundedYear: organization.foundedYear,
    },
  });
  const applyProblem = useApplyProblem(form);

  async function submit(values: OrganizationValues) {
    try {
      const saved = await organizationsControllerUpdate(organization.id, {
        ...values,
        description: orNull(values.description),
        websiteUrl: orNull(values.websiteUrl),
        foundedYear: values.foundedYear ?? null,
      });
      onChange(saved);
      form.reset(values);
      announce(t('saved'));
    } catch (error) {
      applyProblem(error);
    }
  }

  return (
    <Card className="grid gap-4" aria-labelledby="fields-title">
      <Heading level={2} size="card" id="fields-title">
        {t('title')}
      </Heading>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        <OrganizationFields control={form.control} />
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
            {t('save')}
          </Button>
        </FormActions>
      </Form>
    </Card>
  );
}

type ImagePlace = 'logo' | 'cover';

/** Logo (square, its transparency kept) and cover (4:1), framed before they go (ADR 0111). */
function ImagesCard({ organization, onChange }: PanelProps) {
  const t = useTranslations('web.organizations.manage.images');
  const router = useRouter();
  const [open, setOpen] = useState<ImagePlace | null>(null);
  const texts = (place: ImagePlace) => ({
    title: t(`${place}.title`),
    description: t(`${place}.description`),
    limits: t(`${place}.limits`),
    remove: t(`${place}.remove`),
    removeTitle: t(`${place}.removeTitle`),
    removeDescription: t(`${place}.removeDescription`),
  });
  return (
    <Card className="grid gap-4" aria-labelledby="images-title">
      <Heading level={2} size="card" id="images-title">
        {t('title')}
      </Heading>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <Avatar
          name={organization.name}
          src={organization.logoUrl}
          size="xl"
          shape="square"
          decorative
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpen('logo')}>
            {t('logo.change')}
          </Button>
          <Button variant="outline" onClick={() => setOpen('cover')}>
            {t('cover.change')}
          </Button>
        </div>
      </div>
      {open ? (
        <Suspense fallback={null}>
          <ImageCropDialog
            kind={open === 'logo' ? 'organization_logo' : 'organization_cover'}
            texts={texts(open)}
            hasCurrent={
              (open === 'logo' ? organization.logoMediaId : organization.coverMediaId) !== null
            }
            attach={async (mediaId) =>
              onChange(
                open === 'logo'
                  ? await organizationsControllerSetLogo(organization.id, { mediaId })
                  : await organizationsControllerSetCover(organization.id, { mediaId }),
              )
            }
            remove={async () =>
              onChange(
                open === 'logo'
                  ? await organizationsControllerRemoveLogo(organization.id)
                  : await organizationsControllerRemoveCover(organization.id),
              )
            }
            onClose={(changed) => {
              setOpen(null);
              if (changed) router.refresh();
            }}
          />
        </Suspense>
      ) : null}
    </Card>
  );
}

/** The address of the page: the former one keeps leading to it (a permanent redirect). */
function SlugCard({ organization }: PanelProps) {
  const t = useTranslations('web.organizations.manage.slug');
  const locale = useLocale();
  const router = useRouter();
  const form = useZodForm(changeOrganizationSlugRequest, {
    defaultValues: { slug: organization.slug },
  });
  const applyProblem = useApplyProblem(form, {
    fields: { ORGANIZATIONS_SLUG_TAKEN: 'slug', ORGANIZATIONS_SLUG_RESERVED: 'slug' },
  });
  const slug = form.watch('slug');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const address = (value: string) => `${origin}/${locale}${routes.organization(value)}`;

  async function submit({ slug: next }: { slug: string }) {
    if (next === organization.slug) return;
    try {
      await organizationsControllerChangeSlug(organization.id, { slug: next });
    } catch (error) {
      applyProblem(error);
      return;
    }
    router.replace(`${routes.organizationManage(next)}?tab=details`);
  }

  return (
    <Card className="grid gap-4" aria-labelledby="slug-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="slug-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description')}
        </Text>
      </div>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        <FormField
          control={form.control}
          name="slug"
          label={t('label')}
          description={t('hint')}
          maxLength={ORGANIZATION_SLUG_MAX_LENGTH}
          render={({ field }) => (
            <Input
              {...field}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => field.onChange(event.target.value.toLowerCase())}
            />
          )}
        />
        <div className="grid gap-1 text-sm" aria-live="polite">
          <span className="text-muted">{t('newAddress')}</span>
          <code className="font-mono break-all">{address(slug || organization.slug)}</code>
        </div>
        {slug && slug !== organization.slug ? (
          <Callout title={t('redirectTitle')}>
            {t('redirectBody', { previous: address(organization.slug) })}
          </Callout>
        ) : null}
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
    </Card>
  );
}

/** Deletion by an owner, after typing the name: the page answers 404, the address stays taken. */
function DeleteCard({ organization }: { organization: Organization }) {
  const t = useTranslations('web.organizations.manage.delete');
  const router = useRouter();
  const problem = useOrganizationProblem();
  return (
    <Card className="grid gap-4 border-danger/40" aria-labelledby="delete-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="delete-title">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description')}
        </Text>
      </div>
      <AlertDialog
        trigger={
          <Button variant="danger" className="justify-self-start">
            {t('action')}
          </Button>
        }
        title={t('confirmTitle', { name: organization.name })}
        description={t('confirmDescription')}
        confirmLabel={t('action')}
        confirmPhrase={organization.name}
        onConfirm={async () => {
          try {
            await organizationsControllerDelete(organization.id);
          } catch (error) {
            notify.error(problem(error));
            return;
          }
          notify.success(t('deleted', { name: organization.name }));
          router.replace(routes.settingsOrganizations);
        }}
      />
    </Card>
  );
}
