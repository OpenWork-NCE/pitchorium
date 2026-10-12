import { Injectable } from '@nestjs/common';
import { detectLanguage } from '../../../platform/kernel';
import { LanguageDetector } from '../application/ports';

/** Statistical detection (trigrams) of the kernel; texts under 10 characters stay undetermined. */
@Injectable()
export class FrancLanguageDetector extends LanguageDetector {
  detect(text: string): string | null {
    return detectLanguage(text);
  }
}
