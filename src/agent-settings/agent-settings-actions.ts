'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

import { readScreen } from '@/rex/hidden-terminal'
import { runRemoteProgram } from '@/rex/remote-program'
import { requireActionAccess } from '@/rex/rex-access'
import { rex } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'
import { detectPrompt } from '@/workspace/detect-prompt'

const defaultsSchema = z.object({
  model: z.unknown(),
  modelSettings: z.unknown(),
})

// The status line Claude Code shows for each mode.
const MODE_LABELS = {
  acceptEdits: 'accept edits on',
  auto: 'auto mode on',
  default: 'manual mode on',
  plan: 'plan mode on',
}

// Changes on one computer run one at a time: each reads Claude's saved defaults, types its command
// and puts the defaults back, so two overlapping changes could restore each other's values.
const changesByHost = new Map<string, Promise<unknown>>()

/**
 * Changes a Claude Code pane's model, effort or mode for that session only. /model and /effort also
 * save themselves as the computer's default, so the previous default is put back afterwards.
 */
export const setClaudeSettingAction = requireActionAccess(
  // Next.js hides a thrown error's message in production, so the reason comes back as data.
  async (props: Parameters<typeof changeClaudeSetting>[0]) => {
    const change = (changesByHost.get(props.host) ?? Promise.resolve()).then(
      () => changeClaudeSetting(props),
    )
    changesByHost.set(
      props.host,
      change.catch(() => undefined),
    )
    try {
      await change
      return { error: undefined }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'unknown error' }
    }
  },
)

async function changeClaudeSetting(props: {
  block: string
  host: string
  session: string
  setting:
    | { kind: 'effort'; value: 'high' | 'low' | 'max' | 'medium' | 'xhigh' }
    | { kind: 'mode'; value: keyof typeof MODE_LABELS }
    | { kind: 'model'; value: 'haiku' | 'opus' | 'sonnet' }
}) {
  const host = await requireHost(props.host)
  const pane = { block: props.block, host, session: props.session }
  async function writeKeys(data: string) {
    await rex(host, [
      'block',
      'call',
      '-s',
      props.session,
      '-b',
      props.block,
      'write',
      JSON.stringify({ data }),
    ])
  }
  const bottom = await bottomLines(pane)
  // Keys typed while a dialog or menu is open would answer it instead.
  if (!bottom.includes('shift+tab to cycle')) {
    throw new Error(
      'Claude Code is showing a dialog or menu. Finish it in the terminal, then try again.',
    )
  }
  if (props.setting.kind === 'mode') {
    const label = MODE_LABELS[props.setting.value]
    const start = Object.values(MODE_LABELS).find((mode) =>
      bottom.includes(mode),
    )
    // Each press moves to the next mode; a cycle has at most five.
    for (let press = 0; press < 5; press++) {
      if ((await bottomLines(pane)).includes(label)) return
      await writeKeys('\x1b[Z')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    // Not in this Claude Code's cycle: go back to where it was.
    for (let press = 0; start && press < 5; press++) {
      if ((await bottomLines(pane)).includes(start)) break
      await writeKeys('\x1b[Z')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`This Claude Code has no ${label.replace(/ on$/, '')}.`)
  }
  // Text waiting in Claude's input would be sent along with the command.
  const draft = /^\s*❯(.*)$/m.exec(bottom.split('\n').reverse().join('\n'))?.[1]
  if (draft?.trim()) {
    throw new Error(
      "Claude Code's input has unsent text. Send or clear it in the terminal, then try again.",
    )
  }
  const source = await readFile(
    path.join(process.cwd(), 'src/agent-settings/claude-defaults.mjs'),
    'utf8',
  )
  const saved = defaultsSchema.parse(
    await runRemoteProgram({
      host,
      request: {},
      session: props.session,
      source,
    }),
  )
  const confirmation =
    props.setting.kind === 'model' ? 'Set model to' : 'Set effort level to'
  // An earlier confirmation may still be on screen; wait for one more.
  const before = (await readScreen(pane)).split(confirmation).length
  try {
    await rex(host, [
      'api',
      'call',
      '-s',
      props.session,
      'block.event',
      JSON.stringify({
        block_id: props.block,
        event: {
          payload: { text: `/${props.setting.kind} ${props.setting.value}` },
          type: 'paste',
        },
        session_id: props.session,
      }),
    ])
    await new Promise((resolve) => setTimeout(resolve, 120))
    await writeKeys('\r')
    const deadline = Date.now() + 10_000
    let switchConfirmed = false
    for (
      let screen = await readScreen(pane);
      screen.split(confirmation).length <= before;
      screen = await readScreen(pane)
    ) {
      // Mid-conversation, Claude Code asks whether to switch (the history is re-read on the new model).
      // The person chose this model, so confirm the menu that's open now (not old text in the scrollback).
      const option = detectPrompt(screen)?.options.find((choice) =>
        choice.label.startsWith('Yes, switch to'),
      )
      if (props.setting.kind === 'model' && option && !switchConfirmed) {
        switchConfirmed = true
        await writeKeys(option.key)
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Claude Code didn't confirm the ${props.setting.kind} change.`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  } finally {
    await runRemoteProgram({
      host,
      request: {
        restore: {
          model: saved.model ?? null,
          modelSettings: saved.modelSettings ?? null,
        },
      },
      session: props.session,
      source,
    })
  }
}

/** The last lines of the pane's screen: Claude Code's input line and its status line. */
async function bottomLines(pane: {
  block: string
  host: string
  session: string
}) {
  return (await readScreen(pane)).split('\n').slice(-10).join('\n')
}
