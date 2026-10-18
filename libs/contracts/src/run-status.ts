/* Run status values shared by the database model, the API and the web client. */
export const RUN_STATUSES = ['pending', 'running', 'finished', 'failed', 'stopped'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
