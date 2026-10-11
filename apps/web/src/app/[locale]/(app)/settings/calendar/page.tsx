import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarSettings } from '@/features/events';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('calendar'), robots: { index: false, follow: false } };
}

/** « Calendrier » (ADR 0153): the secret address of the events of the member, for their calendar. */
export default async function Page({ params }: PageProps<'/[locale]/settings/calendar'>) {
  setRequestLocale(asLocale((await params).locale));
  return (
    <div className="grid gap-6 *:min-w-0">
      <CalendarSettings />
    </div>
  );
}
