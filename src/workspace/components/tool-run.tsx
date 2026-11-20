import { ChevronRightIcon } from 'lucide-react'

import type { ToolCall } from '@/workspace/conversation-blocks'

import { ToolIcon } from '@/workspace/components/tool-icon'
import { runSentence, toolArgs, toolSummary } from '@/workspace/tool-calls'

/** A run of consecutive tool calls as one quiet line; a single call is just its row. */
export function ToolRun(props: {
  readonly calls: ToolCall[]
  readonly working: boolean
}) {
  const pending =
    props.working && props.calls.some((call) => call.output === undefined)
  const failed = props.calls.filter((call) => call.failed).length
  const first = props.calls.at(0)
  if (props.calls.length === 1 && first) {
    return <ToolStep call={first} live={pending} />
  }
  return (
    <details className="group/run mb-3">
      <summary className="text-muted-foreground hover:bg-subtle hover:text-foreground -ml-1 flex min-h-7 cursor-pointer list-none items-center gap-2 rounded-md px-1 text-sm max-md:min-h-9">
        <ChevronRightIcon className="size-3 shrink-0 opacity-70 transition-transform group-open/run:rotate-90" />
        <span className={pending ? 'text-shine' : ''}>
          {runSentence(props.calls.map((call) => call.name))}
        </span>
        {failed > 0 && (
          <span className="text-destructive">{failed} failed</span>
        )}
      </summary>
      <div className="border-border mt-1 ml-0.5 border-l py-1 pl-4">
        {props.calls.map((call) => (
          <ToolStep
            call={call}
            key={call.id}
            live={props.working && call.output === undefined}
          />
        ))}
      </div>
    </details>
  )
}

function ToolStep(props: { readonly call: ToolCall; readonly live: boolean }) {
  const args = toolArgs(props.call.input)
  return (
    <details className="mb-0.5">
      <summary
        className={`hover:bg-subtle hover:text-foreground -ml-1 flex min-h-6 cursor-pointer list-none items-center gap-2 rounded-md px-1 text-[0.8rem] max-md:min-h-9 ${props.call.failed ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        <ToolIcon failed={props.call.failed} name={props.call.name} />
        <span
          className={`shrink-0 font-mono text-xs ${props.call.failed ? '' : 'text-foreground'}`}
        >
          {props.call.name}
        </span>
        <span className={`truncate ${props.live ? 'text-shine' : ''}`}>
          {toolSummary(props.call.name, props.call.input)}
        </span>
      </summary>
      <div className="mt-1 mb-2.5 ml-5.5 space-y-1.5">
        {props.call.input && (
          <>
            <p className="text-muted-foreground font-mono text-[0.7rem] tracking-wide uppercase">
              Input
            </p>
            <pre className="bg-muted max-h-72 overflow-auto rounded px-2.5 py-2 font-mono text-xs break-words whitespace-pre-wrap">
              {args ? JSON.stringify(args, null, 2) : props.call.input}
            </pre>
          </>
        )}
        {props.call.output !== undefined && (
          <>
            <p className="text-muted-foreground font-mono text-[0.7rem] tracking-wide uppercase">
              Output
            </p>
            <pre className="bg-muted max-h-72 overflow-auto rounded px-2.5 py-2 font-mono text-xs break-words whitespace-pre-wrap">
              {props.call.output}
            </pre>
          </>
        )}
      </div>
    </details>
  )
}
