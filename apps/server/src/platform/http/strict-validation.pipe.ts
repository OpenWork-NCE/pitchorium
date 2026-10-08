import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { ZodValidationException, ZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

type Path = (string | number)[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keys of the input that parsing dropped: unknown to the contract, at any depth. */
export function unknownKeys(input: unknown, parsed: unknown, path: Path = []): Path[] {
  if (Array.isArray(input) && Array.isArray(parsed)) {
    return input.flatMap((item, index) => unknownKeys(item, parsed[index], [...path, index]));
  }
  if (!isPlainObject(input) || !isPlainObject(parsed)) return [];
  return Object.keys(input).flatMap((key) =>
    key in parsed ? unknownKeys(input[key], parsed[key], [...path, key]) : [[...path, key]],
  );
}

/**
 * Validates with the contract (nestjs-zod), then refuses a body carrying keys the contract does
 * not know, at any depth, instead of silently dropping them (ASVS V5.1.4): a misspelt field is
 * an error the client sees. Query strings keep their tolerance (cache busters, tracking).
 */
@Injectable()
export class StrictValidationPipe implements PipeTransform {
  private readonly zod = new ZodValidationPipe();

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const parsed: unknown = await this.zod.transform(value, metadata);
    if (metadata.type !== 'body' || parsed === value) return parsed;
    const unknown = unknownKeys(value, parsed);
    if (unknown.length > 0) {
      throw new ZodValidationException(
        new ZodError(
          unknown.map((path) => ({
            code: 'unrecognized_keys' as const,
            keys: [String(path.at(-1))],
            // The pointer names the unknown key itself, for the client to show it.
            path,
            message: `Unrecognized key: ${String(path.at(-1))}`,
          })),
        ),
      );
    }
    return parsed;
  }
}
