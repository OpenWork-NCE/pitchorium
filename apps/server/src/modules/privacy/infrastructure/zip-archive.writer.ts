import { createWriteStream } from 'node:fs';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Zip, ZipDeflate } from 'fflate';
import {
  type ArchiveEntry,
  ArchiveWriter,
  type WrittenArchive,
} from '../application/archive-writer';

/**
 * ZIP written in a stream to a temporary file (fflate), so that an archive holding the files
 * of a member never sits whole in memory.
 */
@Injectable()
export class ZipArchiveWriter extends ArchiveWriter {
  async write(entries: AsyncIterable<ArchiveEntry>): Promise<WrittenArchive> {
    const directory = await mkdtemp(join(tmpdir(), 'pitchorium-export-'));
    const path = join(directory, 'export.zip');
    const output = createWriteStream(path);
    const closed = new Promise<void>((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
    const state: { failure?: Error } = {};
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        state.failure = error;
        output.destroy(error);
        return;
      }
      output.write(chunk);
      if (final) output.end();
    });
    for await (const entry of entries) {
      const file = new ZipDeflate(entry.name, { level: 6 });
      zip.add(file);
      file.push(entry.content, true);
    }
    zip.end();
    await closed;
    if (state.failure) throw state.failure;
    return { path, size: (await stat(path)).size };
  }
}
