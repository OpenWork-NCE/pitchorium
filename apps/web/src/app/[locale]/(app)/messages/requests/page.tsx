import * as routes from '@/config/paths';
import { redirect } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';

/** The address of the requests in the emails sent before the filter: the list filtered. */
export default async function Page({ params }: PageProps<'/[locale]/messages/requests'>) {
  redirect({ href: routes.messageRequests, locale: asLocale((await params).locale) });
}
