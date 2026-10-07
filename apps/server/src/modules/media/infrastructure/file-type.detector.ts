import { Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { ContentTypeDetector } from '../application/ports';

/** Real type from the magic bytes (file-type); the declared type is never used. */
@Injectable()
export class FileTypeDetector extends ContentTypeDetector {
  async detect(content: Buffer): Promise<string | null> {
    return (await fileTypeFromBuffer(content))?.mime ?? null;
  }
}
