import { renderResourceImage, resourceImageMetadata } from '@/lib/seo/resource-share-image';

export const contentType = 'image/png';

/** Share image of a public profile: its name and title (the default image otherwise). */
export function generateImageMetadata({ params }: { params: { locale: string; handle: string } }) {
  return resourceImageMetadata('twitter', 'member', params.locale, params.handle);
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;
  return renderResourceImage('twitter', 'member', locale, handle);
}
