'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  AlertDialog,
  Button,
  Dialog,
  DialogContent,
  Field,
  FormActions,
  ProgressRing,
  Slider,
} from '@/components/ui';
import { cropToBlob, IMAGE_FORMATS, type ImageKind } from '../lib/crop';
import { MediaRejectedError, type UploadStep, uploadMedia } from '../lib/upload';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Stage =
  | { name: 'choose' }
  | { name: 'crop'; source: string }
  | { name: 'send'; progress: UploadStep }
  | { name: 'failed'; reason: string | null };

/** Loads a picked file as an image element, for the canvas of the crop. */
function imageOf(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = source;
  });
}

/** The texts of the place of the image: its name, what fits, its removal. */
export interface ImageTexts {
  title: string;
  description: string;
  limits: string;
  remove: string;
  removeTitle: string;
  removeDescription: string;
}

/**
 * A framed image (a photo, a logo, a cover; ADR 0111): the file is chosen, framed and zoomed in
 * the browser to the ratio of its place (square, 4:1), drawn at the size the api keeps, then
 * sent through the media module, its progress on a ring, then checked by the worker (antivirus,
 * real type, variants without metadata) before `attach` gives it to its resource. The server
 * alone cleans the file.
 */
export function ImageCropDialog({
  kind,
  texts,
  hasCurrent,
  attach,
  remove,
  onClose,
}: {
  kind: ImageKind;
  texts: ImageTexts;
  /** An image is in place: it may be removed. */
  hasCurrent: boolean;
  attach: (mediaId: string) => Promise<unknown>;
  remove: () => Promise<unknown>;
  /** `changed`: the image was replaced or removed, the page reads its resource again. */
  onClose: (changed: boolean) => void;
}) {
  const t = useTranslations('web.media.image');
  const rejections = useTranslations('reference.mediaRejectionReasons');
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ name: 'choose' });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const area = useRef<Area | null>(null);
  const format = IMAGE_FORMATS[kind];
  const source = stage.name === 'crop' ? stage.source : null;
  const round = kind === 'avatar';

  // The address of a picked file lives as long as its crop.
  useEffect(() => () => void (source && URL.revokeObjectURL(source)), [source]);

  function pick(file: File | undefined) {
    if (!file) return;
    setZoom(MIN_ZOOM);
    setCrop({ x: 0, y: 0 });
    setStage({ name: 'crop', source: URL.createObjectURL(file) });
  }

  async function send(from: string) {
    if (!area.current) return;
    // The image is drawn before the address of the file is let go with the crop stage.
    const image = await imageOf(from);
    setStage({ name: 'send', progress: { step: 'sending', progress: 0 } });
    try {
      const blob = await cropToBlob(image, area.current, kind);
      const mediaId = await uploadMedia(blob, format.usage, (progress) =>
        setStage({ name: 'send', progress }),
      );
      await attach(mediaId);
      onClose(true);
    } catch (error) {
      setStage({
        name: 'failed',
        reason: error instanceof MediaRejectedError ? error.reason : null,
      });
    }
  }

  const failure =
    stage.name === 'failed'
      ? stage.reason && rejections.has(stage.reason as never)
        ? rejections(stage.reason as never)
        : t('failed')
      : null;
  const progressText =
    stage.name === 'send' && stage.progress.step === 'sending'
      ? t('sendingValue', { percent: Math.round(stage.progress.progress * 100) })
      : t('checking');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent title={texts.title} description={texts.description} size="lg">
        <input
          ref={picker}
          type="file"
          accept={ACCEPTED}
          hidden
          data-image-input=""
          onChange={(event) => {
            const [file] = event.target.files ?? [];
            event.target.value = '';
            pick(file);
          }}
        />
        {stage.name === 'crop' ? (
          <div className="grid gap-4">
            <div
              className="relative h-72 overflow-hidden rounded-lg bg-surface-sunken sm:h-80"
              data-crop-area=""
            >
              <Cropper
                image={stage.source}
                crop={crop}
                zoom={zoom}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                aspect={format.aspect}
                cropShape={round ? 'round' : 'rect'}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => {
                  area.current = pixels;
                }}
              />
            </div>
            <p className="text-sm text-muted">{t('cropHint')}</p>
            <Field label={t('zoom')}>
              <Slider
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={[zoom]}
                showValue={false}
                formatValue={(value) => t('zoomValue', { percent: Math.round(value * 100) })}
                onValueChange={([value]) => setZoom(value ?? MIN_ZOOM)}
              />
            </Field>
            <FormActions>
              <Button onClick={() => void send(stage.source)}>{t('save')}</Button>
              <Button variant="ghost" onClick={() => picker.current?.click()}>
                {t('another')}
              </Button>
            </FormActions>
          </div>
        ) : null}
        {stage.name === 'send' ? (
          <div className="flex items-center gap-4" aria-live="polite">
            <ProgressRing
              value={stage.progress.step === 'sending' ? stage.progress.progress : null}
              label={t('sending')}
              valueText={progressText}
            />
            <p className="text-sm">{progressText}</p>
          </div>
        ) : null}
        {stage.name === 'choose' || stage.name === 'failed' ? (
          <div className="grid gap-4">
            {failure ? (
              <p role="alert" className="text-sm text-danger">
                {failure}
              </p>
            ) : null}
            <p className="text-sm text-muted">{texts.limits}</p>
            <FormActions>
              <Button onClick={() => picker.current?.click()}>{t('choose')}</Button>
              {hasCurrent ? (
                <AlertDialog
                  trigger={
                    <Button variant="ghost" className="text-danger">
                      {texts.remove}
                    </Button>
                  }
                  title={texts.removeTitle}
                  description={texts.removeDescription}
                  confirmLabel={texts.remove}
                  onConfirm={async () => {
                    await remove();
                    onClose(true);
                  }}
                />
              ) : null}
              <Button variant="ghost" onClick={() => onClose(false)}>
                {t('cancel')}
              </Button>
            </FormActions>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
