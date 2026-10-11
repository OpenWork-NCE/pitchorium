import { editorialShareImage } from '@/lib/seo/editorial-share-image';

const share = editorialShareImage('openGraph', () => 'marketing.howItWorks.title');

export const contentType = 'image/png';
export const generateImageMetadata = share.generateImageMetadata;
export default share.Image;
