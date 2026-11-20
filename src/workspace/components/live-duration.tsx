'use client'

import { useEffect, useState } from 'react'

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  }
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** Elapsed time since `since`, ticking each second. `offsetMs` corrects for the server's clock. */
export function LiveDuration(props: {
  readonly offsetMs: number
  readonly since: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="font-mono text-xs">
      {formatDuration(now + props.offsetMs - Date.parse(props.since))}
    </span>
  )
}
