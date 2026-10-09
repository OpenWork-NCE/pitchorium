import type { Locale, ProfileView } from '@pitchorium/contracts';
import { Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import {
  Card,
  DescriptionList,
  Heading,
  ImpactBadge,
  Money,
  Tag,
  Text,
  VerifiedBadge,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link as LocaleLink } from '@/i18n/navigation';
import { countryName } from '@/lib/format/countries';
import { formatNames } from '@/lib/format/list';
import { EditButton } from './owner-tools';

type Translate = Awaited<ReturnType<typeof getTranslations<'reference'>>>;

/** A code of the reference data, labelled; the code itself when its label is missing. */
function label(t: Translate, group: string, code: string): string {
  const key = `${group}.${code}`;
  return t.has(key as never) ? t(key as never) : code;
}

function Tags({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <Tag>{item}</Tag>
        </li>
      ))}
    </ul>
  );
}

async function FacetCard({
  kind,
  title,
  editable,
  hidden,
  children,
}: {
  kind: 'entrepreneur' | 'contributor';
  title: string;
  editable: boolean;
  /** The facet exists, but its details are not for this reader. */
  hidden: boolean;
  children?: ReactNode;
}) {
  const t = await getTranslations('web.profile.page');
  return (
    <Card className="grid gap-4" data-profile-section={kind}>
      <div className="flex items-center justify-between gap-3">
        <Heading level={2} size="section">
          {title}
        </Heading>
        {editable ? <EditButton section={kind} /> : null}
      </div>
      {hidden ? (
        <Text size="sm" tone="muted" className="flex items-center gap-2">
          <Lock aria-hidden className="size-4 shrink-0" />
          {t('detailsHidden')}
        </Text>
      ) : (
        children
      )}
    </Card>
  );
}

/**
 * The entrepreneur facet (§10.1): company, sector, stage, team, year, country and city, pitch,
 * needs, sought expertise, funding target, and the self-declared impact when assessed. Shown as
 * the api gives it: a facet whose details are private for this reader says so, nothing more.
 */
export async function EntrepreneurSection({
  profile,
  locale,
  editable,
}: {
  profile: ProfileView;
  locale: Locale;
  editable: boolean;
}) {
  const t = await getTranslations('web.profile.entrepreneur');
  const reference = await getTranslations('reference');
  const facet = profile.entrepreneur;
  if (!profile.facets.entrepreneur) {
    if (!editable) return null;
    return (
      <Card surface="sunken" className="grid gap-2" data-profile-section="entrepreneur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level={2} size="card">
            {t('title')}
          </Heading>
          <EditButton section="entrepreneur" create />
        </div>
        <Text size="sm" tone="muted">
          {t('empty')}
        </Text>
      </Card>
    );
  }
  const impact = profile.entrepreneurImpact;
  const place = facet
    ? [facet.companyCity, countryName(facet.companyCountryCode, locale)].filter(Boolean).join(', ')
    : '';
  return (
    <FacetCard kind="entrepreneur" title={t('title')} editable={editable} hidden={!facet}>
      {facet ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Heading level={3} size="card">
              {facet.companyName}
            </Heading>
            {impact ? (
              <ImpactBadge
                level={impact.level}
                levelLabel={reference(`impactLevels.${impact.level}`)}
                score={impact.score}
                mention={reference('impactMentions.selfDeclared', {
                  version: `v${impact.methodology.version}`,
                })}
                criteria={impact.details.map((detail) => ({
                  label: reference.has(detail.labelKey as never)
                    ? reference(detail.labelKey as never)
                    : detail.criterionKey,
                  score: detail.value,
                  max: detail.maxValue,
                }))}
              />
            ) : null}
          </div>
          <DescriptionList
            items={[
              {
                key: 'sector',
                term: t('sector'),
                description: label(reference, 'sectors', facet.sectorCode),
              },
              {
                key: 'stage',
                term: t('stage'),
                description: label(reference, 'stages', facet.stageCode),
              },
              ...(facet.teamSize
                ? [
                    {
                      key: 'team',
                      term: t('team'),
                      description: t(facet.teamSize === 1 ? 'people.one' : 'people.other', {
                        count: facet.teamSize,
                      }),
                    },
                  ]
                : []),
              ...(facet.foundedYear
                ? [{ key: 'founded', term: t('founded'), description: String(facet.foundedYear) }]
                : []),
              { key: 'place', term: t('place'), description: place },
              ...(facet.fundingTarget
                ? [
                    {
                      key: 'funding',
                      term: t('fundingTarget'),
                      description: <Money amount={facet.fundingTarget} />,
                    },
                  ]
                : []),
            ]}
          />
          {facet.pitch ? (
            <div className="grid gap-1.5">
              <Heading level={3} size="label">
                {t('pitch')}
              </Heading>
              <Text prose className="whitespace-pre-line">
                {facet.pitch}
              </Text>
            </div>
          ) : null}
          {facet.needs.length > 0 ? (
            <div className="grid gap-1.5">
              <Heading level={3} size="label">
                {t('needs')}
              </Heading>
              <Tags
                items={facet.needs.map((need) => label(reference, 'entrepreneurNeeds', need))}
              />
            </div>
          ) : null}
          {facet.soughtExpertise.length > 0 ? (
            <div className="grid gap-1.5">
              <Heading level={3} size="label">
                {t('soughtExpertise')}
              </Heading>
              <Tags items={facet.soughtExpertise} />
            </div>
          ) : null}
        </>
      ) : null}
    </FacetCard>
  );
}

