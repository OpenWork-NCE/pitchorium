import { renderResourceImage, resourceImageMetadata } from '@/lib/seo/resource-share-image';

export const contentType = 'image/png';

/** Share image of a public event: its title, its date and hour in its zone, its city. */
export function generateImageMetadata({ params }: { params: { locale: string; slug: string } }) {
  return resourceImageMetadata('twitter', 'event', params.locale, params.slug);
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return renderResourceImage('twitter', 'event', locale, slug);
}
