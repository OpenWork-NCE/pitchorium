import { describe, expect, it, vi } from 'vitest';
import {
  type CompressionPlatform,
  compressImage,
  fittedSize,
  JPEG_QUALITY,
  needsCompression,
} from './image-compression';

/** A platform that records what it was asked, the image of the given size. */
function platform(width: number, height: number, outputBytes = 200_000) {
  const drawn: number[][] = [];
  const decode = vi.fn(() =>
    Promise.resolve({ width, height, close: vi.fn() } as unknown as Awaited<
      ReturnType<CompressionPlatform['decode']>
    >),
  );
  const toBlob = vi.fn(() =>
    Promise.resolve(new Blob([new Uint8Array(outputBytes)], { type: 'image/jpeg' })),
  );
  const fake: CompressionPlatform = {
    decode,
    canvas: (w, h) => ({
      getContext: () => ({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: (_image: unknown, ...args: number[]) => drawn.push([w, h, ...args]),
      }),
      toBlob,
    }),
  };
  return { fake, decode, toBlob, drawn };
}

const photo = (bytes: number, type = 'image/jpeg', name = 'IMG_2041.HEIC.jpeg') =>
  new File([new Uint8Array(bytes)], name, { type });

describe('compression of a photo before it is sent', () => {
  it('fits the longest side without ever enlarging', () => {
    expect(fittedSize(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fittedSize(3024, 4032)).toEqual({ width: 1536, height: 2048 });
    expect(fittedSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('keeps a light photo within the size as it is', () => {
    expect(
      needsCompression({ size: 500_000, type: 'image/jpeg' }, { width: 1600, height: 1200 }),
    ).toBe(false);
    expect(
      needsCompression({ size: 3_000_000, type: 'image/jpeg' }, { width: 1600, height: 1200 }),
    ).toBe(true);
    expect(
      needsCompression({ size: 500_000, type: 'image/png' }, { width: 4000, height: 3000 }),
    ).toBe(true);
    expect(
      needsCompression({ size: 9_000_000, type: 'image/gif' }, { width: 4000, height: 3000 }),
    ).toBe(false);
  });

  it('redraws a heavy photo upright, smaller, as a JPEG', async () => {
    const { fake, decode, toBlob, drawn } = platform(4032, 3024);
    const result = await compressImage(photo(4_500_000), fake);
    // The orientation of the camera is applied by the decoding itself.
    expect(decode).toHaveBeenCalledTimes(1);
    expect(drawn).toEqual([[2048, 1536, 0, 0, 2048, 1536]]);
    expect(toBlob).toHaveBeenCalledWith('image/jpeg', JPEG_QUALITY);
    expect(result).toMatchObject({ type: 'image/jpeg', name: 'IMG_2041.HEIC.jpg', size: 200_000 });
  });

  it('sends the original when the result is not lighter, or when it cannot decode', async () => {
    const heavy = photo(1_500_000);
    expect(await compressImage(heavy, platform(1600, 1200, 2_000_000).fake)).toBe(heavy);
    const broken: CompressionPlatform = {
      decode: () => Promise.reject(new Error('unsupported')),
      canvas: () => {
        throw new Error('never');
      },
    };
    expect(await compressImage(heavy, broken)).toBe(heavy);
  });
});
