'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import type { AgentConversation } from '@/transcripts/transcript-access'
import type { PaneTarget } from '@/workspace/workspace-queries'

import { setClaudeSettingAction } from '@/agent-settings/agent-settings-actions'

type Setting = Parameters<typeof setClaudeSettingAction>[0]['setting']

// The models Claude Code's /model picker offers (its "More models" list is left to the terminal).
const MODELS = ['Opus 5.5', 'Fable 5.2', 'Sonnet 5.5', 'Haiku 5.5'] as const
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
// The menus' values come from the DOM as strings.
const modelSchema = z.enum(MODELS)
const effortSchema = z.enum(EFFORTS)
const modeSchema = z.enum(['acceptEdits', 'auto', 'default', 'plan'])
// What the read-only status line shows for each agent's mode: Claude's permission modes and Pi's
// thinking levels.
const MODE_NAMES = new Map(
  Object.entries({
    acceptEdits: 'accept edits',
    auto: 'auto mode',
    bypassPermissions: 'bypass permissions',
    high: 'high thinking',
    low: 'low thinking',
    max: 'max thinking',
    medium: 'medium thinking',
    minimal: 'minimal thinking',
    off: 'thinking off',
    plan: 'plan mode',
    xhigh: 'xhigh thinking',
  }),
)
const MODES = {
  acceptEdits: 'accept edits',
  auto: 'auto mode',
  default: 'manual mode',
  plan: 'plan mode',
}

/**
 * What the agent's own status line shows: model, effort, context, branch and mode. For Claude Code,
 * model, effort and mode are menus that change this session only.
 */
export function AgentStatus(props: {
  readonly agent: AgentConversation['agent']
  readonly status: NonNullable<AgentConversation['status']>
  readonly target: PaneTarget
  readonly working: boolean
}) {
  // The transcript shows a new model or effort only with the agent's next reply; until then, show the choice.
  const [chosen, setChosen] = useState<
    Partial<Record<Setting['kind'], string>>
  >({})
  const [busy, setBusy] = useState(false)
  // The chosen mode shows until the transcript's mode changes (to it, or later from the terminal).
  const [seenMode, setSeenMode] = useState(props.status.mode)
  if (seenMode !== props.status.mode) {
    setSeenMode(props.status.mode)
    setChosen((current) => ({ ...current, mode: undefined }))
  }
  const model = chosen.model ?? modelName(props.status.model)
  const effort = chosen.effort ?? props.status.effort
  const mode = chosen.mode ?? (props.status.mode || 'default')
  const context = props.status.context
    ? `${props.status.context.toLocaleString()} context`
    : ''
  const branch = props.status.branch && `⎇ ${props.status.branch}`
  if (props.agent !== 'claude') {
    return [
      modelName(props.status.model),
      context,
      branch,
      MODE_NAMES.get(props.status.mode) ?? '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  function change(setting: Setting) {
    setBusy(true)
    setChosen((current) => ({ ...current, [setting.kind]: setting.value }))
    setClaudeSettingAction({ ...props.target, setting })
      .then(({ error }) => {
        if (error === undefined) return
        setChosen((current) => ({ ...current, [setting.kind]: undefined }))
        toast.error(`Change failed: ${error}`)
      })
      .catch((error: unknown) => {
        setChosen((current) => ({ ...current, [setting.kind]: undefined }))
        toast.error(
          `Change failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
      })
      .finally(() => setBusy(false))
  }

  // Typed commands would queue behind the agent's turn, so changes wait until it's idle.
  const disabled = busy || props.working
  const title = props.working
    ? 'Available when Claude Code is idle'
    : 'Changes this session only'
  const select =
    'hover:text-foreground cursor-pointer appearance-none bg-transparent font-mono text-[0.72rem] disabled:cursor-default disabled:opacity-60'
  return (
    <span className="flex items-center gap-1">
      <select
        aria-label="Model"
        className={select}
        disabled={disabled}
        onChange={(event) =>
          change({
            kind: 'model',
            value: modelSchema.parse(event.target.value),
          })
        }
        title={title}
        value={model}
      >
        {!MODELS.some((name) => name === model) && (
          <option value={model}>{model}</option>
        )}
        {MODELS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      ·
      <select
        aria-label="Effort"
        className={select}
        disabled={disabled}
        onChange={(event) =>
          change({
            kind: 'effort',
            value: effortSchema.parse(event.target.value),
          })
        }
        title={title}
        value={effort}
      >
        {!EFFORTS.some((level) => level === effort) && (
          <option value={effort}>effort</option>
        )}
        {EFFORTS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
      {context && <>· {context}</>}
      {branch && <>· {branch}</>}·
      <select
        aria-label="Mode"
        className={select}
        disabled={disabled}
        onChange={(event) =>
          change({
            kind: 'mode',
            value: modeSchema.parse(event.target.value),
          })
        }
        title={title}
        value={mode}
      >
        {!(mode in MODES) && (
          <option value={mode}>
            {mode === 'bypassPermissions' ? 'bypass permissions' : mode}
          </option>
        )}
        {Object.entries(MODES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </span>
  )
}

/** claude-opus-5-5 or anthropic/claude-haiku-4.5 → Opus 5.5 / Haiku 4.5 */
function modelName(id: string) {
  const match = /^(?:[a-z0-9-]+\/)?claude-([a-z]+)-(\d+)[.-](\d+)/.exec(id)
  return match
    ? `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)} ${match[2]}.${match[3]}`
    : id
}
