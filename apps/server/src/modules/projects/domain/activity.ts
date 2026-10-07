import type { ProjectInterestKind, ProjectModerationStatus } from '@pitchorium/contracts';

/** A campaign update (section 11.3); its visibility follows the project's. */
export interface UpdateRecord {
  id: string;
  projectId: string;
  authorId: string;
  text: string;
  imageMediaIds: string[];
  moderationStatus: ProjectModerationStatus;
  publishedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

/** An expression of interest (sections 9.1 and 11.2): never a payment. */
export interface InterestRecord {
  id: string;
  projectId: string;
  userId: string;
  kind: ProjectInterestKind;
  message: string;
  indicativeAmountMinor: bigint | null;
  indicativeCurrency: string | null;
  documentMediaIds: string[];
  createdAt: Date;
}
