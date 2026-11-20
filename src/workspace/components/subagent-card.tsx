import { CheckIcon, XIcon } from 'lucide-react'

import type { AgentConversation } from '@/transcripts/transcript-access'
import type { ToolCall } from '@/workspace/conversation-blocks'

import {
  formatDuration,
  LiveDuration,
} from '@/workspace/components/live-duration'
import { ToolIcon } from '@/workspace/components/tool-icon'
import { isSubagentRunning } from '@/workspace/subagent-status'
import { toolArgs, toolSummary } from '@/workspace/tool-calls'

type Subagent = AgentConversation['subagents'][number]

/** A subagent at the point it was launched: live while it runs, one line once done. */
export function SubagentCard(props: {
  readonly call: ToolCall
  readonly finished: string | undefined
  readonly info: Subagent | undefined
  readonly offsetMs: number
  readonly working: boolean
}) {
  const args = toolArgs(props.call.input)
  const background = props.info?.background ?? args?.run_in_background === true
  // Background agents report completion in a notification; foreground ones by their result.
  const running = background
    ? props.info !== undefined &&
      isSubagentRunning({
        done: props.info.done,
        finished: props.finished,
        offsetMs: props.offsetMs,
        updated: props.info.updated,
      })
    : props.finished === undefined &&
      props.call.output === undefined &&
      props.working
  const status = running
    ? 'running'
    : props.finished === 'failed' || props.finished === 'killed'
      ? 'failed'
      : 'done'
  const description =
    typeof args?.description === 'string'
      ? args.description
      : toolSummary(props.call.name, props.call.input)
  const steps = props.info?.recent ?? []
  const type =
    props.info?.type ??
    (typeof args?.subagent_type === 'string' ? args.subagent_type : 'agent')
  return (
    // Remount when the status changes so a running card opens and a finished one folds.
    <details
      className="border-border bg-card mt-1.5 mb-3.5 rounded-xl border"
      data-agent-running={running ? '' : undefined}
      key={status}
      open={running}
    >
      <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm">
        {status === 'running' ? (
          <span
            className="bg-primary animate-pulse-dot size-1.5 shrink-0 rounded-full"
            title="Running"
          />
        ) : status === 'done' ? (
          <CheckIcon className="text-primary size-3.5 shrink-0" />
        ) : (
          <XIcon className="text-destructive size-3.5 shrink-0" />
        )}
        <b className="min-w-0 truncate font-medium">{description}</b>
        <span className="text-muted-foreground font-mono text-xs">
          {[type, background ? 'background' : undefined]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {props.info && (
          <span className="text-muted-foreground ml-auto font-mono text-xs max-md:ml-5.5 max-md:basis-full">
            {running ? (
              <LiveDuration
                offsetMs={props.offsetMs}
                since={props.info.started}
              />
            ) : (
              formatDuration(
                Date.parse(props.info.updated) - Date.parse(props.info.started),
              )
            )}{' '}
            · {props.info.tools} tools
          </span>
        )}
      </summary>
      <div className="border-border mx-3 mb-2.5 ml-4 border-l py-0.5 pl-3.5">
        {steps.length ? (
          steps.map((step, index) => {
            const live = running && index === steps.length - 1
            return (
              <div
                className="text-muted-foreground flex min-h-6 items-center gap-2 text-[0.8rem]"
                key={`${step.time}-${index}`}
              >
                <ToolIcon name={step.tool} />
                <span className="text-foreground shrink-0 font-mono text-xs">
                  {step.tool}
                </span>
                <span className={`truncate ${live ? 'text-shine' : ''}`}>
                  {toolSummary(step.tool, step.input)}
                </span>
              </div>
            )
          })
        ) : (
          <p className="text-muted-foreground text-[0.8rem]">
            {props.info ? 'No steps yet' : 'Details unavailable for this agent'}
          </p>
        )}
      </div>
    </details>
  )
}
