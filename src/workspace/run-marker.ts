// The line a `!` run's terminal prints when its command ends (runInNewTabAction). The server waits for
// it to hand the output back; the run card waits for it to fold.

/** printf format for the line: the run id, then the exit code. */
export const RUN_DONE_FORMAT = 'REXRUN-%s-DONE exit %s'

/** Finds the end line for run `id` on a screen; group 1 is the exit code. */
export function runDonePattern(id: string) {
  return new RegExp(`REXRUN-${id}-DONE exit (\\d+)`)
}
