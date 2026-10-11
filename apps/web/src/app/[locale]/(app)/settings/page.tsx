import { redirect } from 'next/navigation';
import * as routes from '@/config/paths';

/** The settings open on the account. */
export default async function Page({ params }: PageProps<'/[locale]/settings'>) {
  redirect(`/${(await params).locale}${routes.settingsAccount}`);
}
