'use client';

import {
  engagementControllerMyHistory,
  engagementControllerOrganizationHistory,
} from '@pitchorium/api-client';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { downloadCsv } from '@/lib/files/download-csv';

/** The downloadable history of the engagement (section 9.4), a CSV of the api. */
export function HistoryDownload({ organizationId }: { organizationId: string | null }) {
  const t = useTranslations('web.engagement.history');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const csv = organizationId
        ? await engagementControllerOrganizationHistory(organizationId)
        : await engagementControllerMyHistory();
      downloadCsv(csv, organizationId ? 'engagement-organisation.csv' : 'engagement.csv');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-1">
      <Button
        variant="outline"
        loading={busy}
        loadingLabel={t('downloading')}
        onClick={() => void download()}
      >
        <Download aria-hidden />
        {t('download')}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('failed')}
        </p>
      ) : null}
    </div>
  );
}
