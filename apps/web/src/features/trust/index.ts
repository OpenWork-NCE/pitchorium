/**
 * Public facade of the trust feature (§13): « Signaler » (its dialog, opened through the member
 * shell, and its button), the notice of illegal content without an account, and the page of the
 * moderation decisions that concern the member, with their appeal, and the state of a suspended
 * account in place of the feed.
 */
export { ModerationSettings } from './components/moderation-settings';
export { NoticeForm } from './components/notice-form';
export { ReportButton } from './components/report-button';
export { default as ReportDialog } from './components/report-dialog';
export { SuspendedState } from './components/suspended-state';
