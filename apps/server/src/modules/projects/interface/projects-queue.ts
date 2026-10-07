/** BullMQ queue of the projects module (worker): scheduled tasks. */
export const PROJECTS_QUEUE = 'projects.maintenance';

export const PROJECTS_JOBS = {
  closeEnded: 'close-ended',
  announceEndingSoon: 'announce-ending-soon',
} as const;