/**
 * The contributor facet (§10.1): hats, type of structure, organisation, countries of
 * intervention, sectors, ticket, instruments, kinds of patronage, mentoring and missions.
 */
export async function ContributorSection({
  profile,
  locale,
  editable,
}: {
  profile: ProfileView;
  locale: Locale;
  editable: boolean;
}) {
  const t = await getTranslations('web.profile.contributor');
  const reference = await getTranslations('reference');
  const facet = profile.contributor;
  if (!profile.facets.contributor) {
    if (!editable) return null;
    return (
      <Card surface="sunken" className="grid gap-2" data-profile-section="contributor">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level={2} size="card">
            {t('title')}
          </Heading>
          <EditButton section="contributor" create />
        </div>
        <Text size="sm" tone="muted">
          {t('empty')}
        </Text>
      </Card>
    );
  }
  const organization = profile.contributorOrganization;
  const items = facet
    ? [
        {
          key: 'structure',
          term: t('structure'),
          description: label(reference, 'structureTypes', facet.structureType),
        },
        ...(organization || facet.organizationName
          ? [
              {
                key: 'organization',
                term: t('organization'),
                description: organization ? (
                  <span className="inline-flex items-center gap-1.5">
                    <LocaleLink
                      href={routes.organization(organization.slug)}
                      className="link-underline-hover font-medium"
                    >
                      {organization.name}
                    </LocaleLink>
                    {organization.verified ? <VerifiedBadge /> : null}
                  </span>
                ) : (
                  facet.organizationName
                ),
              },
            ]
          : []),
        ...(facet.interventionCountryCodes.length > 0
          ? [
              {
                key: 'countries',
                term: t('countries'),
                description: formatNames(
                  facet.interventionCountryCodes.map((code) => countryName(code, locale)),
                  locale,
                ),
              },
            ]
          : []),
        ...(facet.ticket
          ? [
              {
                key: 'ticket',
                term: t('ticket'),
                description: (
                  <span>
                    <Money
                      amount={{
                        amountMinor: facet.ticket.minAmountMinor,
                        currency: facet.ticket.currency,
                      }}
                    />
                    {' – '}
                    <Money
                      amount={{
                        amountMinor: facet.ticket.maxAmountMinor,
                        currency: facet.ticket.currency,
                      }}
                    />
                  </span>
                ),
              },
            ]
          : []),
        {
          key: 'mentoring',
          term: t('mentoring'),
          description: t(facet.mentoringAvailable ? 'mentoringYes' : 'mentoringNo'),
        },
        {
          key: 'missions',
          term: t('missions'),
          description: t(facet.openToExpertMissions ? 'missionsYes' : 'missionsNo'),
        },
      ]
    : [];
  return (
    <FacetCard kind="contributor" title={t('title')} editable={editable} hidden={!facet}>
      {facet ? (
        <>
          <Tags items={facet.hats.map((hat) => label(reference, 'contributorHats', hat))} />
          <DescriptionList items={items} />
          {facet.sectorCodes.length > 0 ? (
            <div className="grid gap-1.5">
              <Heading level={3} size="label">
                {t('sectors')}
              </Heading>
              <Tags
                items={facet.sectorCodes.map((code) => label(reference, 'sectorsShort', code))}
              />
            </div>
          ) : null}
          {facet.acceptedInstruments.length > 0 ? (
            <div className="grid gap-1.5">
              <Heading level={3} size="label">
                {t('instruments')}
              </Heading>
              <Tags
                items={facet.acceptedInstruments.map((code) =>
                  label(reference, 'fundingInstruments', code),
                )}
              />
            </div>
          ) : null}
          {facet.patronageTypes.length > 0 ? (
            <div className="grid gap-1.5">
              <Heading level={3} size="label">
                {t('patronage')}
              </Heading>
              <Tags
                items={facet.patronageTypes.map((code) => label(reference, 'patronageTypes', code))}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </FacetCard>
  );
}
