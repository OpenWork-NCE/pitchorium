import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ImportRefusedError } from '../application/ports';
import { assertAllowedPhotoUrl } from './allowlisted-image.fetcher';
import { parseClamdReply } from './clamav.malware-scanner';
import { FileTypeDetector } from './file-type.detector';

describe('real type detection', () => {
  const detector = new FileTypeDetector();

  it('reads the magic bytes, whatever the client declared', async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    expect(await detector.detect(png)).toBe('image/png');
    expect(await detector.detect(Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1'))).toBe(
      'application/pdf',
    );
    expect(
      await detector.detect(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).not.toBe('image/png');
    expect(await detector.detect(Buffer.from('just text, renamed photo.jpg'))).toBeNull();
  });
});

describe('ClamAV replies', () => {
  it('parses clean, infected and error answers', () => {
    expect(parseClamdReply('stream: OK\0')).toEqual({ clean: true });
    expect(parseClamdReply('stream: Eicar-Test-Signature FOUND\0')).toEqual({
      clean: false,
      signature: 'Eicar-Test-Signature',
    });
    expect(() => parseClamdReply('INSTREAM size limit exceeded. ERROR\0')).toThrow();
  });
});

describe('provider photo URLs', () => {
  it('allows https on the closed list of hosts only', () => {
    expect(assertAllowedPhotoUrl('https://lh3.googleusercontent.com/a/photo').hostname).toBe(
      'lh3.googleusercontent.com',
    );
    for (const url of [
      'http://lh3.googleusercontent.com/a',
      'https://evil.example/a.jpg',
      'https://lh3.googleusercontent.com.evil.example/a',
      'https://user:secret@media.licdn.com/a',
      'https://media.licdn.com:8443/a',
      'https://169.254.169.254/latest/meta-data',
      'not a url',
    ]) {
      expect(() => assertAllowedPhotoUrl(url), url).toThrow(ImportRefusedError);
    }
  });
});
