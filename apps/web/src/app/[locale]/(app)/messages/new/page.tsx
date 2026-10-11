import {
  ApiProblemError,
  messagingControllerWithMember,
  profilesControllerForMember,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as routes from '@/config/paths';
import { NewConversation } from '@/features/messaging';
import { redirect } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

const HANDLE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.messaging.new');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** A member the reader may not see or write to is absent for them: 404, never the reason. */
function absent(error: unknown): null {
  if (error instanceof ApiProblemError && error.problem.status < 500) return null;
  throw error;
}

/**
 * A first message to a member (`?to=<handle>`, §10.4): their conversation when it exists, or
 * the page of a first message with what the api says it will be (direct, a request, refused).
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/messages/new'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const query = await searchParams;
  const handle = typeof query['to'] === 'string' ? query['to'] : '';
  if (!HANDLE.test(handle)) notFound();
  configureServerApi();
  const [availability, profile] = await Promise.all([
    messagingControllerWithMember(handle, { cache: 'no-store' }).catch(absent),
    profilesControllerForMember(handle, { cache: 'no-store' }).catch(absent),
  ]);
  if (!availability || !profile) notFound();
  if (availability.conversationId) {
    redirect({ href: routes.conversation(availability.conversationId), locale });
  }
  return (
    <NewConversation
      member={{
        handle: profile.handle,
        displayName: profile.displayName,
        headline: profile.headline,
        avatarUrl: profile.avatarUrl,
      }}
      availability={availability}
    />
  );
}
