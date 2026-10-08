import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import {
  type GlossaryEntry,
  type ProviderRequest,
  type ProviderResult,
  TranslationProvider,
  TranslationProviders,
} from '../application/ports';

const TIMEOUT_MS = 10_000;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** DeepL targets English by variant: British English for the European audience. */
export function deeplLanguage(code: string, asTarget: boolean): string {
  return asTarget && code === 'en' ? 'EN-GB' : code.toUpperCase();
}

/**
 * DeepL API v2 (developers.deepl.com): `POST /v2/translate`; the business glossary is a DeepL
 * glossary (`POST /v2/glossaries`, TSV entries) created once per content of the glossary and
 * per language pair, then referenced by its id.
 */
export class DeeplTranslationProvider extends TranslationProvider {
  readonly id = 'deepl' as const;
  private readonly glossaries = new Map<string, Promise<string>>();

  constructor(private readonly config: { apiKey: string; baseUrl: string }) {
    super();
  }

  private get headers(): Record<string, string> {
    return { authorization: `DeepL-Auth-Key ${this.config.apiKey}` };
  }

  async translate(request: ProviderRequest): Promise<ProviderResult> {
    const glossaryId =
      request.glossary.length > 0 && request.sourceLanguage
        ? await this.glossary(request.glossary, request.sourceLanguage, request.target)
        : null;
    const body = (await post(`${this.config.baseUrl}/v2/translate`, this.headers, {
      text: request.texts,
      target_lang: deeplLanguage(request.target, true),
      ...(request.sourceLanguage
        ? { source_lang: deeplLanguage(request.sourceLanguage, false) }
        : {}),
      ...(glossaryId ? { glossary_id: glossaryId } : {}),
    })) as { translations?: { text: string; detected_source_language?: string }[] };
    const translations = body.translations ?? [];
    if (translations.length !== request.texts.length) throw new Error('Unexpected DeepL answer');
    return {
      texts: translations.map((item) => item.text),
      detectedLanguage: translations[0]?.detected_source_language?.toLowerCase() ?? null,
    };
  }

  private glossary(
    entries: readonly GlossaryEntry[],
    source: string,
    target: Locale,
  ): Promise<string> {
    const pairs = entries.map((entry) =>
      source === 'fr' ? [entry.fr, entry.en] : [entry.en, entry.fr],
    );
    const tsv = pairs.map(([from, to]) => `${from}\t${to}`).join('\n');
    const key = `${source}-${target}-${createHash('sha256').update(tsv).digest('hex')}`;
    let id = this.glossaries.get(key);
    if (!id) {
      id = post(`${this.config.baseUrl}/v2/glossaries`, this.headers, {
        name: `pitchorium-${key.slice(0, 24)}`,
        source_lang: source,
        target_lang: target,
        entries: tsv,
        entries_format: 'tsv',
      }).then((body) => String((body as { glossary_id: string }).glossary_id));
      // A failure is retried at the next translation.
      id.catch(() => this.glossaries.delete(key));
      this.glossaries.set(key, id);
    }
    return id;
  }
}

/**
 * Google Cloud Translation Basic (v2, API key): `POST /language/translate/v2`, plain text; no
 * glossary on the Basic edition.
 */
export class GoogleTranslationProvider extends TranslationProvider {
  readonly id = 'google' as const;

  constructor(private readonly config: { apiKey: string }) {
    super();
  }

  async translate(request: ProviderRequest): Promise<ProviderResult> {
    const body = (await post(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(this.config.apiKey)}`,
      {},
      {
        q: request.texts,
        target: request.target,
        format: 'text',
        ...(request.sourceLanguage ? { source: request.sourceLanguage } : {}),
      },
    )) as {
      data?: { translations?: { translatedText: string; detectedSourceLanguage?: string }[] };
    };
    const translations = body.data?.translations ?? [];
    if (translations.length !== request.texts.length) throw new Error('Unexpected Google answer');
    return {
      texts: translations.map((item) => item.translatedText),
      detectedLanguage: translations[0]?.detectedSourceLanguage ?? null,
    };
  }
}

/**
 * Development and tests: marks the text with the target locale, applies the glossary and
 * detects French when the language is unknown. Refused in production.
 */
export class SimulatedTranslationProvider extends TranslationProvider {
  readonly id = 'simulated' as const;

  translate(request: ProviderRequest): Promise<ProviderResult> {
    return Promise.resolve({
      texts: request.texts.map((text) => {
        let translated = text;
        for (const entry of request.glossary) {
          const [from, to] = request.target === 'en' ? [entry.fr, entry.en] : [entry.en, entry.fr];
          translated = translated.replaceAll(from, to);
        }
        return `[${request.target}] ${translated}`;
      }),
      detectedLanguage: request.sourceLanguage ?? 'fr',
    });
  }
}

/** Providers of LOCALIZATION_PROVIDERS, in that order. */
@Injectable()
export class ConfiguredTranslationProviders extends TranslationProviders {
  private readonly providers: TranslationProvider[];

  constructor(@Inject(COMMON_CONFIG) config: CommonConfig) {
    super();
    const { deepl, google } = config.localization;
    this.providers = config.localization.providers.flatMap((id): TranslationProvider[] => {
      if (id === 'deepl') return deepl ? [new DeeplTranslationProvider(deepl)] : [];
      if (id === 'google') return google ? [new GoogleTranslationProvider(google)] : [];
      return [new SimulatedTranslationProvider()];
    });
  }

  list(): readonly TranslationProvider[] {
    return this.providers;
  }
}
