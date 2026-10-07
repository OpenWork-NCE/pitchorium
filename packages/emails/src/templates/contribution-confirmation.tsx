import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export type ContributionKindLabel = 'donation' | 'reward_crowdfunding' | 'love_money';

export interface ContributionConfirmationEmailProps {
  locale: Locale;
  name: string;
  project: string;
  kind: ContributionKindLabel;
  /** Amount paid with its currency, for example `50.00 EUR` or `65596 XOF`. */
  amount: string;
  /** Commission kept by Pitchorium, in the same currency. */
  commission: string;
  /** Rendered as UTC. */
  paidAt: string;
  reward?: string;
  reference: string;
  projectUrl: string;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `contributionConfirmation.${key}`, params);

export function contributionConfirmationSubject(props: ContributionConfirmationEmailProps): string {
  return t(props.locale, 'subject', { project: props.project });
}

/**
 * Confirmation of a paid contribution (section 9.3 step 6). Explicitly not a tax receipt; the
 * mentions of section 9.5 come with it.
 */
export default function ContributionConfirmationEmail(props: ContributionConfirmationEmailProps) {
  const { locale, name, project, kind, amount, commission, paidAt, reward, reference } = props;
  return (
    <Layout locale={locale} preview={t(locale, 'preview', { project })}>
      <Title>{t(locale, 'heading', { name })}</Title>
      <Paragraph>{t(locale, 'body', { amount, project, paidAt })}</Paragraph>
      <Paragraph>{t(locale, `kinds.${kind}`)}</Paragraph>
      <Paragraph>{t(locale, 'commission', { commission })}</Paragraph>
      {reward ? <Paragraph>{t(locale, 'reward', { reward })}</Paragraph> : null}
      <ActionLink href={props.projectUrl} label={t(locale, 'action')} />
      <Note>{t(locale, 'notTaxReceipt')}</Note>
      <Note>{t(locale, 'mentions')}</Note>
      <Note>{t(locale, 'reference', { reference })}</Note>
    </Layout>
  );
}

ContributionConfirmationEmail.PreviewProps = {
  locale: 'fr',
  name: 'Amina',
  project: 'Sahel Agri : irrigation solaire',
  kind: 'reward_crowdfunding',
  amount: '50.00 EUR',
  commission: '2.50 EUR',
  paidAt: '2026-10-07 09:30',
  reward: 'Visite de la coopérative',
  reference: '01999999-0000-7000-8000-000000000001',
  projectUrl: 'https://app.pitchorium.example/projects/sahel-agri',
} satisfies ContributionConfirmationEmailProps;
