'use client'

import type { PendingMessage } from '@/workspace/components/conversation-view'
import type { Run } from '@/workspace/components/run-card'
import type { PaneTarget } from '@/workspace/workspace-queries'

import { ConversationView } from '@/workspace/components/conversation-view'
import { TerminalView } from '@/workspace/components/terminal-view'
import { detectPrompt } from '@/workspace/detect-prompt'
import { AGENT_NAMES, paneAgent } from '@/workspace/pane-agent'
import { useConversation, useScreen } from '@/workspace/workspace-queries'

/** One pane: its agent conversation with the terminal in a drawer, or just its terminal. */
export function PaneView(props: {
  readonly active: boolean
  readonly drawer: boolean
  readonly drawerRem: number
  readonly onAnswer: (key: string) => void
  readonly onChooseTranscript: (id: string) => void
  readonly onDrawerResize: (rem: number) => void
  readonly onInput: (data: string) => void
  readonly onOpenRun: (run: Run) => void
  readonly onOpenTerminal: () => void
  readonly onRunInput: (run: Run, data: string) => void
  readonly onSelect: () => void
  readonly pending: PendingMessage[]
  readonly runs: Run[]
  readonly solo: boolean
  readonly target: PaneTarget
  readonly title: string
  readonly transcript: string | undefined
  readonly typing: boolean
}) {
  const conversation = useConversation(props.target, props.transcript)
  const agent = paneAgent(conversation.data, props.transcript !== undefined)
  const terminalShown = !agent || props.drawer
  // Fast while the terminal is on screen; slower while only watching for a prompt the agent is stopped at.
  const screen = useScreen(
    props.target,
    terminalShown ? 800 : agent.working ? 2000 : false,
  )
  const prompt =
    agent && !props.drawer && agent.working
      ? detectPrompt(screen.data?.content ?? '')
      : undefined
  const terminal =
    screen.data === undefined && !screen.error ? (
      <p className="text-muted-foreground grid h-full place-items-center text-sm">
        Loading screen…
      </p>
    ) : (
      <TerminalView
        content={screen.data?.content ?? ''}
        label={props.title}
        onFocus={props.onSelect}
        onInput={props.onInput}
        typing={props.typing && props.active}
      />
    )
  return (
    <section
      className={`bg-card flex h-full min-h-0 flex-col overflow-hidden ${props.solo ? '' : `rounded-lg border ${props.active ? 'outline-primary outline-2 outline-offset-2' : ''}`}`}
      data-active-pane={props.active ? '' : undefined}
      onClickCapture={props.onSelect}
    >
      {!props.solo && (
        <div className="flex h-8.5 shrink-0 items-center gap-2.5 border-b px-3 text-[0.8rem] font-medium">
          <span className="truncate">{props.title}</span>
          <span className="text-muted-foreground ml-auto font-mono text-[0.7rem]">
            {props.target.block.slice(-6)}
          </span>
        </div>
      )}
      {conversation.isPending ? (
        <p className="text-muted-foreground grid min-h-0 flex-1 place-items-center text-sm">
          Loading…
        </p>
      ) : agent ? (
        <>
          <div className="min-h-0 flex-1">
            <ConversationView
              conversation={agent}
              onAnswer={props.onAnswer}
              onOpenRun={props.onOpenRun}
              onOpenTerminal={props.onOpenTerminal}
              onRunInput={props.onRunInput}
              pending={props.pending}
              prompt={prompt}
              runs={props.runs}
              // Restored from the browser's saved copy and not refreshed yet in this page load.
              savedAt={
                conversation.dataUpdatedAt < performance.timeOrigin
                  ? conversation.dataUpdatedAt
                  : undefined
              }
            />
          </div>
          {props.drawer && (
            <>
              <div
                className="relative z-10 -mb-1.5 h-1.5 shrink-0 cursor-ns-resize touch-none max-md:-mb-3.5 max-md:h-3.5"
                onPointerDown={(event) =>
                  event.currentTarget.setPointerCapture(event.pointerId)
                }
                // Pointer capture ends on up or cancel, so a cancelled drag can't keep resizing.
                onPointerMove={(event) => {
                  const handle = event.currentTarget
                  const pane = handle.parentElement?.getBoundingClientRect()
                  if (!pane || !handle.hasPointerCapture(event.pointerId)) {
                    return
                  }
                  const rem = parseFloat(
                    getComputedStyle(document.documentElement).fontSize,
                  )
                  props.onDrawerResize(
                    Math.min(
                      (pane.height * 0.75) / rem,
                      Math.max(9, (pane.bottom - event.clientY) / rem),
                    ),
                  )
                }}
                title="Drag to resize"
              />
              <div
                className="bg-card shrink-0 border-t max-md:max-h-[45dvh]"
                style={{ height: `${props.drawerRem}rem` }}
              >
                {terminal}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {conversation.error && (
            <p className="text-destructive border-b px-3.5 py-2 text-[0.8rem]">
              Conversation unavailable: {conversation.error.message} Showing the
              terminal.
            </p>
          )}
          {conversation.data?.agent &&
            conversation.data.candidates.length > 0 && (
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 border-b px-3.5 py-1.5 text-[0.8rem]">
                Not sure which saved conversation this{' '}
                {AGENT_NAMES[conversation.data.agent]} is using.
                <select
                  aria-label="Show a saved conversation"
                  className="border-input bg-card h-7 max-w-full rounded border px-1.5 text-[0.8rem]"
                  defaultValue=""
                  onChange={(event) =>
                    props.onChooseTranscript(event.target.value)
                  }
                >
                  <option disabled value="">
                    Show a saved conversation…
                  </option>
                  {conversation.data.candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      Last active{' '}
                      {new Date(candidate.modified).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          <div className="min-h-0 flex-1">{terminal}</div>
        </div>
      )}
    </section>
  )
}
