import sharp from 'sharp';

export type DemoImageKind = 'avatar' | 'cover' | 'logo' | 'post';

const SIZES: Readonly<Record<DemoImageKind, { width: number; height: number }>> = {
  avatar: { width: 600, height: 600 },
  cover: { width: 1600, height: 400 },
  logo: { width: 600, height: 600 },
  post: { width: 1200, height: 800 },
};

/**
 * Abstract demonstration image (gradient and shapes, no text: no font is needed), PNG,
 * deterministic for a kind, a hue and a variant.
 */
export function demoImage(kind: DemoImageKind, hue: number, variant = 0): Promise<Buffer> {
  const { width, height } = SIZES[kind];
  const second = (hue + 40 + variant * 25) % 360;
  const shapes =
    kind === 'post'
      ? Array.from({ length: 5 }, (_, index) => {
          const x = ((index * 263 + variant * 97) % width) + 40;
          const y = ((index * 151 + variant * 53) % height) + 40;
          return `<circle cx="${x}" cy="${y}" r="${80 + index * 30}" fill="hsl(${(second + index * 30) % 360},70%,60%)" fill-opacity="0.45"/>`;
        }).join('')
      : `<circle cx="${width * 0.7}" cy="${height * 0.35}" r="${Math.min(width, height) * 0.3}" fill="hsl(${second},75%,65%)" fill-opacity="0.5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},65%,45%)"/>
      <stop offset="1" stop-color="hsl(${second},65%,30%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Abstract demonstration document: a PDF of `pages` A4 pages, each with coloured blocks (no text:
 * no font is needed), with a correct cross-reference table; deterministic for a hue.
 */
export function demoDocument(hue: number, pages: number): Buffer {
  const colour = (shift: number) => {
    const h = ((hue + shift) % 360) / 360;
    return [h, 0.55, 0.75].map((value) => value.toFixed(2)).join(' ');
  };
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const kids: string[] = [];
  for (let page = 0; page < pages; page += 1) {
    const stream = [
      `${colour(page * 20)} rg 50 700 495 90 re f`,
      `${colour(page * 20 + 120)} rg 50 ${560 - page * 10} 300 110 re f`,
      `${colour(page * 20 + 240)} rg 370 ${420 + page * 10} 175 250 re f`,
    ].join('\n');
    const pageNumber = objects.length + 1;
    kids.push(`${pageNumber} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${pageNumber + 1} 0 R /Resources << >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`;
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
