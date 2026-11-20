'use client'

import { ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'

import { LiveDuration } from '@/workspace/components/live-duration'
import { TerminalView } from '@/workspace/components/terminal-view'
import { useScreen } from '@/workspace/workspace-queries'

/** A `!` command running in its own terminal next to the agent. */
export interface Run {
  readonly at: number
  readonly block: string
  readonly command: string
  readonly host: string
  readonly id: string
  readonly session: string
  readonly tab: string
}

/**
 * The run's terminal, live in the thread; click into it to type. When the command ends it folds to
 * one line, and its output has gone to the agent.
 */
export function RunCard(props: {
  readonly agentLabel: string
  readonly onInput: (data: string) => void
  readonly onOpen: () => void
  readonly run: Run
}) {
  const [typing, setTyping] = useState(false)
  const [open, setOpen] = useState(false)
  // Stops polling once the end marker has been seen; the last screen stays in the cache.
  const [finished, setFinished] = useState(false)
  const screen = useScreen(
    {
      block: props.run.block,
      host: props.run.host,
      session: props.run.session,
    },
    finished ? false : 800,
  )
  const content = screen.data?.content ?? ''
  const done = new RegExp(`REXRUN-${props.run.id}-DONE exit (\\d+)`).exec(
    content,
  )
  if (done && !finished) setFinished(true)
  // Everything above the end marker is the command's own output.
  const output = done ? content.slice(0, done.index).trimEnd() : content
  if (done) {
    return (
      <div className="mb-4">
        <button
          className="text-muted-foreground flex w-full items-center gap-2 text-left text-sm"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <ChevronRightIcon
            className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="text-foreground truncate font-mono text-[0.8rem]">
            $ {props.run.command}
          </span>
          <span className="shrink-0">· exit {done[1]}</span>
        </button>
        <p className="text-muted-foreground mt-0.5 ml-5.5 font-mono text-xs">
          Sent to {props.agentLabel}
        </p>
        {open && (
          <pre className="bg-tray text-tray-foreground mt-2 max-h-80 overflow-auto rounded-lg px-3.5 py-3 font-mono text-[0.8rem] whitespace-pre-wrap">
            {output}
          </pre>
        )}
      </div>
    )
  }
  return (
    <div
      className="bg-tray text-tray-foreground mb-4 overflow-hidden rounded-xl"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setTyping(false)
      }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 font-mono text-xs text-white/60">
        <span className="bg-primary size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
        Running ·{' '}
        <LiveDuration
          offsetMs={0}
          since={new Date(props.run.at).toISOString()}
        />
        <button
          className="ml-auto underline underline-offset-2 hover:text-white"
          onClick={props.onOpen}
          type="button"
        >
          Open full terminal
        </button>
      </div>
      <div className="h-56" onPointerDown={() => setTyping(true)}>
        <TerminalView
          content={output}
          label={`Terminal running ${props.run.command}`}
          onFocus={() => setTyping(true)}
          onInput={props.onInput}
          typing={typing}
        />
      </div>
      <p className="border-t border-white/10 px-3 py-1.5 font-mono text-xs text-white/45">
        {typing
          ? 'Typing goes to this terminal · click outside to stop'
          : 'Click the terminal to type into it'}
      </p>
    </div>
  )
}
