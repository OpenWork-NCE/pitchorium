import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** A translation was served; no member identifier, `cached` when no provider was called. */
export class TranslationRequested extends DomainEvent<{
  sourceType: string;
  targetLocale: string;
  provider: string;
  characters: number;
  cached: boolean;
}> {
  static readonly TYPE = 'localization.translation.requested.v1';
  readonly type = TranslationRequested.TYPE;
  readonly aggregateType = 'translation';
  constructor(props: DomainEventProps<TranslationRequested['payload']>) {
    super(props);
  }
}

export class LocaleEnabled extends DomainEvent<{ locale: string; by: string }> {
  static readonly TYPE = 'localization.locale.enabled.v1';
  readonly type = LocaleEnabled.TYPE;
  readonly aggregateType = 'locale';
  constructor(props: DomainEventProps<LocaleEnabled['payload']>) {
    super(props);
  }
}

export class LocaleDisabled extends DomainEvent<{ locale: string; by: string }> {
  static readonly TYPE = 'localization.locale.disabled.v1';
  readonly type = LocaleDisabled.TYPE;
  readonly aggregateType = 'locale';
  constructor(props: DomainEventProps<LocaleDisabled['payload']>) {
    super(props);
  }
}
