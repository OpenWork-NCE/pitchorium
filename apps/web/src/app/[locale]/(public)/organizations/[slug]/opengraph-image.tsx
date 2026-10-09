import { renderResourceImage, resourceImageMetadata } from '@/lib/seo/resource-share-image';

export const contentType = 'image/png';

/** Share image of an organisation: its name and type of structure. */
export function generateImageMetadata({ params }: { params: { locale: string; slug: string } }) {
  return resourceImageMetadata('openGraph', 'organization', params.locale, params.slug);
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return renderResourceImage('openGraph', 'organization', locale, slug);
}
