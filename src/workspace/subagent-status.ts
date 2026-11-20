/**
 * A subagent counts as running until its completion notice arrives, its own
 * transcript ends, or it has written nothing for five minutes (a long session
 * read from its tail can miss the notice).
 */
export function isSubagentRunning(props: {
  done: boolean
  finished: string | undefined
  offsetMs: number
  updated: string
}) {
  return (
    props.finished === undefined &&
    !props.done &&
    Date.now() + props.offsetMs - Date.parse(props.updated) < 5 * 60 * 1000
  )
}
