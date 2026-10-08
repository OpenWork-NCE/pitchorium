export interface FlagChangeRecord {
  id: string;
  key: string;
  enabled: boolean;
  legalReference: string | null;
  changedBy: string;
  changedAt: Date;
}

export abstract class AdminRepository {
  abstract insertFlagChange(record: FlagChangeRecord): Promise<void>;
  /** Latest legal reference recorded for each flag. */
  abstract legalReferences(): Promise<Map<string, string>>;
  abstract flagChangesBy(userId: string): Promise<FlagChangeRecord[]>;
}
