/**
 * Public facade of the admin feature: the foundation of the console of the administration
 * (ADR 0172) that every screen of a domain uses (what the api lets the reader do, the sensitive
 * actions and their new sign-in, the text of a refusal), and the screens of the transverse
 * back office (dashboard, members, flags, highlights, failed jobs, audit log).
 */
export {
  ConsoleAccessProvider,
  type ConsoleAction,
  useConsoleAction,
  useConsoleRoles,
  useConsoleStates,
  useReauthenticationMinutes,
} from './components/console-access';
export {
  ReauthenticationNotice,
  RecentSessionHint,
  type SensitiveOutcome,
  useResumeEffect,
  useSensitiveAction,
} from './components/sensitive-action';
export { problemCodeOf, useConsoleProblem } from './components/use-console-problem';
export { Dashboard } from './components/dashboard';
export { MemberFile } from './components/members/member-file';
export { MemberResults } from './components/members/member-results';
export { SearchField } from './components/search-field';
export { type UrlFilter, UrlFilters } from './components/url-filters';
