import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

/** The settings open on the account. */
export default async function Page({ params }: PageProps<'/[locale]/settings'>) {
  redirect(`/${(await params).locale}${routes.settingsAccount}`);
}
