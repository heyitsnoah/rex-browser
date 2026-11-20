'use client'

import type { PendingMessage } from '@/workspace/components/conversation-view'
import type { PaneTarget } from '@/workspace/workspace-queries'

import { ConversationView } from '@/workspace/components/conversation-view'
import { TerminalView } from '@/workspace/components/terminal-view'
import { detectPrompt } from '@/workspace/detect-prompt'
import { paneAgent } from '@/workspace/pane-agent'
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
  readonly onOpenTerminal: () => void
  readonly onSelect: () => void
  readonly pending: PendingMessage[]
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
              onChooseTranscript={props.onChooseTranscript}
              onOpenTerminal={props.onOpenTerminal}
              pending={props.pending}
              prompt={prompt}
            />
          </div>
          {props.drawer && (
            <>
              <div
                className="relative z-10 -mb-1.5 h-1.5 shrink-0 cursor-ns-resize touch-none max-md:-mb-3.5 max-md:h-3.5"
                onPointerDown={(event) => {
                  const handle = event.currentTarget
                  const pane = handle.parentElement?.getBoundingClientRect()
                  const rem = parseFloat(
                    getComputedStyle(document.documentElement).fontSize,
                  )
                  if (!pane) return
                  handle.setPointerCapture(event.pointerId)
                  handle.onpointermove = (move) =>
                    props.onDrawerResize(
                      Math.min(
                        (pane.height * 0.75) / rem,
                        Math.max(9, (pane.bottom - move.clientY) / rem),
                      ),
                    )
                  handle.onpointerup = () => (handle.onpointermove = null)
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
          <div className="min-h-0 flex-1">{terminal}</div>
        </div>
      )}
    </section>
  )
}
