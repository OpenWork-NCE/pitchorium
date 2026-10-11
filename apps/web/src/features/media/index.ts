/**
 * Public facade of the media feature: files sent through the media module of the api, and the
 * framing of an image before it goes.
 */
export { ImageCropDialog, type ImageTexts } from './components/image-crop-dialog';
export { MediaRejectedError, type UploadStep, uploadMedia } from './lib/upload';
/** The same, loaded on demand (a page that sends a file now and then). */
export const loadUpload = () => import('./lib/upload');
