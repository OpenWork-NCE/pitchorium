import { projectImageMetadata, renderProjectImage } from '@/lib/seo/resource-share-image';

export const contentType = 'image/png';

/** Share image of a project: its visual, its title, the state of its funding and the brand. */
export function generateImageMetadata({ params }: { params: { locale: string; slug: string } }) {
  return projectImageMetadata('twitter', params.locale, params.slug);
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return renderProjectImage('twitter', locale, slug);
}
