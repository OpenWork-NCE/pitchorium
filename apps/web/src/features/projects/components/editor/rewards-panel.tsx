'use client';

import {
  rewardsControllerCreate,
  rewardsControllerDelete,
  rewardsControllerUpdate,
} from '@pitchorium/api-client';
import type { ProjectReward, RewardInstrument } from '@pitchorium/contracts';
import { Lock, Pencil, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Field,
  FormActions,
  Heading,
  Input,
  MoneyInput,
  Switch,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { pluralOf } from '@/lib/i18n/plural-of';
import { PROJECT_LIMITS } from '../../lib/limits';
import { lockedFields } from '../../lib/locked';
import { useProblemText } from '../shared/use-problem-text';
import { useProjectEditor } from './editor-context';

const REWARD_INSTRUMENTS: readonly RewardInstrument[] = ['donation', 'reward_crowdfunding'];

interface Draft {
  title: string;
  description: string;
  minAmountMinor: string | null;
  instruments: RewardInstrument[];
  limited: boolean;
  quantity: string;
  estimatedDelivery: string;
}

const EMPTY: Draft = {
  title: '',
  description: '',
  minAmountMinor: null,
  instruments: [],
  limited: false,
  quantity: '',
  estimatedDelivery: '',
};

const draftOf = (reward: ProjectReward): Draft => ({
  title: reward.title,
  description: reward.description,
  minAmountMinor: reward.minAmount.amountMinor,
  instruments: reward.instruments,
  limited: reward.quantity !== null,
  quantity: reward.quantity === null ? '' : String(reward.quantity),
  estimatedDelivery: reward.estimatedDelivery ?? '',
});

/**
 * The rewards of a project (§11.1, §11.3, ADR 0041): title, description, minimum amount, the
 * instruments that give them (among those the project accepts), a limited or unlimited quantity
 * with the units left, an estimated delivery. Love money has no material reward. After the first
 * paid contribution, the minimum of an existing reward is locked; a reserved reward cannot be
 * deleted (the api says so). Used by the assistant and by the management.
 */
export function RewardsPanel() {
  const t = useTranslations('web.projects.editor.rewards');
  const reference = useTranslations('reference.fundingInstruments');
  const locale = useLocale();
  const { project, refresh } = useProjectEditor();
  // The id of the reward being edited, `new` for a new one.
  const [editing, setEditing] = useState<string | null>(null);
  const accepted = REWARD_INSTRUMENTS.filter((instrument) =>
    project.funding.instruments.includes(instrument),
  );
  return (
    <div className="grid gap-6">
      {project.funding.instruments.includes('love_money') ? (
        <Callout title={t('loveMoneyTitle')}>{t('loveMoneyBody')}</Callout>
      ) : null}
      {accepted.length === 0 ? (
        <Callout title={t('noInstrumentTitle')}>{t('noInstrumentBody')}</Callout>
      ) : null}
      {project.rewards.length === 0 && editing !== 'new' ? (
        <Text tone="muted">{t('empty')}</Text>
      ) : null}
      <ul className="grid gap-4">
        {project.rewards.map((reward) => (
          <li key={reward.id}>
            {editing === reward.id ? (
              <RewardForm
                reward={reward}
                accepted={accepted}
                onDone={async () => {
                  setEditing(null);
                  await refresh();
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <Card padding="sm" className="grid gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Heading level={3} size="label">
                    {reward.title}
                  </Heading>
                  <span className="text-sm tabular-nums">
                    {t('from', { amount: formatMoney(reward.minAmount, locale) })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-line">{reward.description}</p>
                <div className="flex flex-wrap gap-2">
                  {reward.instruments.map((instrument) => (
                    <Badge key={instrument}>{reference(instrument)}</Badge>
                  ))}
                  <Badge tone={reward.soldOut ? 'warning' : 'neutral'}>
                    {reward.soldOut
                      ? t('soldOut')
                      : reward.available === null
                        ? t('unlimited')
                        : t(`stock.${pluralOf(locale, reward.available)}`, {
                            count: reward.available,
                            total: reward.quantity ?? reward.available,
                          })}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(reward.id)}
                  >
                    <Pencil aria-hidden />
                    {t('edit', { title: reward.title })}
                  </Button>
                  <DeleteReward reward={reward} />
                </div>
              </Card>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <RewardForm
          reward={null}
          accepted={accepted}
          onDone={async () => {
            setEditing(null);
            await refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : accepted.length > 0 ? (
        <div>
          <Button type="button" variant="secondary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('add')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DeleteReward({ reward }: { reward: ProjectReward }) {
  const t = useTranslations('web.projects.editor.rewards');
  const { project, refresh } = useProjectEditor();
  const problemText = useProblemText();
  const announce = useAnnounce();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <AlertDialog
        trigger={
          <Button type="button" variant="ghost" size="sm">
            {t('delete')}
          </Button>
        }
        title={t('deleteTitle', { title: reward.title })}
        description={t('deleteBody')}
        confirmLabel={t('deleteConfirm')}
        cancelLabel={t('cancel')}
        onConfirm={async () => {
          try {
            await rewardsControllerDelete(project.id, reward.id);
            announce(t('deleted'));
            await refresh();
          } catch (problem) {
            setError(problemText(problem));
          }
        }}
      />
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

function RewardForm({
  reward,
  accepted,
  onDone,
  onCancel,
}: {
  reward: ProjectReward | null;
  accepted: readonly RewardInstrument[];
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations('web.projects.editor.rewards');
  const reference = useTranslations('reference.fundingInstruments');
  const locked = useTranslations('web.projects.editor.locked');
  const problemText = useProblemText();
  const { project } = useProjectEditor();
  const minimumLocked =
    reward !== null &&
    lockedFields(project.status, project.management?.fundingLocked ?? false).rewardMinimums !==
      null;
  const [draft, setDraft] = useState<Draft>(reward ? draftOf(reward) : EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  function check(): boolean {
    const found: Partial<Record<keyof Draft, string>> = {};
    if (!draft.title.trim()) found.title = t('errors.title');
    if (!draft.description.trim()) found.description = t('errors.description');
    if (!draft.minAmountMinor || BigInt(draft.minAmountMinor) <= 0n) {
      found.minAmountMinor = t('errors.minAmount');
    }
    if (draft.instruments.length === 0) found.instruments = t('errors.instruments');
    const quantity = Number(draft.quantity);
    if (draft.limited && (!Number.isInteger(quantity) || quantity < 1)) {
      found.quantity = t('errors.quantity');
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function submit() {
    if (!check()) return;
    setBusy(true);
    setProblem(null);
    const body = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      ...(minimumLocked
        ? {}
        : { minAmount: { amountMinor: draft.minAmountMinor!, currency: 'EUR' } }),
      instruments: draft.instruments,
      quantity: draft.limited ? Number(draft.quantity) : null,
      estimatedDelivery: draft.estimatedDelivery || null,
    };
    try {
      if (reward) await rewardsControllerUpdate(project.id, reward.id, body);
      else {
        await rewardsControllerCreate(project.id, {
          ...body,
          minAmount: { amountMinor: draft.minAmountMinor!, currency: 'EUR' },
        });
      }
      await onDone();
    } catch (error) {
      setProblem(problemText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="sm" className="grid gap-4">
      <Heading level={3} size="label">
        {reward ? t('editTitle', { title: reward.title }) : t('newTitle')}
      </Heading>
      <Field
        label={t('title')}
        error={errors.title}
        counter={{ count: draft.title.length, max: PROJECT_LIMITS.rewardTitle }}
      >
        <Input value={draft.title} onChange={(event) => set({ title: event.target.value })} />
      </Field>
      <Field
        label={t('description')}
        error={errors.description}
        counter={{ count: draft.description.length, max: PROJECT_LIMITS.rewardDescription }}
      >
        <Textarea
          value={draft.description}
          rows={3}
          onChange={(event) => set({ description: event.target.value })}
        />
      </Field>
      <Field
        label={t('minAmount')}
        error={errors.minAmountMinor}
        description={minimumLocked ? locked('contribution') : undefined}
        disabled={minimumLocked}
      >
        <MoneyInput
          currency="EUR"
          value={draft.minAmountMinor}
          disabled={minimumLocked}
          onChange={(value) => set({ minAmountMinor: value })}
        />
      </Field>
      {minimumLocked ? (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Lock aria-hidden className="size-4" />
          {locked('contribution')}
        </p>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t('instruments')}</legend>
        {accepted.map((instrument) => (
          <Checkbox
            key={instrument}
            label={reference(instrument)}
            checked={draft.instruments.includes(instrument)}
            onCheckedChange={(checked) =>
              set({
                instruments:
                  checked === true
                    ? [...draft.instruments, instrument]
                    : draft.instruments.filter((item) => item !== instrument),
              })
            }
          />
        ))}
        {errors.instruments ? <p className="text-sm text-danger">{errors.instruments}</p> : null}
      </fieldset>
      <div className="flex items-center gap-3">
        <Switch
          checked={draft.limited}
          onCheckedChange={(checked) => set({ limited: checked })}
          aria-label={t('limited')}
        />
        <span className="text-sm">{t('limited')}</span>
      </div>
      {draft.limited ? (
        <Field label={t('quantity')} error={errors.quantity} description={t('quantityHint')}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.quantity}
            onChange={(event) => set({ quantity: event.target.value })}
          />
        </Field>
      ) : null}
      <Field label={t('delivery')} optional description={t('deliveryHint')}>
        <Input
          type="date"
          value={draft.estimatedDelivery}
          onChange={(event) => set({ estimatedDelivery: event.target.value })}
        />
      </Field>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <FormActions>
        <Button
          type="button"
          loading={busy}
          loadingLabel={t('saving')}
          onClick={() => void submit()}
        >
          {reward ? t('save') : t('create')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </FormActions>
    </Card>
  );
}
