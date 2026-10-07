import sharp from 'sharp';

/** A valid one-page PDF (A4, one filled rectangle), with a correct cross-reference table. */
export function minimalPdf(): Buffer {
  const stream = '0 0 1 rg 50 50 200 200 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/** Starts like a PDF (same magic bytes), but nothing after the header is a PDF. */
export function corruptPdf(): Buffer {
  return Buffer.from(`%PDF-1.7\n${'garbage '.repeat(64)}\n%%EOF\n`, 'latin1');
}

export function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#2a6f97' } })
    .png()
    .toBuffer();
}

/**
 * JPEG taken "sideways": stored 1200x800 with EXIF orientation 6 (upright it is 800x1200),
 * carrying a camera model and GPS coordinates that must not survive processing.
 */
export function jpegWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: '#c0392b' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: 'TestCamera', Model: 'Sideways 1' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '14/1 41/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '17/1 26/1 0/1',
      },
    })
    .toBuffer();
}
