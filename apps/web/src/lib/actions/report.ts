'use client';

import type { ReportTargetType } from '@pitchorium/contracts';
import { createContext, use } from 'react';

/** What a member reports: a target of the api, a profile by its handle (§13). */
export interface ReportTarget {
  type: ReportTargetType;
  id: string;
}

/**
 * « Signaler » (§13): the member shell provides it (the dialog of the trust feature, loaded at its
 * first opening), the menus and actions of every feature call it. A context of its own, so that
 * no feature imports the trust feature for its dialog.
 */
export const ReportContext = createContext<((target: ReportTarget) => void) | null>(null);

/** Opens the report of a target; null outside the member space (a visitor). */
export function useReport(): ((target: ReportTarget) => void) | null {
  return use(ReportContext);
}
