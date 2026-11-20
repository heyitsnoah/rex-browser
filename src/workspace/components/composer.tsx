'use client'

import { ArrowUpIcon, PaperclipIcon, XIcon } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { PaneTarget } from '@/workspace/workspace-queries'

import { uploadFileAction } from '@/uploads/upload-actions'
import {
  pasteToPaneAction,
  writeToPaneAction,
} from '@/workspace/workspace-actions'
import { useSlashCommands } from '@/workspace/workspace-queries'

interface Attachment {
  error: string | undefined
  // Uploaded to this computer; the path only exists there.
  host: string
  id: number
  name: string
  path: string | undefined
}

/** Sends to the active pane: file paths and text as pastes, then Enter as its own keystroke. */
export function Composer(props: {
  readonly agentLabel: string | undefined
  readonly destination: string
  readonly onPending: (message: { files: string[]; text: string }) => {
    failed: () => void
    sent: () => void
  }
  // Hidden rather than unmounted while typing goes to the terminal, so the draft survives.
  readonly hidden: boolean
  /** Runs a `!` command in a terminal beside the agent. */
  readonly onRun: (command: string) => Promise<void>
  /** The agent's model, context size, branch and mode, as its own status line shows them. */
  readonly status: ReactNode
  readonly target: PaneTarget | undefined
}) {
  const [text, setText] = useState('')
  // Started with ! in an agent pane: the box is a terminal line and the text is a command.
  const [shellOn, setShell] = useState(false)
  // Only an agent pane has a terminal line; switching to a plain shell pane ends it.
  const shell = shellOn && props.agentLabel !== undefined
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuClosed, setMenuClosed] = useState(false)
  const files = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  // Where the cursor is; the / menu completes the word just before it.
  const [caret, setCaret] = useState(0)
  // The /word being typed before the cursor, at the start or after a space, so several skills can share
  // a message and one can be added mid-message.
  const slashQuery = shell
    ? undefined
    : /(?:^|\s)\/(\S*)$/.exec(text.slice(0, caret))?.[1]
  const commands = useSlashCommands(
    props.target,
    props.agentLabel !== undefined && slashQuery !== undefined,
  )
  const matches =
    slashQuery === undefined || menuClosed
      ? []
      : (commands.data ?? [])
          .filter((command) =>
            command.name.toLowerCase().includes(slashQuery.toLowerCase()),
          )
          .slice(0, 8)
  const uploading = attachments.some(
    (attachment) => !attachment.path && !attachment.error,
  )
  const ready = attachments.filter(
    (attachment) =>
      attachment.path !== undefined && attachment.host === props.target?.host,
  )
  const canSend =
    props.target !== undefined &&
    !uploading &&
    (text.trim() !== '' || (!shell && ready.length > 0))

  function pick(name: string) {
    const before = text.slice(0, caret).replace(/\/\S*$/, `/${name} `)
    setText(before + text.slice(caret).replace(/^\S*[ \t]?/, ''))
    setCaret(before.length)
    setMenuClosed(true)
    // Put the cursor after the inserted name once React has rendered the new text (a DOM side effect).
    requestAnimationFrame(() =>
      box.current?.setSelectionRange(before.length, before.length),
    )
  }

  async function upload(file: File) {
    const target = props.target
    if (!target) return
    const id = Date.now() + Math.random()
    setAttachments((list) => [
      ...list,
      {
        error: undefined,
        host: target.host,
        id,
        name: file.name,
        path: undefined,
      },
    ])
    const form = new FormData()
    form.set('file', file)
    form.set('host', target.host)
    form.set('session', target.session)
    try {
      const path = await uploadFileAction(form)
      setAttachments((list) =>
        list.map((item) => (item.id === id ? { ...item, path } : item)),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      setAttachments((list) =>
        list.map((item) =>
          item.id === id ? { ...item, error: message } : item,
        ),
      )
      toast.error(`Upload failed: ${message}`)
    }
  }

  async function send() {
    const target = props.target
    if (!target || !canSend) return
    if (shell) {
      const command = text.trim()
      setText('')
      setShell(false)
      try {
        await props.onRun(command)
      } catch (error) {
        setShell(true)
        setText((current) => current || command)
        toast.error(
          `Run failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
      }
      return
    }
    const message = text.trim() ? text : ''
    // Clear at once; the conversation shows the message as pending until the transcript has it.
    setText('')
    setAttachments((list) => list.filter((item) => !ready.includes(item)))
    const pending = props.onPending({
      files: ready.map((attachment) => attachment.name),
      text: message,
    })
    try {
      // File paths get their own paste so Claude Code turns image paths into attachments.
      if (ready.length) {
        await pasteToPaneAction({
          ...target,
          text: `${ready.map((attachment) => attachment.path).join(' ')} `,
        })
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      if (message) {
        await pasteToPaneAction({ ...target, text: message })
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      // Sent in the same write as a paste, TUIs treat the Enter as part of it and don't submit.
      await writeToPaneAction({ ...target, data: '\r' })
      pending.sent()
    } catch (error) {
      pending.failed()
      setText((current) => current || message)
      setAttachments((list) => [...ready, ...list])
      toast.error(
        `Send failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  return (
    <div
      className={`border-t px-6 pt-3 pb-3.5 max-md:border-t-0 max-md:px-2.5 max-md:pt-2 max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${props.hidden ? 'hidden' : ''}`}
    >
      <p className="text-muted-foreground mx-auto mb-2 flex max-w-184 items-center gap-2 text-[0.8rem] max-md:hidden">
        {props.target ? 'Send to' : 'No pane selected'}{' '}
        <b className="text-foreground truncate font-medium">
          {props.destination}
        </b>
        {props.status && (
          <span className="ml-auto shrink-0 font-mono text-[0.72rem]">
            {props.status}
          </span>
        )}
      </p>
      <div
        className={`focus-within:border-ring focus-within:ring-ring relative mx-auto max-w-184 rounded-xl border focus-within:ring-1 ${shell ? 'border-tray bg-tray text-tray-foreground' : 'border-input bg-card'}`}
      >
        {shell && (
          <p className="px-3.5 pt-2.5 text-[0.75rem] text-white/60">
            Runs in a terminal beside {props.agentLabel}; the output goes to it
            when the command ends. Backspace on an empty line to leave.
          </p>
        )}
        {matches.length > 0 && (
          <ul
            className="border-border bg-popover absolute right-0 bottom-full left-0 mb-1.5 max-h-72 overflow-y-auto rounded-xl border p-1 shadow-lg"
            role="listbox"
          >
            {matches.map((command, index) => (
              <li
                aria-selected={index === menuIndex}
                key={command.name}
                role="option"
              >
                <button
                  className={`flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-1.5 text-left ${index === menuIndex ? 'bg-muted' : ''}`}
                  onClick={() => pick(command.name)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <span className="shrink-0 font-mono text-[0.8rem]">
                    /{command.name}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {command.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
            {attachments.map((attachment) => (
              <span
                className={`bg-subtle inline-flex h-7.5 max-w-56 items-center gap-1.5 rounded-lg border pr-1 pl-2.5 text-[0.8rem] ${attachment.error ? 'border-destructive text-destructive' : attachment.path ? '' : 'text-muted-foreground'}`}
                key={attachment.id}
                title={attachment.error ?? attachment.name}
              >
                <span className="truncate">
                  {attachment.path || attachment.error
                    ? attachment.name
                    : `Uploading ${attachment.name}`}
                </span>
                <button
                  aria-label={`Remove ${attachment.name}`}
                  className="text-muted-foreground hover:bg-muted grid size-6 place-items-center rounded-md"
                  onClick={() =>
                    setAttachments((list) =>
                      list.filter((item) => item.id !== attachment.id),
                    )
                  }
                  type="button"
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex">
          {shell && (
            <span className="pt-3 pl-3.5 font-mono text-sm text-[#9be3a6] max-md:text-base">
              $
            </span>
          )}
          <textarea
            aria-label={
              shell
                ? 'Command to run in a terminal'
                : 'Message to send to the selected pane'
            }
            className={`block field-sizing-content max-h-44 min-h-11 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm outline-none max-md:text-base ${shell ? 'pl-2 font-mono' : ''}`}
            onChange={(event) => {
              const value = event.target.value
              setCaret(event.target.selectionStart)
              // A leading ! in an agent pane switches to a terminal line (typed or pasted).
              if (!shell && props.agentLabel && value.startsWith('!')) {
                setShell(true)
                setText(value.slice(1))
              } else {
                setText(value)
              }
              setMenuIndex(0)
              setMenuClosed(false)
            }}
            onKeyDown={(event) => {
              if (shell && event.key === 'Backspace' && text === '') {
                event.preventDefault()
                setShell(false)
                return
              }
              const choice = matches.at(menuIndex)
              if (
                choice &&
                (event.key === 'ArrowDown' || event.key === 'ArrowUp')
              ) {
                event.preventDefault()
                setMenuIndex(
                  (index) =>
                    (index +
                      (event.key === 'ArrowDown' ? 1 : matches.length - 1)) %
                    matches.length,
                )
              } else if (
                choice &&
                (event.key === 'Enter' || event.key === 'Tab') &&
                !event.shiftKey
              ) {
                event.preventDefault()
                pick(choice.name)
              } else if (matches.length && event.key === 'Escape') {
                setMenuClosed(true)
              } else if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                // Enter sends; Shift+Enter adds a line (and IME composition keeps its Enter).
                event.preventDefault()
                void send()
              }
            }}
            onPaste={(event) => {
              const pasted = [...event.clipboardData.files]
              if (!pasted.length) return
              event.preventDefault()
              pasted.forEach((file) => void upload(file))
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            placeholder={
              shell
                ? 'command'
                : props.agentLabel
                  ? `Reply to ${props.agentLabel}${props.agentLabel === 'Claude Code' || props.agentLabel === 'Codex' ? ' · / for skills' : ''}`
                  : 'Text or command'
            }
            ref={box}
            rows={1}
            value={text}
          />
        </div>
        <div className="flex items-center gap-1.5 px-1.5 pt-1 pb-1.5">
          <button
            aria-label="Attach files"
            className={`text-muted-foreground hover:bg-muted hover:text-foreground grid size-8.5 place-items-center rounded-lg max-md:size-10 ${shell ? 'invisible' : ''}`}
            disabled={!props.target}
            onClick={() => files.current?.click()}
            type="button"
          >
            <PaperclipIcon className="size-4.5" />
          </button>
          <input
            className="hidden"
            multiple
            onChange={(event) => {
              for (const file of event.target.files ?? []) void upload(file)
              event.target.value = ''
            }}
            ref={files}
            type="file"
          />
          <span className="text-muted-foreground truncate font-mono text-[0.7rem] md:hidden">
            {props.destination}
          </span>
          <span className="flex-1" />
          <button
            aria-label="Send"
            className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground inline-flex h-8.5 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium max-md:size-10 max-md:justify-center max-md:rounded-full max-md:px-0"
            disabled={!canSend}
            onClick={() => void send()}
            type="button"
          >
            <span className="max-md:hidden">{shell ? 'Run' : 'Send'}</span>
            <kbd className="font-mono text-[0.7rem] opacity-80 max-md:hidden">
              Enter
            </kbd>
            <ArrowUpIcon className="size-4.5 md:hidden" />
          </button>
        </div>
      </div>
    </div>
  )
}
