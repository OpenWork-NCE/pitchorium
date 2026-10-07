import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import type * as PdfJsModule from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfInspector } from '../application/ports';

/** A hostile document must not keep a worker busy. */
const TIMEOUT_MS = 30_000;
const MAX_SCALE = 4;
/** Embedded images larger than this are not decoded. */
const MAX_IMAGE_PIXELS = 50_000_000;

type PdfJs = typeof PdfJsModule;
let pdfjs: Promise<PdfJs> | undefined;

/** pdf.js is an ES module: loaded once, on first use. */
const loadPdfJs = () => (pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs'));

/**
 * pdf.js (Apache 2.0) with @napi-rs/canvas: the document must parse, every page must be
 * reachable, and the first page is rendered to PNG for the thumbnail. pdf.js 6 runs no script
 * from the document.
 */
@Injectable()
export class PdfJsInspector extends PdfInspector {
  private readonly logger = new Logger(PdfJsInspector.name);

  async inspect(
    content: Buffer,
    thumbnailWidth: number,
  ): Promise<{ pageCount: number; firstPage: Buffer } | null> {
    const { getDocument } = await loadPdfJs();
    const task = getDocument({
      data: new Uint8Array(content),
      disableFontFace: true,
      maxImageSize: MAX_IMAGE_PIXELS,
      stopAtErrors: true,
      verbosity: 0,
    });
    const timer = setTimeout(() => void task.destroy(), TIMEOUT_MS);
    try {
      const document = await task.promise;
      // Every page must be reachable: a broken page tree is a corrupt document.
      for (let number = 2; number <= document.numPages; number += 1) {
        await document.getPage(number);
      }
      const page = await document.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(MAX_SCALE, thumbnailWidth / base.width),
      });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas, viewport }).promise;
      return { pageCount: document.numPages, firstPage: canvas.toBuffer('image/png') };
    } catch (error) {
      this.logger.warn(`Unreadable PDF: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      clearTimeout(timer);
      await task.destroy();
    }
  }
}
