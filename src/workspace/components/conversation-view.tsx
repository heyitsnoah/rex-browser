'use client'

import { ChevronRightIcon, FileTextIcon, ImageIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

import type { AgentConversation } from '@/transcripts/transcript-access'
import type { AgentPrompt } from '@/workspace/detect-prompt'

import { AnswerCard } from '@/workspace/components/answer-card'
import { ImagePreview } from '@/workspace/components/image-preview'
import { LiveDuration } from '@/workspace/components/live-duration'
import { MarkdownText } from '@/workspace/components/markdown-text'
import { type Run, RunCard } from '@/workspace/components/run-card'
import { SubagentCard } from '@/workspace/components/subagent-card'
import { ToolRun } from '@/workspace/components/tool-run'
import { conversationBlocks } from '@/workspace/conversation-blocks'
import { AGENT_NAMES } from '@/workspace/pane-agent'

export interface PendingMessage {
  at: number
  failed: boolean
  files: string[]
  sent: boolean
  text: string
}

export function ConversationView(props: {
  readonly conversation: AgentConversation
  readonly onAnswer: (key: string) => void
  readonly onOpenRun: (run: Run) => void
  readonly onOpenTerminal: () => void
  readonly onRunInput: (run: Run, data: string) => void
  readonly pending: PendingMessage[]
  readonly prompt: AgentPrompt | undefined
  readonly runs: Run[]
  readonly savedAt: number | undefined
}) {
  const [preview, setPreview] = useState<string>()
  const scroller = useRef<HTMLDivElement>(null)
  // Read by the scroll handler and the layout effect, not by render: whether the reader is at the bottom.
  const atBottom = useRef(true)
  const items = props.conversation.items
  const blocks = conversationBlocks(items)
  const offsetMs = Date.parse(props.conversation.now) - Date.now()
  const working = props.conversation.working
  const subagents = new Map(
    props.conversation.subagents.map((agent) => [agent.toolUseId, agent]),
  )
  // Claude writes a message sent mid-turn only when it picks it up; until then it shows as pending.
  // An answer typed into an open question lands in that question's result instead.
  // Only your messages written after the send count, so repeating an earlier "yes" still shows.
  const pending = props.pending.filter((message) => {
    if (Date.now() - message.at > 10 * 60 * 1000) return false
    const newer = items.filter(
      (item) =>
        (item.role === 'user' ||
          item.role === 'attachment' ||
          item.role === 'result') &&
        Date.parse(item.time) - offsetMs >= message.at - 1000,
    )
    return !newer.some((item) =>
      message.text
        ? (item.role === 'user' &&
            (normalize(item.text).endsWith(normalize(message.text)) ||
              (Boolean(item.name) &&
                normalize(`${item.name} ${item.text}`).endsWith(
                  normalize(message.text),
                )))) ||
          (item.role === 'result' &&
            item.text.startsWith('Your questions have been answered:') &&
            normalize(item.text).includes(`="${normalize(message.text)}"`))
        : item.role !== 'result',
    )
  })

  // Keeps the view pinned to the newest message after every render, unless the reader scrolled up.
  useLayoutEffect(() => {
    if (atBottom.current && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight
    }
  })

  return (
    <div
      className="h-full overflow-y-auto select-text"
      onScroll={(event) => {
        const node = event.currentTarget
        atBottom.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 60
      }}
      ref={scroller}
    >
      {props.savedAt !== undefined && (
        <p className="bg-subtle text-muted-foreground sticky top-0 z-10 border-b px-4 py-1.5 text-center text-[0.8rem]">
          Saved copy from{' '}
          {new Date(props.savedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          · updating…
        </p>
      )}
      <div className="mx-auto max-w-184 px-6 pt-7 pb-5 text-[0.9rem] leading-relaxed max-md:px-4 max-md:pt-4">
        {props.conversation.warnings.map((warning) => (
          <p className="text-muted-foreground mb-4 text-[0.8rem]" key={warning}>
            {warning}
          </p>
        ))}
        {blocks.map((block) => {
          switch (block.kind) {
            case 'agent':
              return (
                <SubagentCard
                  call={block.call}
                  finished={
                    block.call.id in props.conversation.finished
                      ? props.conversation.finished[block.call.id]
                      : undefined
                  }
                  info={subagents.get(block.call.id)}
                  key={block.id}
                  offsetMs={offsetMs}
                  working={working}
                />
              )
            case 'note':
              return (
                <NoteBlock
                  error={block.error}
                  key={block.id}
                  text={block.text}
                />
              )
            case 'run':
              return (
                <ToolRun calls={block.calls} key={block.id} working={working} />
              )
            case 'said':
              return (
                <div className="mb-4" key={block.id}>
                  <MarkdownText text={block.text} />
                </div>
              )
            case 'you':
              return (
                <div
                  className="my-2 mb-5 flex flex-col items-end gap-1"
                  key={block.id}
                >
                  {block.messages.map((message, index) => (
                    <YourMessage
                      command={message.command}
                      key={index}
                      text={message.text}
                    />
                  ))}
                  {block.attachments.map((attachment, index) =>
                    attachment.image ? (
                      <button
                        aria-label="Preview image"
                        className="border-border bg-subtle block max-w-[min(16rem,70%)] overflow-hidden rounded-xl border"
                        key={index}
                        onClick={() =>
                          setPreview(`/api/image?id=${attachment.image}`)
                        }
                        type="button"
                      >
                        {/* Served from the in-memory image cache; next/image can't optimize it. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt="Attached"
                          className="block max-h-80 w-full object-cover"
                          decoding="async"
                          loading="lazy"
                          src={`/api/image?id=${attachment.image}`}
                        />
                      </button>
                    ) : (
                      <span
                        className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                        key={index}
                      >
                        {attachment.file ? (
                          <FileTextIcon className="size-3.5" />
                        ) : (
                          <ImageIcon className="size-3.5" />
                        )}
                        {attachment.name || 'Image'}
                      </span>
                    ),
                  )}
                </div>
              )
          }
        })}
        {pending.map((message) => (
          <div
            className="my-2 mb-5 flex flex-col items-end gap-1 opacity-70"
            key={message.at}
          >
            {message.files.map((file) => (
              <span
                className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                key={file}
              >
                <FileTextIcon className="size-3.5" />
                {file}
              </span>
            ))}
            {message.text && <YourMessage command="" text={message.text} />}
            <span className="text-muted-foreground font-mono text-[0.7rem]">
              {message.failed
                ? 'Not sent'
                : !message.sent
                  ? 'Sending…'
                  : working
                    ? 'Queued'
                    : 'Sent'}
            </span>
          </div>
        ))}
        {props.runs
          // Once the agent has the output the transcript shows the run, even after it scrolls out of the
          // items read (older than the oldest item shown).
          .filter(
            (run) =>
              !items.some((item) => item.id === `run:${run.id}`) &&
              !(items.length && run.at < Date.parse(items[0].time) - offsetMs),
          )
          .map((run) => (
            <RunCard
              agentLabel={AGENT_NAMES[props.conversation.agent]}
              key={run.id}
              onInput={(data) => props.onRunInput(run, data)}
              onOpen={() => props.onOpenRun(run)}
              run={run}
            />
          ))}
        {props.prompt && (
          <AnswerCard
            onAnswer={props.onAnswer}
            onOpenTerminal={props.onOpenTerminal}
            prompt={props.prompt}
          />
        )}
        {working && (
          <div className="text-muted-foreground flex min-h-7 items-center gap-2 text-sm">
            <span className="bg-primary animate-pulse-dot size-1.5 rounded-full" />
            Working
            {props.conversation.since && (
              <>
                {' for '}
                <LiveDuration
                  offsetMs={offsetMs}
                  since={props.conversation.since}
                />
              </>
            )}
          </div>
        )}
        {props.conversation.selected && items.length === 0 && (
          <p className="text-muted-foreground text-sm">Waiting for messages…</p>
        )}
      </div>
      {preview && (
        <ImagePreview onClose={() => setPreview(undefined)} src={preview} />
      )}
    </div>
  )
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/** Short notes (errors, 1-line summaries) show inline; long thinking or compaction notes fold cleanly. */
function NoteBlock(props: { readonly error: boolean; readonly text: string }) {
  if (
    props.error ||
    (props.text.length <= 240 && !props.text.includes('\n\n'))
  ) {
    return (
      <p
        className={`mb-4 text-sm ${props.error ? 'text-destructive [overflow-wrap:anywhere]' : 'text-muted-foreground italic'}`}
      >
        {props.error ? `Error: ${props.text}` : props.text}
      </p>
    )
  }
  const firstLine =
    props.text
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  const title = firstLine
    .replace(/^#+\s*/, '')
    .replace(/^\*{1,2}(.*?)\*{1,2}$/, '$1')
    .trim()
  return (
    <details className="group mb-4">
      <summary className="text-muted-foreground hover:bg-subtle hover:text-foreground -ml-1 flex min-h-7 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-sm italic">
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
        <span className="truncate">{title || 'Note'}</span>
      </summary>
      <div className="border-border text-muted-foreground mt-1.5 ml-1.5 max-h-96 overflow-auto border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-wrap italic">
        {props.text}
      </div>
    </details>
  )
}

function YourMessage(props: {
  readonly command: string
  readonly text: string
}) {
  return (
    <>
      {props.command && (
        <span className="text-muted-foreground font-mono text-[0.7rem]">
          {props.command}
        </span>
      )}
      <div className="bg-note-soft max-h-96 max-w-[80%] overflow-auto rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-normal break-words whitespace-pre-wrap max-md:max-w-[88%]">
        {props.text}
      </div>
    </>
  )
}
