'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import {
  formatOffset,
  timeZones,
  zoneCity,
  zoneOffsetMinutes,
  zoneRegion,
} from '@/lib/format/zoned-time';
import { Combobox } from './combobox';

interface TimeZoneSelectProps {
  /** IANA zone. */
  value: string;
  onChange: (zone: string) => void;
  /** Instant at which the offset is read (the start of the event), now by default. */
  at?: string | null | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
}

/** `Dakar, GMT+0` in the words of the page (ADR 0100). */
function useZoneLabel(at?: string | null) {
  const t = useTranslations('web.ui.timeZone');
  // Without a date, the offset of the moment the form opened.
  const [opened] = useState(() => Date.now());
  const epoch = at ? Date.parse(at) : opened;
  return useCallback(
    (zone: string) =>
      t('label', { city: zoneCity(zone), offset: formatOffset(zoneOffsetMinutes(zone, epoch)) }),
    [t, epoch],
  );
}

/**
 * The time zone of the dates of a form, said once next to them in a readable form (`Dakar,
 * GMT+0`) and changed by searching a city or a region (ADR 0100). The offset is the one of the
 * date entered: Paris is GMT+1 in winter, GMT+2 in summer.
 */
export function TimeZoneSelect({ value, onChange, at, ...props }: TimeZoneSelectProps) {
  const locale = useLocale();
  const t = useTranslations('web.ui.timeZone');
  const label = useZoneLabel(at);
  const options = useMemo(
    () =>
      timeZones()
        .map((zone) => ({ value: zone, label: label(zone), hint: zoneRegion(zone) || zone }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [label, locale],
  );
  return (
    <Combobox
      {...props}
      options={options}
      value={value}
      placeholder={t('search')}
      selectedLabels={{ [value]: label(value) }}
      onValueChange={(zone) => {
        if (zone) onChange(zone);
      }}
    />
  );
}
