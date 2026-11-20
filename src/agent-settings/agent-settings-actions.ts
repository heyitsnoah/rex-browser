'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

import { readScreen } from '@/rex/hidden-terminal'
import { runRemoteProgram } from '@/rex/remote-program'
import { requireActionAccess } from '@/rex/rex-access'
import { rex } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'

const defaultsSchema = z.object({
  model: z.unknown(),
  modelSettings: z.unknown(),
})

// The status line Claude Code shows for each mode, in the order Shift+Tab cycles them.
const MODE_LABELS = {
  acceptEdits: 'accept edits on',
  auto: 'auto mode on',
  default: 'manual mode on',
  plan: 'plan mode on',
}

/**
 * Changes a Claude Code pane's model, effort or mode for that session only. /model and /effort also
 * save themselves as the computer's default, so the previous default is put back afterwards.
 */
export const setClaudeSettingAction = requireActionAccess(
  // Next.js hides a thrown error's message in production, so the reason comes back as data.
  async (props: Parameters<typeof changeClaudeSetting>[0]) => {
    try {
      await changeClaudeSetting(props)
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
  // Keys typed while a dialog or menu is open would answer it instead.
  if (!(await statusLines(pane)).includes('shift+tab to cycle')) {
    throw new Error(
      'Claude Code is showing a dialog or menu. Finish it in the terminal, then try again.',
    )
  }
  if (props.setting.kind === 'mode') {
    const label = MODE_LABELS[props.setting.value]
    // Four presses visit every mode once.
    for (let press = 0; press <= 4; press++) {
      if ((await statusLines(pane)).includes(label)) return
      if (press === 4) break
      await rex(host, [
        'block',
        'call',
        '-s',
        props.session,
        '-b',
        props.block,
        'write',
        JSON.stringify({ data: '\x1b[Z' }),
      ])
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`Claude Code didn't reach ${label}.`)
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
    await rex(host, [
      'block',
      'call',
      '-s',
      props.session,
      '-b',
      props.block,
      'write',
      JSON.stringify({ data: '\r' }),
    ])
    const deadline = Date.now() + 10_000
    let switchConfirmed = false
    for (
      let screen = await readScreen(pane);
      screen.split(confirmation).length <= before;
      screen = await readScreen(pane)
    ) {
      // Mid-conversation, Claude Code asks whether to switch (the history is re-read on the new model).
      // The person chose this model, so confirm it once.
      if (!switchConfirmed && screen.includes('Yes, switch to')) {
        switchConfirmed = true
        await rex(host, [
          'block',
          'call',
          '-s',
          props.session,
          '-b',
          props.block,
          'write',
          JSON.stringify({ data: '1' }),
        ])
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

/** The last lines of the pane's screen, where Claude Code shows its mode. */
async function statusLines(pane: {
  block: string
  host: string
  session: string
}) {
  return (await readScreen(pane)).split('\n').slice(-6).join('\n')
}
