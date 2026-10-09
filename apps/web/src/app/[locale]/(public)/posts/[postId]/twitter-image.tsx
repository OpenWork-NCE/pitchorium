import { renderResourceImage, resourceImageMetadata } from '@/lib/seo/resource-share-image';

export const contentType = 'image/png';

/** Share image of a public publication: its author and the start of its text (next/og). */
export function generateImageMetadata({ params }: { params: { locale: string; postId: string } }) {
  return resourceImageMetadata('twitter', 'post', params.locale, params.postId);
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; postId: string }>;
}) {
  const { locale, postId } = await params;
  return renderResourceImage('twitter', 'post', locale, postId);
}
