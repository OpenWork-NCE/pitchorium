/** One entry of the archive: a JSON of a module, a file of the member. */
export interface ArchiveEntry {
  name: string;
  content: Buffer;
}

export interface WrittenArchive {
  /** Local file, removed by the caller once uploaded. */
  path: string;
  size: number;
}

/** Port: writes a ZIP archive to a temporary file, entry after entry. */
export abstract class ArchiveWriter {
  abstract write(entries: AsyncIterable<ArchiveEntry>): Promise<WrittenArchive>;
}
